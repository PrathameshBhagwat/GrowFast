import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, StatusChip, LoadingState, ErrorState, PhotoCapture } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import { OrderDetailDTO, OrderItemDTO, Role } from '@growfast/shared-types';
import { OrderItemEditModal } from '../components/OrderItemEditModal';
import { DueDateEditModal } from '../components/DueDateEditModal';
import { PaymentModal } from '../components/PaymentModal';
import {
  ArrowLeft,
  Edit2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Camera,
  CheckCircle,
  Loader2,
  Circle,
  Check,
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
      await fetchOrder();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingGarmentId(null);
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
        'FRONT' as any, // Defaulting to FRONT for physical garments in this view
        activePhotoCapture.itemId,
        activePhotoCapture.garmentId,
      );
      await fetchOrder(); // Refetch to see the new photo
    } catch (err: any) {
      alert(err.message || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      setActivePhotoCapture(null);
    }
  };

  const fetchOrder = async () => {
    setLoading(true);
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
    } catch (err: any) {
      setError(err.message || 'Failed to load order');
    } finally {
      setLoading(false);
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
            <StatusChip status={order.status as any} />
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
        <div className="flex gap-3">
          <Button variant="outline">Print Receipt</Button>
        </div>
      </div>

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
            {order.isExpress && (order as any).expressSurcharge > 0 && (
              <div className="flex justify-between">
                <span className="text-orange-600">⚡ Express Surcharge</span>
                <span className="font-medium text-orange-600">
                  ₹{(order as any).expressSurcharge}
                </span>
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
                  className="w-full"
                  onClick={() => setShowPaymentModal(true)}
                >
                  Record Payment
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
                if (hasPhysicalGarments) {
                  const readyCount = item.physicalGarments!.filter(g => g.isReady).length;
                  const total = item.physicalGarments!.length;
                  if (readyCount === total) {
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
                              onClick={() => toggleExpand(item.id)}
                              className="p-1 hover:bg-gray-200 rounded text-gray-500"
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            {item.physicalGarments!.map((pg) => (
                              <div
                                key={pg.id}
                                className={`flex flex-col rounded-lg border shadow-sm overflow-hidden ${
                                  pg.isReady
                                    ? 'bg-green-50 border-green-300'
                                    : 'bg-white border-gray-200'
                                }`}
                              >
                                <div className="flex justify-between items-center p-3 border-b bg-gray-50/50">
                                  <span className="font-bold text-gray-700">Garment #{pg.unitNumber}</span>
                                </div>
                                
                                <div className="flex flex-col items-center justify-center p-4 min-h-[140px] bg-gray-100/50">
                                  {pg.photos && pg.photos.length > 0 ? (
                                    <div className="relative group">
                                      <img src={pg.photos[0].url} alt={`Garment #${pg.unitNumber}`} className="max-h-[120px] max-w-full object-contain rounded" />
                                      <a
                                        href={pg.photos[0].url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity rounded"
                                      >
                                        <Camera size={24} />
                                      </a>
                                    </div>
                                  ) : activePhotoCapture?.garmentId === pg.id ? (
                                    uploadingPhoto ? (
                                      <span className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Uploading...</span>
                                    ) : (
                                      <div className="absolute z-10 bg-white border shadow-lg rounded p-3 w-64 max-w-full mt-10">
                                        <button
                                          className="text-xs text-gray-500 hover:text-gray-900 mb-2 font-semibold"
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
                                      className="text-gray-400 hover:text-blue-600 flex flex-col items-center gap-1 p-2 transition-colors"
                                      onClick={() =>
                                        setActivePhotoCapture({ itemId: item.id, garmentId: pg.id })
                                      }
                                    >
                                      <Camera size={32} />
                                      <span className="text-xs font-medium">Add Photo</span>
                                    </button>
                                  )}
                                </div>

                                <div className="p-3">
                                  <button
                                    onClick={() => handleGarmentReadyToggle(item.id, pg.id, !pg.isReady)}
                                    disabled={item.itemStatus === 'DELIVERED' || updatingGarmentId === pg.id}
                                    className={`w-full py-3 px-4 rounded-md flex items-center justify-center gap-2 font-bold transition-all min-h-[44px] ${
                                      pg.isReady
                                        ? 'bg-green-600 hover:bg-green-700 text-white shadow'
                                        : 'bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 hover:bg-gray-50'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {updatingGarmentId === pg.id ? (
                                      <><Loader2 className="animate-spin" size={20} /> UPDATING</>
                                    ) : pg.isReady ? (
                                      <><Check size={20} strokeWidth={3} /> READY</>
                                    ) : (
                                      <><Circle size={20} strokeWidth={3} /> REMAINING</>
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
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
    </div>
  );
}
