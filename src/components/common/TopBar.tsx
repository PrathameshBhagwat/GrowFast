import React, { useState } from 'react';
import { useStore } from '../../store';
import { 
  Search, 
  Scan, 
  Bell, 
  ChevronDown, 
  Store, 
  UserCheck, 
  Sparkles, 
  PlusCircle,
  Truck,
  CheckCircle
} from 'lucide-react';
import { UserRole } from '../../types';
import { QRScannerModal } from './QRScannerModal';
import { NotificationCenter } from './NotificationCenter';

export const TopBar: React.FC = () => {
  const { 
    currentRole, 
    setCurrentRole, 
    currentUser, 
    setActiveView, 
    setSelectedOrderId, 
    setSelectedGarmentTag, 
    setSelectedCustomerId,
    customers, 
    orders,
    notifications
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const unreadNotifs = notifications.filter(n => !n.read).length;

  // Search matches
  const matchedCustomers = searchQuery.trim().length > 1 
    ? customers.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.phone.includes(searchQuery)
      ) 
    : [];

  const matchedOrders = searchQuery.trim().length > 1
    ? orders.filter(o => 
        o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const matchedGarments = searchQuery.trim().length > 1
    ? orders.flatMap(o => 
        o.items.flatMap(i => 
          i.individualGarments.filter(g => 
            g.garmentTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
            g.garmentName.toLowerCase().includes(searchQuery.toLowerCase())
          ).map(g => ({ ...g, orderNumber: o.orderNumber, customerName: o.customerName }))
        )
      )
    : [];

  const handleSelectCustomer = (id: string) => {
    setSelectedCustomerId(id);
    setActiveView('customer-detail');
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleSelectOrder = (id: string) => {
    setSelectedOrderId(id);
    setActiveView('order-detail');
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleSelectGarment = (tag: string) => {
    setSelectedGarmentTag(tag);
    setActiveView('garment-tracking');
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleScanResult = (result: string) => {
    if (result.toUpperCase().startsWith('ORD-')) {
      const ord = orders.find(o => o.orderNumber.toUpperCase() === result.toUpperCase());
      if (ord) {
        setSelectedOrderId(ord.id);
        setActiveView('order-detail');
      }
    } else if (result.toUpperCase().startsWith('GAR-')) {
      setSelectedGarmentTag(result.toUpperCase());
      setActiveView('garment-tracking');
    } else {
      // General lookup
      setSearchQuery(result);
      setIsSearchOpen(true);
    }
  };

  const roles: { key: UserRole; label: string; desc: string; icon: any }[] = [
    { key: 'counter', label: 'Counter Operator', desc: 'Fast POS, intake & payments', icon: PlusCircle },
    { key: 'manager', label: 'Store Manager', desc: 'Analytics, pricing, inventory & expenses', icon: Store },
    { key: 'processing', label: 'Processing Staff', desc: 'Wash, steam press, QC & packing', icon: Sparkles },
    { key: 'rider', label: 'Delivery Rider', desc: 'Dispatch routes & proof of delivery', icon: Truck }
  ];

  return (
    <>
      <header className="app-topbar">
        {/* Left: Global Search with Instant Dropdown */}
        <div className="topbar-left">
          <div className="global-search-wrapper">
            <Search className="global-search-icon" size={18} />
            <input
              type="text"
              className="global-search-input"
              placeholder="Search Customer, Phone, Order (ORD-8721), or Garment Tag (GAR-8721-03)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onFocus={() => setIsSearchOpen(true)}
            />
            <span className="global-search-shortcut">/</span>

            {/* Global Search Results Flyout */}
            {isSearchOpen && searchQuery.trim().length > 1 && (
              <div 
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-xl)',
                  border: '1px solid var(--border-color)',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 50,
                  padding: '0.5rem'
                }}
              >
                {matchedCustomers.length === 0 && matchedOrders.length === 0 && matchedGarments.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: 'var(--text-sm)' }}>
                    No results found for "{searchQuery}".
                  </div>
                ) : (
                  <>
                    {matchedCustomers.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', padding: '4px 8px' }}>
                          Customers
                        </div>
                        {matchedCustomers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c.id)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{c.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>{c.phone} • {c.address}</div>
                            </div>
                            <span className="badge badge-info" style={{ fontSize: '10px' }}>{c.totalOrders} Orders</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {matchedOrders.length > 0 && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', padding: '4px 8px' }}>
                          Orders
                        </div>
                        {matchedOrders.map(o => (
                          <div
                            key={o.id}
                            onClick={() => handleSelectOrder(o.id)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="tag-mono">{o.orderNumber}</span>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{o.customerName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>₹{o.totalAmount}</span>
                              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>{o.overallStage}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {matchedGarments.length > 0 && (
                      <div>
                        <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', padding: '4px 8px' }}>
                          Garment Tags
                        </div>
                        {matchedGarments.map(g => (
                          <div
                            key={g.garmentTag}
                            onClick={() => handleSelectGarment(g.garmentTag)}
                            style={{
                              padding: '0.5rem 0.75rem',
                              borderRadius: 'var(--radius-md)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--slate-50)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span className="tag-mono">{g.garmentTag}</span>
                              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{g.garmentName}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
                              {g.customerName} ({g.orderNumber})
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions & Role Switcher */}
        <div className="topbar-right">
          {/* Quick Barcode Scanner Button */}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setIsQRModalOpen(true)}
            title="Scan Garment QR / Barcode"
          >
            <Scan size={16} />
            <span>Scan Tag</span>
          </button>

          {/* Role Switcher */}
          <div style={{ position: 'relative' }}>
            <div 
              className="role-switcher-dropdown"
              onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            >
              <UserCheck size={14} color="var(--primary-600)" />
              <span>Role: <strong style={{ color: 'var(--slate-900)' }}>{roles.find(r => r.key === currentRole)?.label}</strong></span>
              <ChevronDown size={14} />
            </div>

            {isRoleDropdownOpen && (
              <div 
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '260px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-xl)',
                  border: '1px solid var(--border-color)',
                  zIndex: 50,
                  padding: '0.4rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.2rem'
                }}
              >
                <div style={{ padding: '0.4rem 0.6rem', fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                  Switch Operational Persona
                </div>
                {roles.map(r => {
                  const Icon = r.icon;
                  const isActive = currentRole === r.key;
                  return (
                    <div
                      key={r.key}
                      onClick={() => {
                        setCurrentRole(r.key);
                        setIsRoleDropdownOpen(false);
                      }}
                      style={{
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                        border: isActive ? '1px solid var(--primary-200)' : '1px solid transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--slate-50)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ color: isActive ? 'var(--primary)' : 'var(--slate-500)' }}>
                        <Icon size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--slate-900)' }}>
                          {r.label}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--slate-500)' }}>
                          {r.desc}
                        </div>
                      </div>
                      {isActive && <CheckCircle size={14} color="var(--primary)" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div style={{ position: 'relative' }}>
            <button 
              className="topbar-icon-btn" 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              title="Notifications"
            >
              <Bell size={18} />
              {unreadNotifs > 0 && <span className="badge-dot-indicator" />}
            </button>
            <NotificationCenter isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
          </div>

          {/* Current User & Branch */}
          <div className="topbar-user-profile">
            <div className="user-avatar">{currentUser.avatar}</div>
            <div className="user-info">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role-label">{currentUser.branch.split(',')[0]}</span>
            </div>
          </div>
        </div>
      </header>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        onScanResult={handleScanResult}
      />
    </>
  );
};
