import React, { createContext, useContext, useState } from 'react';
import { 
  Customer, 
  GarmentDefinition, 
  Order, 
  ServiceDefinition, 
  InventoryItem, 
  ExpenseItem, 
  NotificationItem, 
  AuditLog, 
  DeliveryTask, 
  User, 
  UserRole,
  ProcessingStage,
  PaymentMethod,
  CustomerPreference,
  ServiceType
} from '../types';
import { 
  mockCustomers, 
  mockGarments, 
  mockOrders, 
  mockServices, 
  mockExpenses, 
  mockInventory, 
  mockNotifications, 
  mockAuditLogs, 
  mockDeliveryTasks, 
  mockUsers 
} from './mockData';

interface StoreContextType {
  // Navigation & Role
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: User;
  activeView: string;
  setActiveView: (view: string) => void;
  
  // Selection States
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  selectedGarmentTag: string | null;
  setSelectedGarmentTag: (tag: string | null) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;

  // Active Data
  customers: Customer[];
  orders: Order[];
  garments: GarmentDefinition[];
  services: ServiceDefinition[];
  expenses: ExpenseItem[];
  inventory: InventoryItem[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  deliveryTasks: DeliveryTask[];

  // Action Methods
  createOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Order;
  updateOrderStatus: (orderId: string, stage: ProcessingStage) => void;
  updateGarmentStatus: (garmentTag: string, stage: ProcessingStage, rackLocation?: string, bagId?: string) => void;
  recordQCResult: (garmentTag: string, status: 'passed' | 'rework' | 'issue', notes?: string, reason?: string) => void;
  packOrder: (orderId: string, rackLocation: string, bagId: string) => void;
  recordPayment: (orderId: string, amount: number, method: PaymentMethod, reference?: string) => void;
  addCustomer: (customerData: Partial<Customer>) => Customer;
  updateCustomerPreferences: (customerId: string, prefs: CustomerPreference) => void;
  addExpense: (expenseData: Omit<ExpenseItem, 'id'>) => void;
  updateInventoryStock: (itemId: string, newStock: number) => void;
  reorderInventoryItem: (itemId: string) => void;
  updateGarmentServicePrice: (garmentId: string, service: ServiceType, price: number) => void;
  markNotificationRead: (notifId: string) => void;
  addAuditLog: (action: string, details: string, orderNumber?: string, garmentTag?: string) => void;
  updateDeliveryTaskStatus: (taskId: string, status: DeliveryTask['status']) => void;
}

const StoreContext = createContext<StoreContextType | null>(null);

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRole, setCurrentRoleState] = useState<UserRole>('counter');
  const [activeView, setActiveView] = useState<string>('pos');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>('ord-8721');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>('cust-1');
  const [selectedGarmentTag, setSelectedGarmentTag] = useState<string | null>('GAR-8721-03');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const [customers, setCustomers] = useState<Customer[]>(mockCustomers);
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [garments, setGarments] = useState<GarmentDefinition[]>(mockGarments);
  const [services] = useState<ServiceDefinition[]>(mockServices);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(mockExpenses);
  const [inventory, setInventory] = useState<InventoryItem[]>(mockInventory);
  const [notifications, setNotifications] = useState<NotificationItem[]>(mockNotifications);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(mockAuditLogs);
  const [deliveryTasks, setDeliveryTasks] = useState<DeliveryTask[]>(mockDeliveryTasks);

  const currentUser = mockUsers[currentRole];

  const setCurrentRole = (role: UserRole) => {
    setCurrentRoleState(role);
    if (role === 'counter') setActiveView('pos');
    else if (role === 'manager') setActiveView('dashboard');
    else if (role === 'processing') setActiveView('processing');
    else if (role === 'rider') setActiveView('delivery');
  };

  const addAuditLog = (action: string, details: string, orderNumber?: string, garmentTag?: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      staffName: currentUser.name,
      staffRole: currentRole,
      action,
      orderNumber,
      garmentTag,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const createOrder = (orderData: Omit<Order, 'id' | 'createdAt'>): Order => {
    const newId = `ord-${Date.now().toString().slice(-4)}`;
    const newOrder: Order = {
      ...orderData,
      id: newId,
      createdAt: new Date().toISOString()
    };

    setOrders(prev => [newOrder, ...prev]);

    // Update customer stats
    setCustomers(prev => prev.map(c => {
      if (c.id === newOrder.customerId) {
        return {
          ...c,
          totalOrders: c.totalOrders + 1,
          totalSpend: c.totalSpend + newOrder.totalAmount,
          averageOrderValue: Math.round((c.totalSpend + newOrder.totalAmount) / (c.totalOrders + 1)),
          pendingBalance: c.pendingBalance + newOrder.balanceAmount,
          recentOrderIds: [newOrder.orderNumber, ...c.recentOrderIds].slice(0, 5)
        };
      }
      return c;
    }));

    addAuditLog(
      'Order Created',
      `Created ${newOrder.orderNumber} with ${newOrder.itemCount} items for ${newOrder.customerName}. Total: ₹${newOrder.totalAmount}`,
      newOrder.orderNumber
    );

    return newOrder;
  };

  const updateOrderStatus = (orderId: string, stage: ProcessingStage) => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId || o.orderNumber === orderId) {
        return {
          ...o,
          overallStage: stage,
          items: o.items.map(item => ({
            ...item,
            individualGarments: item.individualGarments.map(g => ({
              ...g,
              stage: stage
            }))
          }))
        };
      }
      return o;
    }));

    addAuditLog('Order Status Updated', `Order ${orderId} moved to stage: ${stage.toUpperCase()}`, orderId);
  };

  const updateGarmentStatus = (
    garmentTag: string, 
    stage: ProcessingStage, 
    rackLocation?: string, 
    bagId?: string
  ) => {
    setOrders(prev => prev.map(order => {
      let hasGarment = false;
      const updatedItems = order.items.map(item => {
        const updatedIndiv = item.individualGarments.map(g => {
          if (g.garmentTag.toLowerCase() === garmentTag.toLowerCase()) {
            hasGarment = true;
            return {
              ...g,
              stage,
              rackLocation: rackLocation || g.rackLocation,
              bagId: bagId || g.bagId
            };
          }
          return g;
        });
        return { ...item, individualGarments: updatedIndiv };
      });

      if (hasGarment) {
        // If all garments in order reached this stage, update order overallStage
        const allGarments = updatedItems.flatMap(i => i.individualGarments);
        const allInStage = allGarments.every(g => g.stage === stage);
        return {
          ...order,
          overallStage: allInStage ? stage : order.overallStage,
          items: updatedItems
        };
      }
      return order;
    }));

    addAuditLog('Garment Status Updated', `Garment ${garmentTag} moved to ${stage.toUpperCase()}`, undefined, garmentTag);
  };

  const recordQCResult = (
    garmentTag: string, 
    status: 'passed' | 'rework' | 'issue', 
    notes?: string, 
    reason?: string
  ) => {
    setOrders(prev => prev.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        individualGarments: item.individualGarments.map(g => {
          if (g.garmentTag.toLowerCase() === garmentTag.toLowerCase()) {
            return {
              ...g,
              qcStatus: status,
              qcNotes: notes || g.qcNotes,
              qcIssueReason: reason || g.qcIssueReason,
              stage: status === 'passed' ? 'packed' : 'quality_check'
            };
          }
          return g;
        })
      }))
    })));

    addAuditLog(
      `QC ${status.toUpperCase()}`,
      `Garment ${garmentTag} QC recorded as ${status.toUpperCase()}${reason ? ` (${reason})` : ''}`,
      undefined,
      garmentTag
    );
  };

  const packOrder = (orderId: string, rackLocation: string, bagId: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId || order.orderNumber === orderId) {
        return {
          ...order,
          overallStage: 'ready',
          rackLocation,
          bagId,
          items: order.items.map(item => ({
            ...item,
            individualGarments: item.individualGarments.map(g => ({
              ...g,
              stage: 'ready',
              rackLocation,
              bagId
            }))
          }))
        };
      }
      return order;
    }));

    addAuditLog(
      'Order Packed & Ready',
      `Order ${orderId} packed in ${bagId} and assigned to Rack ${rackLocation}`,
      orderId
    );
  };

  const recordPayment = (
    orderId: string, 
    amount: number, 
    method: PaymentMethod, 
    reference?: string
  ) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId || order.orderNumber === orderId) {
        const newPaid = order.paidAmount + amount;
        const newBalance = Math.max(0, order.totalAmount - newPaid);
        const newStatus = newBalance === 0 ? 'paid' : 'partial';

        return {
          ...order,
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
          paymentHistory: [
            ...order.paymentHistory,
            {
              id: `pay-${Date.now()}`,
              amount,
              method,
              timestamp: new Date().toISOString(),
              reference: reference || `${method.toUpperCase()}-TXN-${Math.floor(100000 + Math.random() * 900000)}`,
              recordedBy: currentUser.name
            }
          ]
        };
      }
      return order;
    }));

    addAuditLog('Payment Collected', `Collected ₹${amount} via ${method.toUpperCase()} for order ${orderId}`, orderId);
  };

  const addCustomer = (customerData: Partial<Customer>): Customer => {
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: customerData.name || 'New Customer',
      phone: customerData.phone || '',
      email: customerData.email,
      address: customerData.address,
      landmark: customerData.landmark,
      customerSince: 'Just now',
      totalOrders: 0,
      totalSpend: 0,
      averageOrderValue: 0,
      pendingBalance: 0,
      tags: ['New'],
      preferences: customerData.preferences || {
        fragrance: 'standard',
        starch: 'none',
        foldPreference: 'folded'
      },
      recentOrderIds: []
    };

    setCustomers(prev => [newCust, ...prev]);
    addAuditLog('Customer Registered', `Created customer profile for ${newCust.name} (${newCust.phone})`);
    return newCust;
  };

  const updateCustomerPreferences = (customerId: string, prefs: CustomerPreference) => {
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, preferences: prefs } : c));
    addAuditLog('Preferences Updated', `Updated garment & delivery preferences for customer ID ${customerId}`);
  };

  const addExpense = (expenseData: Omit<ExpenseItem, 'id'>) => {
    const newExp: ExpenseItem = {
      ...expenseData,
      id: `exp-${Date.now()}`
    };
    setExpenses(prev => [newExp, ...prev]);
    addAuditLog('Expense Logged', `Recorded ₹${newExp.amount} for ${newExp.category} (${newExp.description})`);
  };

  const updateInventoryStock = (itemId: string, newStock: number) => {
    setInventory(prev => prev.map(item => item.id === itemId ? { ...item, currentStock: newStock } : item));
    addAuditLog('Inventory Adjusted', `Stock for item ${itemId} adjusted to ${newStock}`);
  };

  const reorderInventoryItem = (itemId: string) => {
    setInventory(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          currentStock: item.currentStock + item.reorderQuantity,
          lastRestocked: new Date().toISOString().split('T')[0]
        };
      }
      return item;
    }));
    addAuditLog('Inventory Restocked', `Auto-reordered item ${itemId}`);
  };

  const updateGarmentServicePrice = (garmentId: string, service: ServiceType, price: number) => {
    setGarments(prev => prev.map(g => {
      if (g.id === garmentId) {
        const existing = g.baseServices.find(s => s.service === service);
        if (existing) {
          return {
            ...g,
            baseServices: g.baseServices.map(s => s.service === service ? { ...s, price } : s)
          };
        } else {
          return {
            ...g,
            baseServices: [...g.baseServices, { service, price }]
          };
        }
      }
      return g;
    }));
    addAuditLog('Pricing Matrix Changed', `Updated ${garmentId} ${service} price to ₹${price}`);
  };

  const markNotificationRead = (notifId: string) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const updateDeliveryTaskStatus = (taskId: string, status: DeliveryTask['status']) => {
    setDeliveryTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    addAuditLog('Delivery Task Updated', `Delivery task ${taskId} marked as ${status.toUpperCase()}`);
  };

  return (
    <StoreContext.Provider value={{
      currentRole,
      setCurrentRole,
      currentUser,
      activeView,
      setActiveView,
      selectedOrderId,
      setSelectedOrderId,
      selectedCustomerId,
      setSelectedCustomerId,
      selectedGarmentTag,
      setSelectedGarmentTag,
      globalSearchQuery,
      setGlobalSearchQuery,
      customers,
      orders,
      garments,
      services,
      expenses,
      inventory,
      notifications,
      auditLogs,
      deliveryTasks,
      createOrder,
      updateOrderStatus,
      updateGarmentStatus,
      recordQCResult,
      packOrder,
      recordPayment,
      addCustomer,
      updateCustomerPreferences,
      addExpense,
      updateInventoryStock,
      reorderInventoryItem,
      updateGarmentServicePrice,
      markNotificationRead,
      addAuditLog,
      updateDeliveryTaskStatus
    }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
