import React from 'react';
import { useStore } from '../../store';
import { 
  Bell, 
  AlertTriangle, 
  PackageX, 
  CreditCard, 
  AlertCircle, 
  Truck, 
  Check, 
  ArrowRight,
  X
} from 'lucide-react';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { notifications, markNotificationRead, setActiveView, setSelectedOrderId, setSelectedGarmentTag } = useStore();

  if (!isOpen) return null;

  const handleAction = (notif: typeof notifications[0]) => {
    markNotificationRead(notif.id);
    if (notif.actionView) {
      setActiveView(notif.actionView);
      if (notif.entityId?.startsWith('ord-')) {
        setSelectedOrderId(notif.entityId);
      } else if (notif.entityId?.startsWith('GAR-')) {
        setSelectedGarmentTag(notif.entityId);
      }
    }
    onClose();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'delayed_order': return <AlertTriangle size={18} color="var(--danger)" />;
      case 'low_stock': return <PackageX size={18} color="var(--warning)" />;
      case 'qc_issue': return <AlertCircle size={18} color="var(--danger)" />;
      case 'pending_payment': return <CreditCard size={18} color="var(--warning)" />;
      default: return <Bell size={18} color="var(--primary)" />;
    }
  };

  return (
    <div 
      style={{
        position: 'absolute',
        top: 'calc(var(--topbar-height) + 8px)',
        right: '1.5rem',
        width: '380px',
        maxWidth: '92vw',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-color)',
        zIndex: 50,
        overflow: 'hidden'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--slate-50)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={18} color="var(--slate-700)" />
          <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--slate-900)' }}>
            Operational Alerts
          </span>
          <span className="badge badge-danger" style={{ fontSize: '10px' }}>
            {notifications.filter(n => !n.read).length} Active
          </span>
        </div>
        <button className="btn-icon-sm btn-ghost" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--slate-400)' }}>
            No active operational alerts.
          </div>
        ) : (
          notifications.map(notif => (
            <div
              key={notif.id}
              onClick={() => handleAction(notif)}
              style={{
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '0.35rem',
                backgroundColor: notif.read ? '#FFFFFF' : 'var(--primary-50)',
                border: '1px solid',
                borderColor: notif.read ? 'var(--border-color)' : 'var(--primary-200)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                display: 'flex',
                gap: '0.75rem'
              }}
            >
              <div style={{ marginTop: '2px', flexShrink: 0 }}>
                {getIcon(notif.type)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--slate-900)' }}>
                    {notif.title}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--slate-400)' }}>{notif.timestamp}</span>
                </div>
                <p style={{ fontSize: '11.5px', color: 'var(--slate-600)', lineHeight: 1.35, marginBottom: '6px' }}>
                  {notif.message}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '11px', color: 'var(--primary-700)', fontWeight: 600 }}>
                  <span>Open {notif.actionView || 'details'}</span>
                  <ArrowRight size={12} />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{
        padding: '0.65rem 1rem',
        borderTop: '1px solid var(--border-color)',
        backgroundColor: 'var(--slate-50)',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--slate-500)' }}>
          Real-time webhook sync active
        </span>
      </div>
    </div>
  );
};
