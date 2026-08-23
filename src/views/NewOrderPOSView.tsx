import React, { useState } from 'react';
import { Customer, GarmentDefinition, Order, OrderItem, PaymentMethod } from '../types';
import { useStore } from '../store';
import { CustomerSelector } from '../components/pos/CustomerSelector';
import { GarmentCategoryGrid } from '../components/pos/GarmentCategoryGrid';
import { GarmentDetailDrawer } from '../components/pos/GarmentDetailDrawer';
import { OrderSummarySidebar } from '../components/pos/OrderSummarySidebar';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ThermalReceiptModal } from '../components/common/ThermalReceiptModal';
import { CheckCircle2, ShoppingBag } from 'lucide-react';

export const NewOrderPOSView: React.FC = () => {
  const { customers, createOrder, setSelectedOrderId, setActiveView } = useStore();

  // Selected customer (default to first customer Rahul Patil for fast demo flow)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(customers[0] || null);
  
  // Current active draft items
  const [draftItems, setDraftItems] = useState<OrderItem[]>([]);
  
  // Active drawer garment
  const [activeGarmentForDrawer, setActiveGarmentForDrawer] = useState<GarmentDefinition | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [billSummary, setBillSummary] = useState<{
    subtotal: number;
    discountAmount: number;
    discountType: 'flat' | 'percentage';
    expressSurcharge: number;
    taxAmount: number;
    totalAmount: number;
  }>({
    subtotal: 0,
    discountAmount: 0,
    discountType: 'flat',
    expressSurcharge: 0,
    taxAmount: 0,
    totalAmount: 0
  });

  // Receipt modal after order completion
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const handleSelectGarment = (garment: GarmentDefinition) => {
    setActiveGarmentForDrawer(garment);
    setIsDrawerOpen(true);
  };

  const handleAddItemToDraft = (newItem: OrderItem) => {
    setDraftItems(prev => [...prev, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    setDraftItems(prev => prev.filter(i => i.id !== itemId));
  };

  const handleClearDraft = () => {
    setDraftItems([]);
  };

  const handleProceedToPayment = (summary: typeof billSummary) => {
    setBillSummary(summary);
    setIsPaymentModalOpen(true);
  };

  const handleConfirmOrder = (paymentDetails: {
    paidAmount: number;
    balanceAmount: number;
    paymentMethod: PaymentMethod;
    paymentStatus: 'paid' | 'partial' | 'pending';
    reference?: string;
  }) => {
    if (!selectedCustomer) return;

    const totalGarmentCount = draftItems.reduce((acc, i) => acc + i.quantity, 0);
    const hasExpress = draftItems.some(i => i.expressService) || billSummary.expressSurcharge > 0;

    // Generate Order Number
    const orderNumber = `ORD-${Math.floor(8720 + Math.random() * 100)}`;
    const promisedDate = new Date();
    promisedDate.setDate(promisedDate.getDate() + (hasExpress ? 1 : 2));

    const newOrder = createOrder({
      orderNumber,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerAddress: selectedCustomer.address,
      promisedDeliveryDate: promisedDate.toISOString(),
      items: draftItems,
      itemCount: totalGarmentCount,
      subtotal: billSummary.subtotal,
      discountAmount: billSummary.discountAmount,
      discountType: billSummary.discountType,
      expressSurcharge: billSummary.expressSurcharge,
      taxAmount: billSummary.taxAmount,
      totalAmount: billSummary.totalAmount,
      paidAmount: paymentDetails.paidAmount,
      balanceAmount: paymentDetails.balanceAmount,
      paymentStatus: paymentDetails.paymentStatus,
      paymentMethod: paymentDetails.paymentMethod,
      overallStage: 'received',
      priority: hasExpress ? 'express' : 'standard',
      deliveryType: 'store_pickup',
      paymentHistory: paymentDetails.paidAmount > 0 ? [
        {
          id: `pay-${Date.now()}`,
          amount: paymentDetails.paidAmount,
          method: paymentDetails.paymentMethod,
          timestamp: new Date().toISOString(),
          reference: paymentDetails.reference,
          recordedBy: 'Swapnil Shinde'
        }
      ] : []
    });

    setIsPaymentModalOpen(false);
    setDraftItems([]);
    setCompletedOrder(newOrder);
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="pos-layout">
      {/* Left Main POS Workstation Panel */}
      <div className="pos-main-panel">
        {/* Customer Quick Bar */}
        <CustomerSelector
          selectedCustomer={selectedCustomer}
          onSelectCustomer={setSelectedCustomer}
        />

        {/* Garment Categories & Garment Items Grid */}
        <GarmentCategoryGrid onSelectGarment={handleSelectGarment} />
      </div>

      {/* Right Live Order Summary Panel */}
      <OrderSummarySidebar
        customer={selectedCustomer}
        items={draftItems}
        onRemoveItem={handleRemoveItem}
        onClearDraft={handleClearDraft}
        onProceedToPayment={handleProceedToPayment}
      />

      {/* Garment Configuration Progressive Drawer */}
      <GarmentDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        garment={activeGarmentForDrawer}
        onAddItem={handleAddItemToDraft}
      />

      {/* Payment Processing Modal */}
      {selectedCustomer && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          customer={selectedCustomer}
          items={draftItems}
          subtotal={billSummary.subtotal}
          discountAmount={billSummary.discountAmount}
          discountType={billSummary.discountType}
          expressSurcharge={billSummary.expressSurcharge}
          taxAmount={billSummary.taxAmount}
          totalAmount={billSummary.totalAmount}
          onConfirmOrder={handleConfirmOrder}
        />
      )}

      {/* Thermal Receipt Print Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          if (completedOrder) {
            setSelectedOrderId(completedOrder.id);
            setActiveView('order-detail');
          }
        }}
        order={completedOrder}
      />
    </div>
  );
};
