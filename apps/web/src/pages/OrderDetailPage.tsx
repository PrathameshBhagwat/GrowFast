import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, StatusChip, LoadingState, ErrorState } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';
import { OrderDetailDTO, OrderItemDTO, Role } from '@growfast/shared-types';
import { OrderItemEditModal } from '../components/OrderItemEditModal';
import { DueDateEditModal } from '../components/DueDateEditModal';
import { ArrowLeft, Edit2, Calendar } from 'lucide-react';

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
              {order.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900">{item.garmentName}</div>
                    {item.colorTags && item.colorTags.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Tags: {item.colorTags.join(', ')}
                      </div>
                    )}
                    {item.defectNotes && (
                      <div className="text-xs text-red-500 mt-1">Notes: {item.defectNotes}</div>
                    )}
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
              ))}
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
    </div>
  );
}
