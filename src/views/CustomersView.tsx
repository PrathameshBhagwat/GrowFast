import React, { useState } from 'react';
import { useStore } from '../store';
import { Customer, CustomerPreference } from '../types';
import { StatusBadge } from '../components/common/StatusBadge';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  MapPin, 
  Mail, 
  ShoppingBag, 
  IndianRupee, 
  Sparkles, 
  Edit3, 
  Check, 
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { Modal } from '../components/common/Modal';

export const CustomersView: React.FC = () => {
  const { customers, orders, selectedCustomerId, setSelectedCustomerId, setSelectedOrderId, setActiveView, updateCustomerPreferences } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCustomer, setActiveCustomer] = useState<Customer>(
    customers.find(c => c.id === selectedCustomerId) || customers[0]
  );
  const [isEditPrefsModalOpen, setIsEditPrefsModalOpen] = useState(false);

  // Preference edit form
  const [fragrance, setFragrance] = useState(activeCustomer?.preferences?.fragrance || 'standard');
  const [starch, setStarch] = useState(activeCustomer?.preferences?.starch || 'none');
  const [foldPreference, setFoldPreference] = useState(activeCustomer?.preferences?.foldPreference || 'folded');
  const [specialNotes, setSpecialNotes] = useState(activeCustomer?.preferences?.specialNotes || '');

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery) ||
    c.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const customerOrders = orders.filter(o => o.customerId === activeCustomer?.id || o.customerName === activeCustomer?.name);

  const handleSelectCust = (cust: Customer) => {
    setActiveCustomer(cust);
    setSelectedCustomerId(cust.id);
    setFragrance(cust.preferences?.fragrance || 'standard');
    setStarch(cust.preferences?.starch || 'none');
    setFoldPreference(cust.preferences?.foldPreference || 'folded');
    setSpecialNotes(cust.preferences?.specialNotes || '');
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeCustomer) {
      updateCustomerPreferences(activeCustomer.id, {
        fragrance,
        starch,
        foldPreference,
        specialNotes
      });
      setIsEditPrefsModalOpen(false);
    }
  };

  const handleStartOrderForCustomer = () => {
    setSelectedCustomerId(activeCustomer.id);
    setActiveView('pos');
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">Customer 360 & Loyalty CRM</h1>
          <p className="page-subtitle">
            Customer lifetime value, garment care preferences & historical orders
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={handleStartOrderForCustomer}>
            <Plus size={16} /> New Order for {activeCustomer?.name.split(' ')[0]}
          </button>
        </div>
      </div>

      {/* 2-Column Split: Directory List on Left, 360 Profile on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.5rem', height: 'calc(100vh - 200px)' }}>
        {/* Left: Customer Search & List */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '0.85rem 1rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.2rem', fontSize: 'var(--text-xs)' }}
                placeholder="Search by name, phone or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            {filteredCustomers.map(cust => {
              const isSelected = activeCustomer?.id === cust.id;
              return (
                <div
                  key={cust.id}
                  onClick={() => handleSelectCust(cust)}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--primary-300)' : 'var(--border-color)',
                    backgroundColor: isSelected ? 'var(--primary-50)' : '#FFFFFF',
                    marginBottom: '0.4rem',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: isSelected ? 'var(--primary-800)' : 'var(--slate-900)' }}>
                      {cust.name}
                    </div>
                    {cust.tags.map(t => (
                      <span key={t} className="badge badge-purple" style={{ fontSize: '9px' }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--slate-500)', marginBottom: '4px' }}>
                    {cust.phone} • {cust.address?.split(',')[0]}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--slate-600)' }}>
                    <span>{cust.totalOrders} Orders</span>
                    <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{cust.totalSpend.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Customer 360 View */}
        {activeCustomer ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {/* Top Customer Hero Card */}
            <div className="card">
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="customer-avatar-box" style={{ width: '54px', height: '54px', fontSize: 'var(--text-xl)' }}>
                      {activeCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--slate-900)' }}>
                          {activeCustomer.name}
                        </h2>
                        {activeCustomer.tags.map(t => (
                          <span key={t} className="badge badge-info">{t}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--slate-500)', marginTop: '2px', display: 'flex', gap: '0.85rem' }}>
                        <span>📞 {activeCustomer.phone}</span>
                        {activeCustomer.email && <span>✉️ {activeCustomer.email}</span>}
                        <span>📅 Since {activeCustomer.customerSince}</span>
                      </div>
                      {activeCustomer.address && (
                        <div style={{ fontSize: '11px', color: 'var(--slate-600)', marginTop: '4px' }}>
                          📍 {activeCustomer.address}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setIsEditPrefsModalOpen(true)}>
                      <Edit3 size={13} /> Edit Preferences
                    </button>
                  </div>
                </div>

                {/* Lifetime Metrics Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem',
                  marginTop: '1.25rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Spend
                    </div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--primary-700)', fontFamily: 'var(--font-mono)' }}>
                      ₹{activeCustomer.totalSpend.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Total Orders
                    </div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--slate-900)' }}>
                      {activeCustomer.totalOrders}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Avg Order Value
                    </div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: 'var(--slate-900)', fontFamily: 'var(--font-mono)' }}>
                      ₹{activeCustomer.averageOrderValue}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Pending Balance
                    </div>
                    <div style={{ fontSize: 'var(--text-lg)', fontWeight: 800, color: activeCustomer.pendingBalance > 0 ? 'var(--danger-text)' : 'var(--success-text)', fontFamily: 'var(--font-mono)' }}>
                      ₹{activeCustomer.pendingBalance}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Care Preferences Card */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} color="var(--primary)" />
                  <h3 className="card-title">Saved Garment Care Preferences</h3>
                </div>
                <span className="badge badge-success" style={{ fontSize: '9.5px' }}>Auto-applied in POS</span>
              </div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '0.85rem' }}>
                  <div style={{ backgroundColor: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Fragrance</div>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--slate-800)', textTransform: 'capitalize' }}>
                      {activeCustomer.preferences?.fragrance || 'Standard'}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Starch Preference</div>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--slate-800)', textTransform: 'capitalize' }}>
                      {activeCustomer.preferences?.starch || 'None'}
                    </strong>
                  </div>
                  <div style={{ backgroundColor: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '10.5px', color: 'var(--slate-400)', textTransform: 'uppercase', fontWeight: 700 }}>Packaging</div>
                    <strong style={{ fontSize: 'var(--text-sm)', color: 'var(--slate-800)', textTransform: 'capitalize' }}>
                      {activeCustomer.preferences?.foldPreference || 'Folded'}
                    </strong>
                  </div>
                </div>

                {activeCustomer.preferences?.specialNotes && (
                  <div style={{
                    backgroundColor: 'var(--primary-50)',
                    border: '1px solid var(--primary-200)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--primary-900)'
                  }}>
                    <strong>Special Instructions:</strong> {activeCustomer.preferences.specialNotes}
                  </div>
                )}
              </div>
            </div>

            {/* Order History */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Order History for {activeCustomer.name}</h3>
              </div>
              <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Garments</th>
                      <th>Stage</th>
                      <th>Payment</th>
                      <th style={{ textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
                          No orders on file for this customer yet.
                        </td>
                      </tr>
                    ) : (
                      customerOrders.map(ord => (
                        <tr
                          key={ord.id}
                          onClick={() => {
                            setSelectedOrderId(ord.id);
                            setActiveView('order-detail');
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <td><span className="tag-mono">{ord.orderNumber}</span></td>
                          <td>{new Date(ord.createdAt).toLocaleDateString()}</td>
                          <td>{ord.itemCount} pcs</td>
                          <td><StatusBadge status={ord.overallStage} /></td>
                          <td><StatusBadge status={ord.paymentStatus} type="payment" /></td>
                          <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            ₹{ord.totalAmount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Edit Customer Preferences Modal */}
      <Modal
        isOpen={isEditPrefsModalOpen}
        onClose={() => setIsEditPrefsModalOpen(false)}
        title={`Edit Preferences — ${activeCustomer?.name}`}
        subtitle="These preferences will auto-populate during order creation"
        size="md"
      >
        <form onSubmit={handleSavePreferences}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Fragrance</label>
                <select
                  className="form-select"
                  value={fragrance}
                  onChange={(e) => setFragrance(e.target.value as any)}
                >
                  <option value="none">None (Hypoallergenic)</option>
                  <option value="light">Light Floral</option>
                  <option value="standard">Standard Fresh</option>
                  <option value="premium">Premium Lavender</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Starch Level</label>
                <select
                  className="form-select"
                  value={starch}
                  onChange={(e) => setStarch(e.target.value as any)}
                >
                  <option value="none">No Starch</option>
                  <option value="light">Light Starch</option>
                  <option value="medium">Medium Crisp</option>
                  <option value="heavy">Heavy Starch</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Packaging</label>
                <select
                  className="form-select"
                  value={foldPreference}
                  onChange={(e) => setFoldPreference(e.target.value as any)}
                >
                  <option value="folded">Standard Fold</option>
                  <option value="hanger">Wooden Hanger</option>
                  <option value="boxed">Gift Box</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Custom Operational Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="e.g. Prefers shirts packed on wooden hangers. White shirts collar extra starch."
                value={specialNotes}
                onChange={(e) => setSpecialNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsEditPrefsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save Preferences
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};
