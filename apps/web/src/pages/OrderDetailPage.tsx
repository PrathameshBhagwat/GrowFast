import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  StatusChip,
  LoadingState,
  ErrorState,
  PhotoCapture,
  Modal,
} from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  OrderDetailDTO,
  OrderItemDTO,
  Role,
  AdjustmentType,
  PhotoType,
  OrderStatus,
  calculateOrderTotals,
} from '@growfast/shared-types';
import { OrderItemEditModal } from '../components/OrderItemEditModal';
import { DueDateEditModal } from '../components/DueDateEditModal';
import { PaymentModal } from '../components/PaymentModal';
import { FinancialAdjustmentModal } from '../components/FinancialAdjustmentModal';
import { OrderPickupModal } from '../components/OrderPickupModal';
import { OrderReceiptModal } from '../components/OrderReceiptModal';
import {
  ArrowLeft,
  Edit2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Camera,
  CheckCircle,
  CheckCircle2,
  Loader2,
  Circle,
  Check,
  Send,
  Plus,
  Ban,
  PackageCheck,
  Printer,
  X,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function OrderDetailPage() {
  const { orderId: id } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { token, employee } = useAuth();

  const [order, setOrder] = useState<OrderDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editItem, setEditItem] = useState<OrderItemDTO | null>(null);
  const [editDueDate, setEditDueDate] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activePhotoCapture, setActivePhotoCapture] = useState<{
    itemId: string;
    garmentId: string;
  } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [updatingGarmentId, setUpdatingGarmentId] = useState<string | null>(null);
  const [addingGarmentItemId, setAddingGarmentItemId] = useState<string | null>(null);
  const [garmentToCancel, setGarmentToCancel] = useState<{
    itemId: string;
    garmentId: string;
    unitNumber: number;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [cancelAdjustmentType, setCancelAdjustmentType] = useState<AdjustmentType>(
    AdjustmentType.REFUND,
  );
  const [cancelAdjustmentReason, setCancelAdjustmentReason] = useState<string>('');
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  const [isNotifying, setIsNotifying] = useState(false);
  const [notificationFeedback, setNotificationFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const isAuthorizedForPickup = employee?.role === Role.OWNER || employee?.role === Role.COUNTER;

  const eligiblePickupCount =
    order && order.pickupType === 'STORE_PICKUP'
      ? (order.items || []).reduce((sum, item) => {
          if (item.physicalGarments && item.physicalGarments.length > 0) {
            return (
              sum +
              item.physicalGarments.filter((g) => !g.isCancelled && !g.isDelivered && g.isReady)
                .length
            );
          }
          if (item.itemStatus !== 'CANCELLED') {
            return sum + Math.max(0, item.quantity - (item.deliveredQuantity || 0));
          }
          return sum;
        }, 0)
      : 0;

  const handleAddGarment = async (itemId: string) => {
    setAddingGarmentItemId(itemId);
    setNotificationFeedback(null);
    try {
      const res = await fetch(`${API_URL}/orders/${id}/items/${itemId}/garments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to add garment');
      }
      await fetchOrder();
      setNotificationFeedback({
        type: 'success',
        message: 'Physical garment piece added successfully.',
      });
    } catch (err: any) {
      setNotificationFeedback({
        type: 'error',
        message: err.message || 'Failed to add garment',
      });
    } finally {
      setAddingGarmentItemId(null);
    }
  };

  const handleConfirmCancelGarment = async () => {
    if (!garmentToCancel || !order) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const cancellingItem = order.items.find((i) => i.id === garmentToCancel.itemId);
      let requiresAdjustment = false;
      let excessAmount = 0;
      if (cancellingItem) {
        const pricingInputs = order.items.map((i) => ({
          unitPrice: i.unitPrice,
          quantity: i.id === cancellingItem.id ? Math.max(0, i.quantity - 1) : i.quantity,
        }));
        const newTotals = calculateOrderTotals(pricingInputs, {
          isExpress: order.isExpress,
          expressSurchargePercent:
            (order.expressSurcharge || 0) > 0 && order.subtotal > 0
              ? ((order.expressSurcharge || 0) / order.subtotal) * 100
              : undefined,
        });
        const currentEffectivePaid =
          order.effectivePaid ??
          Number(
            (order.amountPaid - (order.refundAmount || 0) - (order.storeCreditAmount || 0)).toFixed(
              2,
            ),
          );
        if (newTotals.totalAmount < currentEffectivePaid) {
          requiresAdjustment = true;
          excessAmount = Number((currentEffectivePaid - newTotals.totalAmount).toFixed(2));
        }
      }

      const body: any = {};
      if (requiresAdjustment) {
        if (employee?.role !== Role.OWNER) {
          throw new Error(
            'Only a Store Owner can authorize financial adjustments for cancelled garments.',
          );
        }
        body.adjustment = {
          type: cancelAdjustmentType,
          amount: excessAmount,
          reason:
            cancelAdjustmentReason.trim() || `Cancelled Garment #${garmentToCancel.unitNumber}`,
        };
      }

      const res = await fetch(
        `${API_URL}/orders/${id}/items/${garmentToCancel.itemId}/garments/${garmentToCancel.garmentId}/cancel`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Failed to cancel garment');
      }
      if (data.data) {
        setOrder(data.data);
      }
      const unitNum = garmentToCancel.unitNumber;
      setGarmentToCancel(null);
      setCancelAdjustmentReason('');
      fetchOrder(true).catch(() => {});
      setNotificationFeedback({
        type: 'success',
        message: `Garment #${unitNum} cancelled successfully.`,
      });
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel garment');
    } finally {
      setIsCancelling(false);
    }
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleGarmentReadyToggle = async (itemId: string, garmentId: string, isReady: boolean) => {
    setUpdatingGarmentId(garmentId);
    try {
      const res = await fetch(
        `${API_URL}/orders/${id}/items/${itemId}/garments/${garmentId}/ready`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ isReady }),
        },
      );
      if (!res.ok) throw new Error('Failed to update garment readiness');
      await fetchOrder(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingGarmentId(null);
    }
  };

  const handleNotifyPartialReady = async () => {
    if (isNotifying || !id || !token) return;
    setIsNotifying(true);
    setNotificationFeedback(null);
    try {
      const res = await fetch(`${API_URL}/orders/${id}/notify-partial-ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send readiness notification');
      }
      setNotificationFeedback({
        type: 'success',
        message: 'Readiness notification sent to customer.',
      });
      setTimeout(() => setNotificationFeedback(null), 5000);
    } catch (err: any) {
      setNotificationFeedback({
        type: 'error',
        message: err.message || 'Failed to send notification',
      });
    } finally {
      setIsNotifying(false);
    }
  };

  const handlePhotoCapture = async (file: File) => {
    if (!activePhotoCapture) return;
    setUploadingPhoto(true);
    try {
      const { uploadPhoto } = await import('../services/photo.api');
      await uploadPhoto(
        token!,
        file,
        order!.id,
        PhotoType.FRONT,
        activePhotoCapture.itemId,
        activePhotoCapture.garmentId,
      );
      await fetchOrder(true); // Refetch to see the new photo
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      setActivePhotoCapture(null);
    }
  };

  const fetchOrder = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch(`${API_URL}/orders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch order (${res.status})`);
      }

      const body = await res.json();
      setOrder(body.data);
      if (body.data?.items) {
        const itemIds = body.data.items
          .filter((i: any) => i.physicalGarments && i.physicalGarments.length > 0)
          .map((i: any) => i.id);
        setExpandedItems((prev) => (prev.size === 0 ? new Set(itemIds) : prev));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (id && token) {
      fetchOrder();
    }
  }, [id, token]);

  if (loading) return <LoadingState message="Loading order details..." />;
  if (error) return <ErrorState message={error} onRetry={fetchOrder} />;
  if (!order) return <ErrorState message="Order not found" />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4">
      <Button variant="ghost" onClick={() => navigate('/orders')} icon={<ArrowLeft size={16} />}>
        Back to Orders
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{order.orderNumber}</h1>
          <div className="flex gap-2">
            <StatusChip status={order.status} />
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
              {order.paymentStatus}
            </span>
            {order.isExpress && (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800 border border-red-200">
                EXPRESS
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {order.pickupType === 'STORE_PICKUP' &&
            isAuthorizedForPickup &&
            eligiblePickupCount > 0 && (
              <Button
                variant="primary"
                id="counter-handover-btn"
                onClick={() => setShowPickupModal(true)}
                style={{ minHeight: '44px' }}
                className="min-h-[44px] font-bold shadow-sm"
                icon={<PackageCheck size={18} />}
              >
                Counter Handover ({eligiblePickupCount} Ready)
              </Button>
            )}
          <Button
            variant="outline"
            id="print-receipt-btn"
            onClick={() => setShowReceiptModal(true)}
            style={{ minHeight: '44px' }}
            className="min-h-[44px] font-semibold"
            icon={<Printer size={16} />}
          >
            Print Receipt
          </Button>
        </div>
      </div>

      {order.status === 'DELIVERED' && (
        <div
          id="order-delivered-banner"
          className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-900 flex flex-wrap items-center justify-between gap-3 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 shrink-0">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="font-bold text-base text-gray-900">Order Completely Delivered</div>
              <div className="text-xs text-green-800 mt-0.5">
                {order.deliveredAt
                  ? `Delivered on ${new Date(order.deliveredAt).toLocaleString()}`
                  : 'All garments handed over'}
                {order.deliveredByName ? ` by ${order.deliveredByName}` : ''}
              </div>
            </div>
          </div>
          <span className="px-3 py-1 text-xs font-bold rounded-full bg-green-600 text-white shadow-sm">
            DELIVERED
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Phone</span>
              <span className="font-medium text-gray-900">{order.customerPhone}</span>
            </div>
            <div className="flex justify-between pt-2 border-t mt-2">
              <span className="text-gray-500 flex items-center gap-1">
                <Calendar size={14} /> Due Date
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {new Date(order.effectiveDueDate).toLocaleDateString()}
                </span>
                {(employee?.role === Role.OWNER || employee?.role === Role.MANAGER) && (
                  <button
                    onClick={() => setEditDueDate(true)}
                    className="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition-colors"
                    title="Edit Due Date"
                  >
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {order.dueDateOverrideReason && (
              <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded mt-2">
                <strong>Overridden:</strong> {order.dueDateOverrideReason}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Payment Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium text-gray-900">₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Discount</span>
              <span className="font-medium text-green-600">-₹{order.discountAmount}</span>
            </div>
            {order.isExpress && (order.expressSurcharge || 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-orange-600">⚡ Express Surcharge</span>
                <span className="font-medium text-orange-600">₹{order.expressSurcharge}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">GST (18%)</span>
              <span className="font-medium text-gray-900">₹{order.taxAmount}</span>
            </div>
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-gray-900">Total Amount</span>
              <span className="font-bold text-gray-900">₹{order.totalAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount Paid</span>
              <span className="font-medium text-green-600">₹{order.amountPaid}</span>
            </div>
            {order.refundAmount != null && order.refundAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Refunds Issued</span>
                <span className="font-medium text-orange-600">-₹{order.refundAmount}</span>
              </div>
            )}
            {order.storeCreditAmount != null && order.storeCreditAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Store Credit</span>
                <span className="font-medium text-blue-600">₹{order.storeCreditAmount}</span>
              </div>
            )}
            {((order.refundAmount || 0) > 0 || (order.storeCreditAmount || 0) > 0) && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Net Settled</span>
                <span className="font-semibold text-gray-800">
                  ₹{order.effectivePaid ?? order.amountPaid}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold text-gray-900">Amount Due</span>
              <span className="font-bold text-red-600">₹{order.amountDue}</span>
            </div>
            {order.payableAmount > 0 && (
              <div className="flex justify-between pt-2 border-t mt-2">
                <span className="font-bold text-gray-900">Amount Payable Now</span>
                <span className="font-bold text-blue-600 text-lg">₹{order.payableAmount}</span>
              </div>
            )}
            {order.payableAmount === 0 && order.amountDue > 0 && (
              <div className="flex justify-between pt-2 border-t mt-2">
                <span className="font-medium text-gray-500">Amount Payable Now</span>
                <span className="font-medium text-gray-400">₹0</span>
              </div>
            )}

            {order.amountDue > 0 && (
              <div className="pt-4">
                <Button
                  variant="primary"
                  className="w-full min-h-[44px]"
                  onClick={() => setShowPaymentModal(true)}
                >
                  Record Payment
                </Button>
              </div>
            )}

            {employee?.role === Role.OWNER &&
              Math.max(
                0,
                Number(
                  (
                    order.amountPaid -
                    order.totalAmount -
                    (order.refundAmount || 0) -
                    (order.storeCreditAmount || 0)
                  ).toFixed(2),
                ),
              ) > 0 && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px]"
                    id="open-financial-adjustment-btn"
                    onClick={() => setShowAdjustmentModal(true)}
                  >
                    Financial Adjustment (₹
                    {Math.max(
                      0,
                      Number(
                        (
                          order.amountPaid -
                          order.totalAmount -
                          (order.refundAmount || 0) -
                          (order.storeCreditAmount || 0)
                        ).toFixed(2),
                      ),
                    )}{' '}
                    eligible)
                  </Button>
                </div>
              )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Fulfillment Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Ready Items Value</span>
              <span className="font-medium text-green-600">₹{order.readyAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Processing Items Value</span>
              <span className="font-medium text-orange-500">₹{order.remainingAmount}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-gray-500">Collected Items Value</span>
              <span className="font-medium text-gray-900">₹{order.collectedAmount}</span>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Order Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="py-3 px-4 font-semibold text-gray-600">Item</th>
                <th className="py-3 px-4 font-semibold text-gray-600">Service</th>
                <th className="py-3 px-4 font-semibold text-gray-600 text-center">Status</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">Qty</th>
                <th className="py-3 px-4 text-right font-semibold text-gray-600">Total</th>
                <th className="py-3 px-4 font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const isReady = item.itemStatus === 'READY';
                const isDelivered = item.itemStatus === 'DELIVERED';

                const isExpanded = expandedItems.has(item.id);
                const hasPhysicalGarments =
                  item.physicalGarments && item.physicalGarments.length > 0;

                let readySummary = '';
                let readyCount = 0;
                let total = 0;
                if (hasPhysicalGarments) {
                  const activeGarments = item.physicalGarments!.filter((g) => !g.isCancelled);
                  readyCount = activeGarments.filter((g) => g.isReady).length;
                  total = activeGarments.length;
                  if (readyCount === total && total > 0) {
                    readySummary = `${total} of ${total} ready (All garments ready)`;
                  } else {
                    readySummary = `${readyCount} of ${total} ready / ${total - readyCount} remaining`;
                  }
                }

                return (
                  <React.Fragment key={item.id}>
                    <tr
                      className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${
                        isReady ? 'bg-green-50/30' : isDelivered ? 'opacity-50 grayscale' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {hasPhysicalGarments && (
                            <button
                              type="button"
                              id={`toggle-expand-${item.id}`}
                              aria-label={`Toggle pieces for ${item.garmentName}`}
                              onClick={() => toggleExpand(item.id)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          )}
                          <div>
                            <div className="font-medium text-gray-900">{item.garmentName}</div>
                            {hasPhysicalGarments && (
                              <div className="text-xs font-semibold text-blue-700 mt-0.5">
                                {readySummary}
                              </div>
                            )}
                            {item.colorTags && item.colorTags.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Tags: {item.colorTags.join(', ')}
                              </div>
                            )}
                            {item.defectNotes && (
                              <div className="text-xs text-red-500 mt-1">
                                Notes: {item.defectNotes}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{item.serviceType}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
                          {item.itemStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div>{item.quantity}</div>
                        {item.deliveredQuantity > 0 && (
                          <div className="text-xs text-green-600">
                            {item.deliveredQuantity} delivered
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-medium">₹{item.lineTotal}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          id={`edit-item-${item.id}`}
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditItem(item)}
                          icon={<Edit2 size={16} />}
                          aria-label={`Edit ${item.garmentName}`}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                    {isExpanded && hasPhysicalGarments && (
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <td colSpan={6} className="py-4 px-8">
                          {notificationFeedback && (
                            <div
                              className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${
                                notificationFeedback.type === 'success'
                                  ? 'bg-green-50 text-green-800 border border-green-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              <span>{notificationFeedback.message}</span>
                              <button
                                onClick={() => setNotificationFeedback(null)}
                                className="text-xs font-bold underline ml-2 hover:opacity-80"
                              >
                                Dismiss
                              </button>
                            </div>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                            <div className="text-sm font-semibold text-gray-800">
                              {readySummary}
                            </div>
                            <div className="flex items-center gap-2">
                              {item.itemStatus !== 'DELIVERED' &&
                                item.itemStatus !== 'CANCELLED' &&
                                order.status !== 'DELIVERED' &&
                                order.status !== 'CANCELLED' && (
                                  <Button
                                    id={`add-garment-${item.id}`}
                                    variant="outline"
                                    size="sm"
                                    disabled={addingGarmentItemId === item.id}
                                    onClick={() => handleAddGarment(item.id)}
                                    style={{ minHeight: '44px' }}
                                    className="text-xs font-semibold px-4 flex items-center gap-1 min-h-[44px]"
                                    icon={
                                      addingGarmentItemId === item.id ? (
                                        <Loader2 className="animate-spin" size={16} />
                                      ) : (
                                        <Plus size={16} />
                                      )
                                    }
                                  >
                                    {addingGarmentItemId === item.id ? 'Adding...' : '+ Add Piece'}
                                  </Button>
                                )}
                              {readyCount > 0 && readyCount < total && (
                                <Button
                                  id={`notify-customer-${item.id}`}
                                  variant="secondary"
                                  size="sm"
                                  disabled={isNotifying}
                                  onClick={handleNotifyPartialReady}
                                  style={{ minHeight: '44px' }}
                                  className="text-xs font-semibold px-4"
                                  icon={
                                    isNotifying ? (
                                      <Loader2 className="animate-spin" size={16} />
                                    ) : (
                                      <Send size={16} />
                                    )
                                  }
                                >
                                  {isNotifying ? 'Sending...' : 'Notify Customer'}
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {item.physicalGarments!.map((pg) => {
                              const isCancelled = Boolean(pg.isCancelled);
                              const isDelivered = Boolean(pg.isDelivered);
                              return (
                                <div
                                  key={pg.id}
                                  id={`garment-card-${pg.id}`}
                                  className={`flex flex-col rounded-lg border shadow-sm overflow-hidden ${
                                    isCancelled
                                      ? 'bg-gray-50/80 border-gray-300 border-dashed opacity-80'
                                      : isDelivered
                                        ? 'bg-green-50/60 border-green-300 shadow-sm'
                                        : pg.isReady
                                          ? 'bg-green-50 border-green-300'
                                          : 'bg-white border-gray-200'
                                  }`}
                                >
                                  <div className="flex justify-between items-center p-3 border-b bg-gray-50/50">
                                    <span
                                      className={`font-bold ${isCancelled ? 'text-gray-500' : isDelivered ? 'text-green-900' : 'text-gray-700'}`}
                                    >
                                      Garment #{pg.unitNumber}
                                    </span>
                                    {isCancelled ? (
                                      <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 border border-red-200">
                                        CANCELLED
                                      </span>
                                    ) : isDelivered ? (
                                      <span
                                        id={`garment-delivered-badge-${pg.id}`}
                                        className="px-2 py-0.5 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200 flex items-center gap-1"
                                      >
                                        <Check size={12} strokeWidth={3} /> DELIVERED
                                      </span>
                                    ) : !pg.isReady &&
                                      !isDelivered &&
                                      item.deliveredQuantity === 0 &&
                                      item.itemStatus !== 'DELIVERED' &&
                                      item.itemStatus !== 'CANCELLED' &&
                                      order.status !== 'DELIVERED' &&
                                      order.status !== 'CANCELLED' ? (
                                      <button
                                        id={`cancel-garment-${pg.id}`}
                                        onClick={() => {
                                          setCancelError(null);
                                          setGarmentToCancel({
                                            itemId: item.id,
                                            garmentId: pg.id,
                                            unitNumber: pg.unitNumber,
                                          });
                                        }}
                                        className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors font-medium min-h-[44px] flex items-center gap-1"
                                        title={`Cancel Garment #${pg.unitNumber}`}
                                        aria-label={`Cancel Garment #${pg.unitNumber}`}
                                      >
                                        <Ban size={14} /> Cancel Piece
                                      </button>
                                    ) : null}
                                  </div>

                                  <div className="flex flex-col items-center justify-center p-3 min-h-[140px] bg-gray-100/50 space-y-2">
                                    {pg.photos && pg.photos.length > 0 ? (
                                      <div className="w-full flex flex-col items-center gap-2">
                                        <div className="flex items-center justify-between w-full px-1">
                                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                            {pg.photos.length}{' '}
                                            {pg.photos.length === 1 ? 'photo' : 'photos'} ✓
                                          </span>
                                          {!isCancelled &&
                                            activePhotoCapture?.garmentId !== pg.id && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setActivePhotoCapture({
                                                    itemId: item.id,
                                                    garmentId: pg.id,
                                                  })
                                                }
                                                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 min-h-[44px] px-2.5 py-1 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                                                title="Add another photo to this piece"
                                              >
                                                <Plus size={14} /> Add Photo
                                              </button>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 justify-center max-w-full">
                                          {pg.photos.map((photo: any, phIdx: number) => (
                                            <button
                                              key={photo.id || phIdx}
                                              type="button"
                                              onClick={() => setViewingPhotoUrl(photo.url)}
                                              className="relative group w-20 h-20 bg-gray-200 rounded-lg border border-gray-300 overflow-hidden shrink-0 shadow-2xs hover:ring-2 hover:ring-blue-500 transition-all cursor-pointer p-0 block"
                                              title={`Click to preview photo ${phIdx + 1}`}
                                              aria-label={`Preview photo ${phIdx + 1} of Garment #${pg.unitNumber}`}
                                            >
                                              <img
                                                src={photo.url}
                                                alt={`Garment #${pg.unitNumber} - Photo ${phIdx + 1}`}
                                                className="w-full h-full object-cover rounded-lg"
                                              />
                                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                                                <Camera size={18} />
                                              </div>
                                            </button>
                                          ))}
                                        </div>

                                        {activePhotoCapture?.garmentId === pg.id && (
                                          <div className="w-full bg-white border shadow-lg rounded p-3 mt-2">
                                            <div className="flex justify-between items-center mb-2">
                                              <span className="text-xs font-semibold text-gray-700">
                                                Add Photo to Piece #{pg.unitNumber}
                                              </span>
                                              <button
                                                type="button"
                                                className="text-xs text-gray-500 hover:text-gray-900 font-semibold min-h-[36px] px-2 cursor-pointer"
                                                onClick={() => setActivePhotoCapture(null)}
                                              >
                                                Cancel
                                              </button>
                                            </div>
                                            {uploadingPhoto ? (
                                              <span className="text-sm text-gray-500 flex items-center gap-2 justify-center py-2">
                                                <Loader2 className="animate-spin" size={16} />{' '}
                                                Uploading...
                                              </span>
                                            ) : (
                                              <PhotoCapture
                                                onCapture={handlePhotoCapture}
                                                allowCamera={true}
                                                accept="image/jpeg,image/png,image/webp"
                                                label=""
                                              />
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ) : isCancelled ? (
                                      <span className="text-xs text-gray-400 italic">
                                        No photo attached
                                      </span>
                                    ) : activePhotoCapture?.garmentId === pg.id ? (
                                      uploadingPhoto ? (
                                        <span className="text-sm text-gray-500 flex items-center gap-2">
                                          <Loader2 className="animate-spin" size={16} />{' '}
                                          Uploading...
                                        </span>
                                      ) : (
                                        <div className="absolute z-10 bg-white border shadow-lg rounded p-3 w-64 max-w-full mt-10">
                                          <button
                                            className="text-xs text-gray-500 hover:text-gray-900 mb-2 font-semibold min-h-[36px] px-2 cursor-pointer"
                                            onClick={() => setActivePhotoCapture(null)}
                                          >
                                            Cancel
                                          </button>
                                          <PhotoCapture
                                            onCapture={handlePhotoCapture}
                                            allowCamera={true}
                                            accept="image/jpeg,image/png,image/webp"
                                            label=""
                                          />
                                        </div>
                                      )
                                    ) : (
                                      <button
                                        className="text-gray-400 hover:text-blue-600 flex flex-col items-center gap-1 p-2 transition-colors min-h-[44px] justify-center cursor-pointer"
                                        onClick={() =>
                                          setActivePhotoCapture({
                                            itemId: item.id,
                                            garmentId: pg.id,
                                          })
                                        }
                                      >
                                        <Camera size={32} />
                                        <span className="text-xs font-medium">Add Photo</span>
                                      </button>
                                    )}
                                  </div>

                                  <div className="p-3">
                                    {isCancelled ? (
                                      <div className="w-full py-3 px-4 rounded-md text-center text-xs font-semibold text-gray-400 bg-gray-100 flex items-center justify-center min-h-[44px] border border-gray-200">
                                        Piece Cancelled
                                      </div>
                                    ) : isDelivered ? (
                                      <div
                                        id={`garment-delivered-btn-${pg.id}`}
                                        className="w-full py-2.5 px-3 rounded-md text-center text-xs font-bold text-green-800 bg-green-100/70 flex flex-col items-center justify-center min-h-[44px] border border-green-200"
                                      >
                                        <div className="flex items-center gap-1">
                                          <Check size={16} strokeWidth={3} /> DELIVERED
                                        </div>
                                        {pg.deliveredAt && (
                                          <div className="text-[10px] font-normal text-green-700 mt-0.5">
                                            {new Date(pg.deliveredAt).toLocaleTimeString([], {
                                              hour: '2-digit',
                                              minute: '2-digit',
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <button
                                        id={`toggle-ready-${pg.id}`}
                                        onClick={() =>
                                          handleGarmentReadyToggle(item.id, pg.id, !pg.isReady)
                                        }
                                        disabled={
                                          item.itemStatus === 'DELIVERED' ||
                                          updatingGarmentId === pg.id
                                        }
                                        className={`w-full py-3 px-4 rounded-md flex items-center justify-center gap-2 font-bold transition-all min-h-[44px] ${
                                          pg.isReady
                                            ? 'bg-green-600 hover:bg-green-700 text-white shadow'
                                            : 'bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                                      >
                                        {updatingGarmentId === pg.id ? (
                                          <>
                                            <Loader2 className="animate-spin" size={20} /> UPDATING
                                          </>
                                        ) : pg.isReady ? (
                                          <>
                                            <Check size={20} strokeWidth={3} /> READY
                                          </>
                                        ) : (
                                          <>
                                            <Circle size={20} strokeWidth={3} /> REMAINING
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Payment & Adjustment History</h2>
          {employee?.role === Role.OWNER && (
            <Button
              variant="outline"
              size="sm"
              id="header-financial-adjustment-btn"
              style={{ minHeight: '44px' }}
              onClick={() => setShowAdjustmentModal(true)}
            >
              + Financial Adjustment
            </Button>
          )}
        </div>
        {(!order.payments || order.payments.length === 0) &&
        (!order.adjustments || order.adjustments.length === 0) ? (
          <p className="text-sm text-gray-500">No payment or adjustment transactions recorded.</p>
        ) : (
          <div className="space-y-4">
            {order.payments && order.payments.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Payments Received
                </h3>
                {order.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between items-center p-3 bg-gray-50 border border-gray-200 rounded-md text-sm"
                  >
                    <div>
                      <div className="font-semibold text-gray-800">
                        {p.mode} Payment {p.reference ? `(${p.reference})` : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right font-bold text-green-700">+₹{p.amount}</div>
                  </div>
                ))}
              </div>
            )}

            {order.adjustments && order.adjustments.length > 0 && (
              <div className="space-y-2 pt-2 border-t">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Financial Adjustments
                </h3>
                {order.adjustments.map((a) => (
                  <div
                    key={a.id}
                    className="flex justify-between items-center p-3 bg-amber-50/60 border border-amber-200 rounded-md text-sm"
                  >
                    <div>
                      <div className="font-semibold text-gray-800 flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 text-xs rounded font-bold ${
                            a.type === 'REFUND'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {a.type}
                        </span>
                        <span>{a.reason}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        By {a.createdByName} • {new Date(a.createdAt).toLocaleString()}
                        {a.reference && ` • Ref: ${a.reference}`}
                      </div>
                    </div>
                    <div
                      className={`text-right font-bold ${
                        a.type === 'REFUND' ? 'text-orange-700' : 'text-blue-700'
                      }`}
                    >
                      {a.type === 'REFUND' ? `-₹${a.amount}` : `₹${a.amount}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {editItem && (
        <OrderItemEditModal
          open={!!editItem}
          onClose={() => setEditItem(null)}
          orderId={order.id}
          item={editItem}
          onSuccess={fetchOrder}
        />
      )}

      {editDueDate && (
        <DueDateEditModal
          open={editDueDate}
          onClose={() => setEditDueDate(false)}
          orderId={order.id}
          currentDueDate={order.effectiveDueDate}
          onSuccess={fetchOrder}
        />
      )}

      {showPaymentModal && (
        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          order={order}
          onSuccess={fetchOrder}
        />
      )}

      {garmentToCancel &&
        (() => {
          const cancellingItem = order.items.find((i) => i.id === garmentToCancel.itemId);
          let requiresAdjustment = false;
          let excessAmount = 0;
          if (cancellingItem) {
            const pricingInputs = order.items.map((i) => ({
              unitPrice: i.unitPrice,
              quantity: i.id === cancellingItem.id ? Math.max(0, i.quantity - 1) : i.quantity,
            }));
            const newTotals = calculateOrderTotals(pricingInputs, {
              isExpress: order.isExpress,
              expressSurchargePercent:
                (order.expressSurcharge || 0) > 0 && order.subtotal > 0
                  ? ((order.expressSurcharge || 0) / order.subtotal) * 100
                  : undefined,
            });
            const currentEffectivePaid =
              order.effectivePaid ??
              Number(
                (
                  order.amountPaid -
                  (order.refundAmount || 0) -
                  (order.storeCreditAmount || 0)
                ).toFixed(2),
              );
            if (newTotals.totalAmount < currentEffectivePaid) {
              requiresAdjustment = true;
              excessAmount = Number((currentEffectivePaid - newTotals.totalAmount).toFixed(2));
            }
          }

          const isOwner = employee?.role === Role.OWNER;

          return (
            <Modal
              open={Boolean(garmentToCancel)}
              onClose={() => {
                if (!isCancelling) {
                  setGarmentToCancel(null);
                  setCancelError(null);
                  setCancelAdjustmentReason('');
                }
              }}
              title={`Cancel Garment #${garmentToCancel.unitNumber}`}
            >
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Are you sure you want to cancel{' '}
                  <strong>Garment #{garmentToCancel.unitNumber}</strong>?
                </p>
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-md border border-gray-200">
                  This will remove the piece from the active quantity and recalculate order totals.
                  Any attached photos and audit history will be retained.
                </div>

                {requiresAdjustment && (
                  <div className="space-y-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <div className="text-sm font-semibold text-amber-900">
                      Financial Adjustment Required (Excess Paid: ₹{excessAmount})
                    </div>
                    <div className="text-xs text-amber-700">
                      Cancelling this piece reduces the order total below the effective amount
                      already paid.
                    </div>

                    {isOwner ? (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Select Adjustment Type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              id="select-cancel-refund-btn"
                              onClick={() => setCancelAdjustmentType(AdjustmentType.REFUND)}
                              className={`py-1.5 px-2 text-xs font-semibold rounded border min-h-[44px] ${
                                cancelAdjustmentType === AdjustmentType.REFUND
                                  ? 'bg-blue-100 border-blue-500 text-blue-800'
                                  : 'bg-white border-gray-300 text-gray-700'
                              }`}
                            >
                              Refund (₹{excessAmount})
                            </button>
                            <button
                              type="button"
                              id="select-cancel-credit-btn"
                              onClick={() => setCancelAdjustmentType(AdjustmentType.STORE_CREDIT)}
                              className={`py-1.5 px-2 text-xs font-semibold rounded border min-h-[44px] ${
                                cancelAdjustmentType === AdjustmentType.STORE_CREDIT
                                  ? 'bg-blue-100 border-blue-500 text-blue-800'
                                  : 'bg-white border-gray-300 text-gray-700'
                              }`}
                            >
                              Store Credit (₹{excessAmount})
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Reason <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            id="cancel-adjustment-reason-input"
                            value={cancelAdjustmentReason}
                            onChange={(e) => setCancelAdjustmentReason(e.target.value)}
                            placeholder={`e.g. Garment #${garmentToCancel.unitNumber} cancelled`}
                            className="w-full text-sm px-3 py-2 border border-gray-300 rounded min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-red-700 bg-red-100 p-2 rounded">
                        Only a Store Owner can authorize refunds or store credit adjustments. Please
                        request an Owner to cancel this piece.
                      </div>
                    )}
                  </div>
                )}

                {cancelError && (
                  <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">
                    {cancelError}
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setGarmentToCancel(null);
                      setCancelError(null);
                      setCancelAdjustmentReason('');
                    }}
                    disabled={isCancelling}
                    style={{ minHeight: '44px' }}
                  >
                    Keep Garment
                  </Button>
                  <Button
                    variant="danger"
                    id="confirm-cancel-garment-btn"
                    onClick={handleConfirmCancelGarment}
                    disabled={
                      isCancelling ||
                      (requiresAdjustment && (!isOwner || !cancelAdjustmentReason.trim()))
                    }
                    style={{ minHeight: '44px' }}
                    icon={isCancelling ? <Loader2 className="animate-spin" size={16} /> : undefined}
                  >
                    {isCancelling ? 'Cancelling...' : 'Yes, Cancel Garment'}
                  </Button>
                </div>
              </div>
            </Modal>
          );
        })()}

      {showAdjustmentModal && (
        <FinancialAdjustmentModal
          open={showAdjustmentModal}
          onClose={() => setShowAdjustmentModal(false)}
          order={order}
          onSuccess={fetchOrder}
        />
      )}

      {showPickupModal && order && (
        <OrderPickupModal
          open={showPickupModal}
          onClose={() => setShowPickupModal(false)}
          order={order}
          onSuccess={fetchOrder}
        />
      )}

      {showReceiptModal && order && (
        <OrderReceiptModal
          open={showReceiptModal}
          onClose={() => setShowReceiptModal(false)}
          order={order}
        />
      )}

      {/* Lightbox Modal for Photo Preview */}
      {viewingPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setViewingPhotoUrl(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-2xl w-full bg-white rounded-xl overflow-hidden shadow-2xl p-4 flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex justify-between items-center border-b pb-2">
              <span className="text-sm font-bold text-slate-800">Photo Preview</span>
              <button
                type="button"
                onClick={() => setViewingPhotoUrl(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close photo preview"
              >
                <X size={20} />
              </button>
            </div>
            <img
              src={viewingPhotoUrl}
              alt="Enlarged photo preview"
              className="max-h-[70vh] w-auto object-contain rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={() => setViewingPhotoUrl(null)}
              className="min-h-[44px] px-6 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
