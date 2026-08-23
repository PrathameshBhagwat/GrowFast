import React, { useState } from 'react';
import { useStore } from '../store';
import { ServiceType } from '../types';
import { 
  Tags, 
  Edit3, 
  Check, 
  Zap, 
  Plus, 
  IndianRupee, 
  Sparkles,
  Scale
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const PricingSettingsView: React.FC = () => {
  const { garments, services, updateGarmentServicePrice } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingPriceItem, setEditingPriceItem] = useState<{
    garmentId: string;
    garmentName: string;
    service: ServiceType;
    currentPrice: number;
  } | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);

  const categories = ['all', 'men', 'women', 'household', 'shoes', 'special'];

  const filteredGarments = garments.filter(g => 
    selectedCategory === 'all' || g.category === selectedCategory
  );

  const handleOpenEdit = (garmentId: string, garmentName: string, service: ServiceType, price: number) => {
    setEditingPriceItem({ garmentId, garmentName, service, currentPrice: price });
    setNewPrice(price);
  };

  const handleSavePrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPriceItem) {
      updateGarmentServicePrice(editingPriceItem.garmentId, editingPriceItem.service, newPrice);
      setEditingPriceItem(null);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Service Catalog & Dynamic Pricing Matrix</h1>
          <p className="page-subtitle">
            Configure rates per Garment × Service combination, express surcharges & weight scales
          </p>
        </div>
      </div>

      {/* Express Policy Banner */}
      <div className="alert-banner info" style={{ marginBottom: '1.25rem' }}>
        <Zap size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div>
          <strong>Express Service Pricing Rule:</strong> Same-day and next-day express orders automatically apply a <strong>+25% surcharge</strong> calculated over total garment subtotal.
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div className="tabs-nav" style={{ border: 'none', padding: 0 }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
              style={{ textTransform: 'capitalize' }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'all' ? 'All Garments' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Matrix Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Garment Type</th>
              <th>Category</th>
              <th>Dry Clean</th>
              <th>Steam Press</th>
              <th>Standard Wash</th>
              <th>Wash + Iron</th>
              <th>Special / Weight</th>
            </tr>
          </thead>
          <tbody>
            {filteredGarments.map(g => {
              const dc = g.baseServices.find(s => s.service === 'dry_clean');
              const sp = g.baseServices.find(s => s.service === 'steam_press');
              const wash = g.baseServices.find(s => s.service === 'wash');
              const wi = g.baseServices.find(s => s.service === 'wash_iron');
              const special = g.baseServices.find(s => ['shoe_clean', 'leather_clean', 'weight_based'].includes(s.service));

              return (
                <tr key={g.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{g.name}</div>
                  </td>
                  <td>
                    <span className="badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                      {g.category}
                    </span>
                  </td>

                  {/* Dry Clean */}
                  <td>
                    {dc ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                        onClick={() => handleOpenEdit(g.id, g.name, 'dry_clean', dc.price)}
                      >
                        ₹{dc.price} <Edit3 size={11} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--slate-300)' }}>—</span>
                    )}
                  </td>

                  {/* Steam Press */}
                  <td>
                    {sp ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                        onClick={() => handleOpenEdit(g.id, g.name, 'steam_press', sp.price)}
                      >
                        ₹{sp.price} <Edit3 size={11} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--slate-300)' }}>—</span>
                    )}
                  </td>

                  {/* Standard Wash */}
                  <td>
                    {wash ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                        onClick={() => handleOpenEdit(g.id, g.name, 'wash', wash.price)}
                      >
                        ₹{wash.price} <Edit3 size={11} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--slate-300)' }}>—</span>
                    )}
                  </td>

                  {/* Wash + Iron */}
                  <td>
                    {wi ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                        onClick={() => handleOpenEdit(g.id, g.name, 'wash_iron', wi.price)}
                      >
                        ₹{wi.price} <Edit3 size={11} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--slate-300)' }}>—</span>
                    )}
                  </td>

                  {/* Special / Weight */}
                  <td>
                    {special ? (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                        onClick={() => handleOpenEdit(g.id, g.name, special.service, special.price)}
                      >
                        ₹{special.price}{special.isWeightBased ? '/kg' : ''} <Edit3 size={11} />
                      </button>
                    ) : (
                      <span style={{ color: 'var(--slate-300)' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Price Modal */}
      <Modal
        isOpen={!!editingPriceItem}
        onClose={() => setEditingPriceItem(null)}
        title={`Edit Price — ${editingPriceItem?.garmentName}`}
        subtitle={`Service: ${editingPriceItem?.service.replace('_', ' ').toUpperCase()}`}
        size="sm"
      >
        <form onSubmit={handleSavePrice}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Base Rate (₹)</label>
              <input
                type="number"
                min="0"
                className="form-input form-input-mono"
                style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}
                value={newPrice}
                onChange={(e) => setNewPrice(parseInt(e.target.value) || 0)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingPriceItem(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Update Price
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
