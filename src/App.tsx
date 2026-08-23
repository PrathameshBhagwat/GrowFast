import React from 'react';
import { StoreProvider, useStore } from './store';
import { Sidebar } from './components/common/Sidebar';
import { TopBar } from './components/common/TopBar';

// Views
import { NewOrderPOSView } from './views/NewOrderPOSView';
import { DashboardView } from './views/DashboardView';
import { OrdersListView } from './views/OrdersListView';
import { OrderDetailView } from './views/OrderDetailView';
import { CustomersView } from './views/CustomersView';
import { ProcessingQueueView } from './views/ProcessingQueueView';
import { GarmentTrackingView } from './views/GarmentTrackingView';
import { PackingView } from './views/PackingView';
import { ExpensesView } from './views/ExpensesView';
import { InventoryView } from './views/InventoryView';
import { PricingSettingsView } from './views/PricingSettingsView';
import { AnalyticsView } from './views/AnalyticsView';
import { DeliveryDispatchView } from './views/DeliveryDispatchView';

const AppContent: React.FC = () => {
  const { activeView } = useStore();

  const renderCurrentView = () => {
    switch (activeView) {
      case 'pos':
        return <NewOrderPOSView />;
      case 'dashboard':
        return <DashboardView />;
      case 'orders':
        return <OrdersListView />;
      case 'order-detail':
        return <OrderDetailView />;
      case 'customers':
      case 'customer-detail':
        return <CustomersView />;
      case 'processing':
      case 'qc':
        return <ProcessingQueueView />;
      case 'garment-tracking':
        return <GarmentTrackingView />;
      case 'packing':
        return <PackingView />;
      case 'expenses':
        return <ExpensesView />;
      case 'inventory':
        return <InventoryView />;
      case 'pricing':
        return <PricingSettingsView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'delivery':
        return <DeliveryDispatchView />;
      default:
        return <NewOrderPOSView />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <TopBar />
        <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

export default App;
