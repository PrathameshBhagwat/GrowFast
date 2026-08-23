import React, { useState, useEffect } from 'react';
import { 
  GarmentDefinition, 
  OrderItem, 
  ServiceType, 
  DamageType, 
  GarmentDamage, 
  OrderItemPhoto 
} from '../../types';
import { Drawer } from '../common/Drawer';
import { PhotoCaptureModal } from '../common/PhotoCaptureModal';
import { 
  Plus, 
  Minus, 
  Camera, 
  Sparkles, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Zap,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';

interface GarmentDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  garment: GarmentDefinition | null;
  onAddItem: (item: OrderItem) => void;
}

export const GarmentDetailDrawer: React.FC<GarmentDetailDrawerProps> = ({
  isOpen,
  onClose,
  garment,
  onAddItem
}) => {
  if (!garment) return null;

  // Selected Service
  const [selectedService, setSelectedService] = useState<ServiceType>(
    garment.baseServices[0]?.service || 'dry_clean'
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [weightKg, setWeightKg] = useState<number>(1.0);

  // Progressive fields
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedFabric, setSelectedFabric] = useState<string>('');
  const [specialNote, setSpecialNote] = useState<string>('');
  const [isExpress, setIsExpress] = useState<boolean>(false);

  // Damages & Stains
  const [stainsList, setStainsList] = useState<string[]>([]);
  const [damagesList, setDamagesList] = useState<GarmentDamage[]>([]);
  const [photosList, setPhotosList] = useState<OrderItemPhoto[]>([]);

  // Accordion state
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [showDamageForm, setShowDamageForm] = useState<boolean>(false);
  const [newDamageType, setNewDamageType] = useState<DamageType>('tear');
  const [newDamageDesc, setNewDamageDesc] = useState<string>('');
  const [newDamageSeverity, setNewDamageSeverity] = useState<'low' | 'medium' | 'high'>('low');

  // Photo modal
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState<boolean>(false);

  // Reset or init when garment changes
  useEffect(() => {
    if (garment) {
      setSelectedService(garment.baseServices[0]?.service || 'dry_clean');
      setQuantity(1);
      setWeightKg(garment.baseServices.some(s => s.isWeightBased) ? 4.5 : 1.0);
      setSelectedColor(garment.standardColors?.[0] || '');
      setSelectedFabric(garment.standardFabrics?.[0] || '');
      setSpecialNote('');
      setIsExpress(false);
      setStainsList([]);
      setDamagesList([]);
      setPhotosList([]);
      setShowAdvanced(false);
      setShowDamageForm(false);
    }
  }, [garment]);

  // Current service object
  const currentServiceObj = garment.baseServices.find(s => s.service === selectedService) || garment.baseServices[0];
  const isWeightBased = currentServiceObj?.isWeightBased || false;

  // Calculate pricing
  const unitPrice = currentServiceObj?.price || 0;
  const rawTotal = isWeightBased ? Math.round(weightKg * unitPrice) : quantity * unitPrice;
  const finalTotal = isExpress ? Math.round(rawTotal * 1.25) : rawTotal;

  const handleAddDamage = () => {
    if (!newDamageDesc.trim()) return;
    const dmg: GarmentDamage = {
      id: `dmg-${Date.now()}`,
      type: newDamageType,
      description: newDamageDesc.trim(),
      severity: newDamageSeverity
    };
    setDamagesList(prev => [...prev, dmg]);
    setNewDamageDesc('');
    setShowDamageForm(false);
  };

  const handleToggleStain = (stain: string) => {
    setStainsList(prev => 
      prev.includes(stain) ? prev.filter(s => s !== stain) : [...prev, stain]
    );
  };

  const handlePhotoCaptured = (photo: OrderItemPhoto) => {
    setPhotosList(prev => [...prev, photo]);
  };

  const handleConfirmAdd = () => {
    const serviceNameMap: Record<ServiceType, string> = {
      dry_clean: 'Dry Cleaning',
      steam_press: 'Steam Pressing',
      wash: 'Standard Wash',
      wash_iron: 'Wash + Steam Iron',
      shoe_clean: 'Premium Shoe Spa',
      leather_clean: 'Leather & Suede Spa',
      stain_removal: 'Targeted Spotting',
      carpet_clean: 'Carpet Cleaning',
      curtain_clean: 'Curtain Cleaning',
      weight_based: 'Laundry by Weight'
    };

    const count = isWeightBased ? 1 : quantity;
    const generatedIndividualGarments = Array.from({ length: count }, (_, idx) => ({
      garmentTag: `GAR-${Math.floor(1000 + Math.random() * 9000)}-${String(idx + 1).padStart(2, '0')}`,
      garmentName: `${garment.name}${selectedColor ? ` (${selectedColor})` : ''}`,
      service: selectedService,
      color: selectedColor || undefined,
      fabric: selectedFabric || undefined,
      stage: 'received' as const,
      stains: stainsList.length > 0 ? stainsList : undefined,
      damages: damagesList.length > 0 ? damagesList : undefined,
      photoUrls: photosList.map(p => p.url)
    }));

    const newItem: OrderItem = {
      id: `item-${Date.now()}`,
      garmentId: garment.id,
      garmentName: garment.name,
      category: garment.category,
      service: selectedService,
      serviceName: serviceNameMap[selectedService] || 'Dry Cleaning',
      quantity: count,
      weightKg: isWeightBased ? weightKg : undefined,
      unitPrice,
      totalPrice: finalTotal,
      color: selectedColor || undefined,
      fabric: selectedFabric || undefined,
      stains: stainsList.length > 0 ? stainsList : undefined,
      damages: damagesList.length > 0 ? damagesList : undefined,
      specialInstructions: specialNote.trim() || undefined,
      expressService: isExpress,
      photos: photosList.length > 0 ? photosList : undefined,
      individualGarments: generatedIndividualGarments
    };

    onAddItem(newItem);
    onClose();
  };

  const stainPresets = ['Oil / Grease', 'Ink / Ballpen', 'Sweat / Collar', 'Food / Curry', 'Rust', 'Coffee / Tea', 'Mud'];
  const instructionPresets = ['Extra Starch on Collar', 'No Fragrance', 'Wooden Hanger Only', 'Delicate Hand Iron', 'Check Pockets'];

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: 'var(--text-xl)' }}>{garment.name}</span>
            <span className="badge badge-info" style={{ fontSize: '10px' }}>{garment.category}</span>
          </div>
        }
        subtitle="Select service treatment, quantity & optional condition details"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div>
              <div style={{ fontSize: '10.5px', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                Estimated Price
              </div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                ₹{finalTotal}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary btn-lg" onClick={handleConfirmAdd}>
                <Plus size={18} /> Add to Order
              </button>
            </div>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* 1. Service Selection Pills */}
          <div>
            <label className="form-label" style={{ marginBottom: '0.5rem' }}>
              <span>Select Service</span>
              <span className="form-helper">Pricing updates automatically</span>
            </label>
            <div className="service-pill-grid">
              {garment.baseServices.map(srv => {
                const isSelected = selectedService === srv.service;
                const srvName = srv.service.replace('_', ' ').toUpperCase();
                return (
                  <div
                    key={srv.service}
                    className={`service-pill-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedService(srv.service)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <span className="service-pill-name">{srvName}</span>
                      {isSelected && <Check size={14} color="var(--primary-600)" />}
                    </div>
                    <span className="service-pill-price">
                      ₹{srv.price}{srv.isWeightBased ? '/kg' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Quantity / Weight Control */}
          {isWeightBased ? (
            <div className="form-group">
              <label className="form-label">
                <span>Total Weight (Kg)</span>
                <span className="form-helper">₹{unitPrice} per kg</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  className="form-input form-input-mono"
                  style={{ fontSize: 'var(--text-lg)', fontWeight: 700, textAlign: 'center' }}
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontWeight: 700, color: 'var(--slate-600)' }}>Kg</span>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">
                <span>Quantity</span>
                <span className="form-helper">Number of pieces</span>
              </label>
              <div className="stepper-control">
                <button
                  className="stepper-btn"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus size={18} />
                </button>
                <div className="stepper-value">{quantity}</div>
                <button
                  className="stepper-btn"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          )}

          {/* 3. Fast Express Processing Toggle */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            backgroundColor: isExpress ? 'var(--warning-bg)' : 'var(--slate-50)',
            border: '1px solid',
            borderColor: isExpress ? 'var(--warning-border)' : 'var(--border-color)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer'
          }}
          onClick={() => setIsExpress(!isExpress)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color={isExpress ? 'var(--warning)' : 'var(--slate-400)'} />
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: isExpress ? 'var(--warning-text)' : 'var(--slate-800)' }}>
                  Same-Day / Next-Day Express Delivery
                </div>
                <div style={{ fontSize: '10.5px', color: 'var(--slate-500)' }}>
                  +25% priority handling surcharge
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isExpress}
              onChange={() => setIsExpress(!isExpress)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
          </div>

          {/* 4. Progressive Disclosure: Colors, Fabrics, Stains, Damages, Photos */}
          <div className="drawer-accordion">
            <div 
              className="drawer-accordion-header"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Color, Fabric, Stains & Damage Records</span>
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>

            {showAdvanced && (
              <div className="drawer-accordion-content">
                {/* Color Selection */}
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Garment Color</label>
                  <div className="chip-row">
                    {(garment.standardColors || ['White', 'Black', 'Blue', 'Red', 'Pastel', 'Multi']).map(c => (
                      <button
                        key={c}
                        className={`chip-btn ${selectedColor === c ? 'active' : ''}`}
                        onClick={() => setSelectedColor(selectedColor === c ? '' : c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fabric Selection */}
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Fabric Material</label>
                  <div className="chip-row">
                    {(garment.standardFabrics || ['Cotton', 'Silk', 'Wool', 'Polyester', 'Linen']).map(f => (
                      <button
                        key={f}
                        className={`chip-btn ${selectedFabric === f ? 'active' : ''}`}
                        onClick={() => setSelectedFabric(selectedFabric === f ? '' : f)}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pre-existing Stains */}
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>
                    <span>Noted Stains</span>
                    <span className="form-helper">Dispute prevention tag</span>
                  </label>
                  <div className="chip-row">
                    {stainPresets.map(stain => {
                      const isNoted = stainsList.includes(stain);
                      return (
                        <button
                          key={stain}
                          className={`chip-btn ${isNoted ? 'active' : ''}`}
                          style={isNoted ? { backgroundColor: 'var(--danger-bg)', color: 'var(--danger-text)', borderColor: 'var(--danger-border)' } : {}}
                          onClick={() => handleToggleStain(stain)}
                        >
                          {isNoted ? '✓ ' : '+ '}{stain}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Existing Defects / Damage Recorder */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label" style={{ fontSize: '11px', margin: 0 }}>
                      <span>Existing Damages / Defects ({damagesList.length})</span>
                    </label>
                    <button 
                      className="btn btn-outline btn-sm" 
                      style={{ fontSize: '10.5px', padding: '0.2rem 0.5rem' }}
                      onClick={() => setShowDamageForm(true)}
                    >
                      + Add Damage
                    </button>
                  </div>

                  {damagesList.map(dmg => (
                    <div 
                      key={dmg.id}
                      style={{
                        padding: '0.5rem 0.75rem',
                        backgroundColor: 'var(--danger-bg)',
                        border: '1px solid var(--danger-border)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.35rem',
                        fontSize: '11.5px'
                      }}
                    >
                      <div>
                        <strong style={{ textTransform: 'capitalize', color: 'var(--danger-text)' }}>{dmg.type}:</strong> {dmg.description}
                      </div>
                      <button 
                        className="btn-icon-sm btn-ghost" 
                        onClick={() => setDamagesList(damagesList.filter(d => d.id !== dmg.id))}
                      >
                        <Trash2 size={12} color="var(--danger)" />
                      </button>
                    </div>
                  ))}

                  {showDamageForm && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--slate-100)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      marginTop: '0.35rem'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>Damage Type</label>
                          <select 
                            className="form-select" 
                            style={{ fontSize: '11px', padding: '0.35rem' }}
                            value={newDamageType}
                            onChange={(e) => setNewDamageType(e.target.value as DamageType)}
                          >
                            <option value="tear">Tear / Cut</option>
                            <option value="missing_button">Missing Button</option>
                            <option value="fading">Color Fading</option>
                            <option value="burn">Burn Mark</option>
                            <option value="color_bleed">Color Bleed</option>
                            <option value="other">Other Defect</option>
                          </select>
                        </div>
                        <div>
                          <label className="form-label" style={{ fontSize: '10.5px' }}>Severity</label>
                          <select 
                            className="form-select" 
                            style={{ fontSize: '11px', padding: '0.35rem' }}
                            value={newDamageSeverity}
                            onChange={(e) => setNewDamageSeverity(e.target.value as any)}
                          >
                            <option value="low">Minor / Low</option>
                            <option value="medium">Moderate</option>
                            <option value="high">Critical / High</option>
                          </select>
                        </div>
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '11.5px', padding: '0.35rem 0.6rem' }}
                        placeholder="Description (e.g. 1cm tear near left cuff button)..."
                        value={newDamageDesc}
                        onChange={(e) => setNewDamageDesc(e.target.value)}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setShowDamageForm(false)}>Cancel</button>
                        <button className="btn btn-primary btn-sm" onClick={handleAddDamage}>Attach Damage</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Photo Capture Simulator */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="form-label" style={{ fontSize: '11px', margin: 0 }}>
                      <span>Attached Photos ({photosList.length})</span>
                    </label>
                    <button 
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '0.3rem 0.6rem' }}
                      onClick={() => setIsPhotoModalOpen(true)}
                    >
                      <Camera size={13} /> Snap Photo
                    </button>
                  </div>

                  {photosList.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {photosList.map((p, idx) => (
                        <div 
                          key={p.id} 
                          style={{ 
                            position: 'relative', 
                            width: '54px', 
                            height: '54px', 
                            borderRadius: 'var(--radius-sm)', 
                            overflow: 'hidden',
                            border: '1px solid var(--border-color)' 
                          }}
                        >
                          <img src={p.url} alt="Garment photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button
                            onClick={() => setPhotosList(photosList.filter((_, i) => i !== idx))}
                            style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              background: 'rgba(0,0,0,0.6)',
                              color: '#FFF',
                              border: 'none',
                              borderRadius: '50%',
                              width: '16px',
                              height: '16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px'
                            }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Special Instructions */}
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Special Instructions</label>
                  <div className="chip-row" style={{ marginBottom: '0.4rem' }}>
                    {instructionPresets.map(preset => (
                      <button
                        key={preset}
                        className="chip-btn"
                        style={{ fontSize: '10px' }}
                        onClick={() => setSpecialNote(prev => prev ? `${prev}, ${preset}` : preset)}
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="form-input"
                    style={{ fontSize: '11.5px' }}
                    placeholder="Custom instruction for laundry processing team..."
                    value={specialNote}
                    onChange={(e) => setSpecialNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Photo Capture Modal */}
      <PhotoCaptureModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        garmentName={garment.name}
        onPhotoCaptured={handlePhotoCaptured}
      />
    </>
  );
};
