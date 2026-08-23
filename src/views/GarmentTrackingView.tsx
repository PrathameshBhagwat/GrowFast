import React, { useState } from 'react';
import { useStore } from '../store';
import { StatusBadge } from '../components/common/StatusBadge';
import { QCHandlerModal } from '../components/processing/QCHandlerModal';
import { QRScannerModal } from '../components/common/QRScannerModal';
import { IndividualGarmentTag, ProcessingStage } from '../types';
import { 
  Scan, 
  Search, 
  Camera, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  User, 
  ShoppingBag, 
  CheckSquare, 
  ArrowRight,
  ArrowLeft,
  MapPin
} from 'lucide-react';

export const GarmentTrackingView: React.FC = () => {
  const { selectedGarmentTag, setSelectedGarmentTag, orders, updateGarmentStatus, recordQCResult, setActiveView, setSelectedOrderId } = useStore();
  const [searchTag, setSearchTag] = useState<string>(selectedGarmentTag || 'GAR-8721-03');
  const [isQRScannerOpen, setIsQRScannerOpen] = useState<boolean>(false);
  const [isQCModalOpen, setIsQCModalOpen] = useState<boolean>(false);

  // Search across all orders for this garment
  let foundGarment: (IndividualGarmentTag & { orderNumber: string; orderId: string; customerName: string; customerPhone: string; specialInstructions?: string }) | null = null;

  for (const order of orders) {
    for (const item of order.items) {
      for (const g of item.individualGarments) {
        if (g.garmentTag.toLowerCase() === searchTag.toLowerCase()) {
          foundGarment = {
            ...g,
            orderNumber: order.orderNumber,
            orderId: order.id,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            specialInstructions: item.specialInstructions
          };
          break;
        }
      }
    }
  }

  // Fallback to first garment if none found
  if (!foundGarment && orders[0]?.items[0]?.individualGarments[0]) {
    const firstOrder = orders[0];
    const firstItem = firstOrder.items[0];
    const firstG = firstItem.individualGarments[0];
    foundGarment = {
      ...firstG,
      orderNumber: firstOrder.orderNumber,
      orderId: firstOrder.id,
      customerName: firstOrder.customerName,
      customerPhone: firstOrder.customerPhone,
      specialInstructions: firstItem.specialInstructions
    };
  }

  const allStages: { key: ProcessingStage; label: string }[] = [
    { key: 'received', label: 'Received Intake' },
    { key: 'sorting', label: 'Sorting & Inspection' },
    { key: 'processing', label: 'Solvent / Wash Cycle' },
    { key: 'ironing', label: 'Steam Pressing' },
    { key: 'quality_check', label: 'Quality Control' },
    { key: 'packed', label: 'Packed in Bag' },
    { key: 'ready', label: 'Ready for Customer' }
  ];

  const currentStageIndex = allStages.findIndex(s => s.key === foundGarment?.stage);

  const handleScanComplete = (tag: string) => {
    setSearchTag(tag);
    setSelectedGarmentTag(tag);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Garment-Level Identity & Tracking</h1>
          <p className="page-subtitle">
            Individual piece lifecycle, condition history, rack storage & optical barcode
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setIsQRScannerOpen(true)}>
            <Scan size={16} /> Scan Tag Barcode
          </button>
        </div>
      </div>

      {/* Search Bar for Tag Lookup */}
      <div className="card" style={{ marginBottom: '1.5rem', backgroundColor: '#FFFFFF' }}>
        <div className="card-body" style={{ padding: '1rem 1.25rem' }}>
          <form onSubmit={(e) => { e.preventDefault(); setSelectedGarmentTag(searchTag); }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                <input
                  type="text"
                  className="form-input form-input-mono"
                  style={{ paddingLeft: '2.5rem', fontSize: 'var(--text-base)', fontWeight: 700 }}
                  placeholder="Enter Garment Tag ID (e.g. GAR-8721-03)..."
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-primary">
                Lookup Tag <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      </div>

      {foundGarment && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.5rem' }}>
          {/* Left Column: Garment Hero, Lifecycle Timeline, Before Records */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Hero Card */}
            <div className="card">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                      <span className="tag-mono" style={{ fontSize: 'var(--text-lg)', padding: '0.3rem 0.75rem', backgroundColor: 'var(--primary-50)', color: 'var(--primary-800)', borderColor: 'var(--primary-200)' }}>
                        {foundGarment.garmentTag}
                      </span>
                      <StatusBadge status={foundGarment.stage} />
                      {foundGarment.qcStatus && <StatusBadge status={foundGarment.qcStatus} type="qc" />}
                    </div>
                    <h2 style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {foundGarment.garmentName}
                    </h2>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--primary-700)', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
                      {foundGarment.service.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Rack Info Box */}
                  <div style={{
                    backgroundColor: 'var(--slate-50)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem 1rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--slate-500)', fontWeight: 700 }}>
                      Rack Slot
                    </div>
                    <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>
                      {foundGarment.rackLocation || 'R-12-B'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--slate-400)' }}>
                      {foundGarment.bagId || 'BAG-8721'}
                    </div>
                  </div>
                </div>

                {/* Interactive Stage Lifecycle Stepper */}
                <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'uppercase', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                    Stage Lifecycle Progress
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                    {allStages.map((stg, sIdx) => {
                      const isCompleted = sIdx <= currentStageIndex;
                      const isCurrent = sIdx === currentStageIndex;
                      return (
                        <div
                          key={stg.key}
                          onClick={() => updateGarmentStatus(foundGarment!.garmentTag, stg.key)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.35rem',
                            cursor: 'pointer',
                            zIndex: 2,
                            flex: 1
                          }}
                        >
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: isCompleted ? 'var(--primary-600)' : 'var(--slate-200)',
                            color: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            boxShadow: isCurrent ? '0 0 0 4px var(--primary-100)' : 'none',
                            transition: 'all var(--transition-fast)'
                          }}>
                            {isCompleted ? '✓' : sIdx + 1}
                          </div>
                          <span style={{
                            fontSize: '10px',
                            textAlign: 'center',
                            fontWeight: isCurrent ? 700 : 500,
                            color: isCurrent ? 'var(--primary-700)' : (isCompleted ? 'var(--slate-800)' : 'var(--slate-400)'),
                            maxWidth: '70px',
                            lineHeight: 1.15
                          }}>
                            {stg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Before-Cleaning Condition & Dispute Records */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShieldAlert size={16} color="var(--primary)" />
                  <h3 className="card-title">Counter Intake Condition & Evidence</h3>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setIsQCModalOpen(true)}>
                  <CheckSquare size={13} /> Perform QC
                </button>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  {/* Photo Thumbnail */}
                  <div style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    backgroundColor: '#0F172A',
                    border: '1px solid var(--border-color)',
                    flexShrink: 0
                  }}>
                    {foundGarment.photoUrls && foundGarment.photoUrls.length > 0 ? (
                      <img src={foundGarment.photoUrls[0]} alt="Condition" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '11px', textAlign: 'center', padding: '0.5rem' }}>
                        <Camera size={24} style={{ marginBottom: '4px' }} />
                        No photo attached
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-xs)' }}>
                    <div>
                      <span style={{ color: 'var(--slate-500)', display: 'block' }}>Defects Logged at Intake:</span>
                      {foundGarment.damages && foundGarment.damages.length > 0 ? (
                        foundGarment.damages.map(d => (
                          <div key={d.id} style={{ color: 'var(--danger-text)', fontWeight: 700, marginTop: '2px' }}>
                            ⚠️ {d.description} ({d.severity} severity)
                          </div>
                        ))
                      ) : (
                        <strong style={{ color: 'var(--slate-700)' }}>None noted at intake (Clean condition)</strong>
                      )}
                    </div>

                    {foundGarment.stains && foundGarment.stains.length > 0 && (
                      <div>
                        <span style={{ color: 'var(--slate-500)', display: 'block' }}>Pre-cleaning Stains:</span>
                        <strong style={{ color: 'var(--warning-text)' }}>{foundGarment.stains.join(', ')}</strong>
                      </div>
                    )}

                    {foundGarment.specialInstructions && (
                      <div>
                        <span style={{ color: 'var(--slate-500)', display: 'block' }}>Special Instructions:</span>
                        <em style={{ color: 'var(--slate-800)' }}>{foundGarment.specialInstructions}</em>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Order & Customer Affiliation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Order & Customer Affiliation</h3>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{
                  padding: '0.85rem',
                  backgroundColor: 'var(--slate-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10.5px', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Parent Order
                    </span>
                    <span className="tag-mono">{foundGarment.orderNumber}</span>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ width: '100%', marginTop: '0.4rem', fontSize: '11px' }}
                    onClick={() => {
                      setSelectedOrderId(foundGarment!.orderId);
                      setActiveView('order-detail');
                    }}
                  >
                    <ShoppingBag size={13} /> View Complete Order
                  </button>
                </div>

                <div style={{
                  padding: '0.85rem',
                  backgroundColor: 'var(--slate-50)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ fontSize: '10.5px', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>
                    Customer Details
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--slate-900)' }}>
                    {foundGarment.customerName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                    📞 {foundGarment.customerPhone}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QC Modal */}
      <QCHandlerModal
        isOpen={isQCModalOpen}
        onClose={() => setIsQCModalOpen(false)}
        garment={foundGarment}
        onQCSubmit={recordQCResult}
      />

      {/* Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onScanResult={handleScanComplete}
      />
    </div>
  );
};
