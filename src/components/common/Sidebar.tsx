import React from 'react';
import { useStore } from '../../store';
import { 
  PlusCircle, 
  ShoppingBag, 
  Users, 
  Sparkles, 
  CheckSquare, 
  Package, 
  LayoutDashboard, 
  BarChart3, 
  Receipt, 
  Boxes, 
  Tags, 
  Truck, 
  Scan,
  Store,
  ChevronRight
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { currentRole, activeView, setActiveView, orders, inventory, notifications } = useStore();

  const delayedOrdersCount = orders.filter(o => o.isDelayed).length;
  const lowStockCount = inventory.filter(i => i.currentStock <= i.lowStockThreshold).length;

  interface NavItem {
    id: string;
    label: string;
    icon: any;
    badge?: number | string;
    badgeType?: 'danger' | 'warning' | 'info';
  }

  interface NavGroup {
    groupTitle: string;
    items: NavItem[];
  }

  const getRoleNavGroups = (): NavGroup[] => {
    switch (currentRole) {
      case 'counter':
        return [
          {
            groupTitle: 'Counter Operations',
            items: [
              { id: 'pos', label: 'New Order (POS)', icon: PlusCircle },
              { id: 'orders', label: 'Orders List', icon: ShoppingBag, badge: delayedOrdersCount ? `${delayedOrdersCount} Late` : undefined, badgeType: 'danger' },
              { id: 'customers', label: 'Customers CRM', icon: Users },
              { id: 'garment-tracking', label: 'Garment Tag Lookup', icon: Scan },
              { id: 'dashboard', label: 'Counter Summary', icon: LayoutDashboard }
            ]
          }
        ];

      case 'processing':
        return [
          {
            groupTitle: 'Workshop Stages',
            items: [
              { id: 'processing', label: 'Work Queue', icon: Sparkles },
              { id: 'qc', label: 'Quality Control (QC)', icon: CheckSquare, badge: '1 Flag' },
              { id: 'packing', label: 'Packing & Racking', icon: Package },
              { id: 'garment-tracking', label: 'Scan & Track Tag', icon: Scan },
              { id: 'orders', label: 'Orders Status', icon: ShoppingBag }
            ]
          }
        ];

      case 'rider':
        return [
          {
            groupTitle: 'Fleet Dispatch',
            items: [
              { id: 'delivery', label: 'Pickup & Delivery', icon: Truck, badge: '3 Tasks' },
              { id: 'orders', label: 'Assigned Orders', icon: ShoppingBag },
              { id: 'customers', label: 'Customer Directory', icon: Users }
            ]
          }
        ];

      case 'manager':
      default:
        return [
          {
            groupTitle: 'Store Operations',
            items: [
              { id: 'dashboard', label: 'Manager Overview', icon: LayoutDashboard },
              { id: 'pos', label: 'Counter POS Intake', icon: PlusCircle },
              { id: 'orders', label: 'All Orders', icon: ShoppingBag, badge: delayedOrdersCount || undefined, badgeType: 'danger' },
              { id: 'processing', label: 'Processing Pipeline', icon: Sparkles },
              { id: 'delivery', label: 'Delivery Dispatch', icon: Truck }
            ]
          },
          {
            groupTitle: 'Business & Finance',
            items: [
              { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
              { id: 'customers', label: 'Customer Directory', icon: Users },
              { id: 'expenses', label: 'Expense Ledger', icon: Receipt },
              { id: 'inventory', label: 'Inventory & Stock', icon: Boxes, badge: lowStockCount ? `${lowStockCount} Low` : undefined, badgeType: 'warning' },
              { id: 'pricing', label: 'Service & Pricing Matrix', icon: Tags }
            ]
          }
        ];
    }
  };

  const navGroups = getRoleNavGroups();

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-logo">
          <div className="brand-icon-box">
            <Sparkles size={20} />
          </div>
          <div className="brand-name">
            <span>TumbleDry</span>
            <span className="brand-sub">Koregaon Park</span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav-container">
        {navGroups.map((group, gIdx) => (
          <div key={gIdx} className="sidebar-group">
            <div className="sidebar-group-title">{group.groupTitle}</div>
            <ul className="sidebar-nav-list">
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <li key={item.id}>
                    <div
                      className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveView(item.id)}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className={`nav-badge ${item.badgeType || ''}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer Store Info */}
      <div className="sidebar-footer">
        <div className="store-badge-box">
          <Store size={18} color="var(--primary-400)" />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: '#FFFFFF' }}>
              Store #PUN-04
            </span>
            <span style={{ fontSize: '10px', color: 'var(--slate-400)' }}>
              Online • Cloud Sync Active
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};
