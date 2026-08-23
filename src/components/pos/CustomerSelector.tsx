import React, { useState } from 'react';
import { Customer } from '../../types';
import { useStore } from '../../store';
import { 
  User, 
  Phone, 
  Search, 
  Plus, 
  Check, 
  ChevronRight, 
  AlertCircle, 
  Sparkles,
  MapPin
} from 'lucide-react';
import { Modal } from '../common/Modal';

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  selectedCustomer,
  onSelectCustomer
}) => {
  const { customers, addCustomer } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNewCustModalOpen, setIsNewCustModalOpen] = useState(false);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newFragrance, setNewFragrance] = useState<any>('standard');
  const [newStarch, setNewStarch] = useState<any>('none');
  const [newFold, setNewFold] = useState<any>('folded');

  const filteredCustomers = searchQuery.trim().length > 0
    ? customers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
      )
    : customers.slice(0, 4);

  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;

    const created = addCustomer({
      name: newName.trim(),
      phone: newPhone.trim().startsWith('+91') ? newPhone.trim() : `+91 ${newPhone.trim()}`,
      email: newEmail.trim() || undefined,
      address: newAddress.trim() || undefined,
      preferences: {
        fragrance: newFragrance,
        starch: newStarch,
        foldPreference: newFold
      }
    });

    onSelectCustomer(created);
    setIsNewCustModalOpen(false);
    // Reset
    setNewName('');
    setNewPhone('');
    setNewEmail('');
    setNewAddress('');
  };

  return (
    <>
      <div className="pos-customer-bar">
        {selectedCustomer ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div className="customer-selected-badge">
              <div className="customer-avatar-box">
                {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="customer-name-heading">{selectedCustomer.name}</span>
                  {selectedCustomer.tags.map(t => (
                    <span key={t} className="badge badge-purple" style={{ fontSize: '10px' }}>{t}</span>
                  ))}
                </div>
                <div className="customer-meta-row">
                  <span><Phone size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {selectedCustomer.phone}</span>
                  <span>•</span>
                  <span>{selectedCustomer.totalOrders} Orders (₹{selectedCustomer.totalSpend})</span>
                  {selectedCustomer.pendingBalance > 0 && (
                    <>
                      <span>•</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                        Pending: ₹{selectedCustomer.pendingBalance}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {selectedCustomer.preferences?.specialNotes && (
                <div style={{
                  fontSize: '11px',
                  backgroundColor: 'var(--primary-50)',
                  border: '1px solid var(--primary-200)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--primary-800)',
                  maxWidth: '280px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  ⭐ {selectedCustomer.preferences.specialNotes}
                </div>
              )}
              <button 
                className="btn btn-outline btn-sm"
                onClick={() => setIsSearchOpen(true)}
              >
                Change Customer
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div className="customer-avatar-box" style={{ backgroundColor: 'var(--slate-100)', color: 'var(--slate-500)' }}>
                <User size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--slate-800)' }}>
                  No Customer Selected
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--slate-500)' }}>
                  Select or register customer to apply preferences & order history
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={() => setIsSearchOpen(true)}>
                <Search size={14} /> Search Customer
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsNewCustModalOpen(true)}>
                <Plus size={14} /> New Customer
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Customer Search Flyout Modal */}
      <Modal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        title="Select Customer for Order"
        subtitle="Search by full name or 10-digit mobile number"
        size="md"
        footer={
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              setIsSearchOpen(false);
              setIsNewCustModalOpen(true);
            }}
          >
            <Plus size={16} /> Register New Customer
          </button>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="global-search-wrapper">
            <Search className="global-search-icon" size={18} />
            <input
              type="text"
              className="global-search-input"
              placeholder="Type name (e.g. Rahul Patil) or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '320px', overflowY: 'auto' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-500)' }}>
                No customer found matching "{searchQuery}".
              </div>
            ) : (
              filteredCustomers.map(cust => (
                <div
                  key={cust.id}
                  onClick={() => {
                    onSelectCustomer(cust);
                    setIsSearchOpen(false);
                  }}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    backgroundColor: selectedCustomer?.id === cust.id ? 'var(--primary-50)' : '#FFFFFF',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-400)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="customer-avatar-box" style={{ width: '36px', height: '36px', fontSize: '12px' }}>
                      {cust.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--slate-900)' }}>
                        {cust.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                        {cust.phone} • {cust.address || 'No address saved'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--slate-700)' }}>
                      {cust.totalOrders} Orders
                    </div>
                    {cust.pendingBalance > 0 && (
                      <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700 }}>
                        Bal: ₹{cust.pendingBalance}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* New Customer Inline Creation Modal */}
      <Modal
        isOpen={isNewCustModalOpen}
        onClose={() => setIsNewCustModalOpen(false)}
        title="Register New Customer"
        subtitle="Quick counter profile creation with service preferences"
        size="md"
      >
        <form onSubmit={handleCreateCustomer}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Vikram Malhotra"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <input
                  type="tel"
                  className="form-input form-input-mono"
                  placeholder="9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="customer@email.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Delivery Address</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Flat / Building / Street address..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </div>

            {/* Garment Preferences */}
            <div style={{
              backgroundColor: 'var(--slate-50)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-700)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Default Customer Preferences
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Fragrance</label>
                  <select 
                    className="form-select" 
                    style={{ fontSize: '11px', padding: '0.35rem' }}
                    value={newFragrance}
                    onChange={(e) => setNewFragrance(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="standard">Standard</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Starch</label>
                  <select 
                    className="form-select" 
                    style={{ fontSize: '11px', padding: '0.35rem' }}
                    value={newStarch}
                    onChange={(e) => setNewStarch(e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '11px' }}>Packaging</label>
                  <select 
                    className="form-select" 
                    style={{ fontSize: '11px', padding: '0.35rem' }}
                    value={newFold}
                    onChange={(e) => setNewFold(e.target.value)}
                  >
                    <option value="folded">Folded</option>
                    <option value="hanger">Hanger</option>
                    <option value="boxed">Boxed</option>
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsNewCustModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save & Select Customer
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
};
