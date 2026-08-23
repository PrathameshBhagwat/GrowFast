import React, { useState } from 'react';
import { useStore } from '../store';
import { InventoryCategory, InventoryItem } from '../types';
import { 
  Boxes, 
  AlertTriangle, 
  RotateCcw, 
  Plus, 
  CheckCircle2, 
  Package, 
  ShoppingCart,
  Calendar,
  Layers
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const InventoryView: React.FC = () => {
  const { inventory, updateInventoryStock, reorderInventoryItem } = useStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustedStockValue, setAdjustedStockValue] = useState<number>(0);

  const lowStockCount = inventory.filter(i => i.currentStock <= i.lowStockThreshold).length;

  const categories = [
    { id: 'all', label: 'All Items' },
    { id: 'detergents', label: 'Detergents & Soaps' },
    { id: 'chemicals', label: 'Spotting Solvents' },
    { id: 'packaging', label: 'Garment Bags' },
    { id: 'hangers', label: 'Hangers' },
    { id: 'tags', label: 'POS Rolls & Tags' }
  ];

  const filteredInventory = inventory.filter(i => 
    selectedCategory === 'all' || i.category === selectedCategory
  );

  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustItem(item);
    setAdjustedStockValue(item.currentStock);
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (adjustItem) {
      updateInventoryStock(adjustItem.id, adjustedStockValue);
      setAdjustItem(null);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Store Consumables & Stock Inventory</h1>
          <p className="page-subtitle">
            Manage cleaning chemicals, solvents, hangers, bags & automated reorder triggers
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top">
            <span className="metric-label">Tracked Consumables</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--primary-50)', color: 'var(--primary-600)' }}>
              <Boxes size={20} />
            </div>
          </div>
          <div className="metric-value">{inventory.length} SKUs</div>
          <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
            Active in daily operations
          </div>
        </div>

        <div className="metric-card" style={{ borderLeft: lowStockCount > 0 ? '3px solid var(--warning)' : undefined }}>
          <div className="metric-top">
            <span className="metric-label">Low Stock Alerts</span>
            <div className="metric-icon-box" style={{ backgroundColor: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="metric-value" style={{ color: lowStockCount > 0 ? 'var(--warning-text)' : 'var(--slate-900)' }}>
            {lowStockCount} Items
          </div>
          <div style={{ fontSize: '11px', color: 'var(--warning-text)', fontWeight: 600 }}>
            {lowStockCount > 0 ? 'Restock required to prevent downtime' : 'All stock levels healthy'}
          </div>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div className="tabs-nav" style={{ border: 'none', padding: 0 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Category</th>
              <th>Current Stock</th>
              <th>Low-Stock Alert Level</th>
              <th>Cost / Unit</th>
              <th>Primary Supplier</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map(item => {
              const isLow = item.currentStock <= item.lowStockThreshold;
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--slate-900)' }}>{item.name}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)' }}>Last restocked: {item.lastRestocked}</div>
                  </td>
                  <td>
                    <span className="badge badge-purple" style={{ textTransform: 'capitalize' }}>
                      {item.category}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
                      {item.currentStock} {item.unit}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '11.5px', color: 'var(--slate-500)', fontFamily: 'var(--font-mono)' }}>
                      {item.lowStockThreshold} {item.unit}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>₹{item.costPerUnit}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '11px', color: 'var(--slate-700)' }}>{item.supplier}</span>
                  </td>
                  <td>
                    {isLow ? (
                      <span className="badge badge-danger">
                        <AlertTriangle size={11} /> Low Stock
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <CheckCircle2 size={11} /> Healthy
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '10.5px' }}
                        onClick={() => handleOpenAdjust(item)}
                      >
                        Adjust
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ fontSize: '10.5px' }}
                        onClick={() => reorderInventoryItem(item.id)}
                        title={`Reorder +${item.reorderQuantity} ${item.unit}`}
                      >
                        <ShoppingCart size={12} /> +{item.reorderQuantity} Reorder
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjust Stock Modal */}
      <Modal
        isOpen={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        title={`Adjust Stock — ${adjustItem?.name}`}
        subtitle={`Current recorded: ${adjustItem?.currentStock} ${adjustItem?.unit}`}
        size="sm"
      >
        <form onSubmit={handleSaveAdjust}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Physical Count ({adjustItem?.unit})</label>
              <input
                type="number"
                min="0"
                className="form-input form-input-mono"
                value={adjustedStockValue}
                onChange={(e) => setAdjustedStockValue(parseInt(e.target.value) || 0)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setAdjustItem(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Update Stock
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
