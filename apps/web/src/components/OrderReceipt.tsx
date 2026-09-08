import React from 'react';
import { OrderDetailDTO, OrderStatus, PaymentStatus } from '@growfast/shared-types';

export interface OrderReceiptProps {
  order: OrderDetailDTO;
  format?: 'standard' | 'thermal';
  id?: string;
}

export const OrderReceipt: React.FC<OrderReceiptProps> = ({
  order,
  format = 'standard',
  id = 'printable-receipt',
}) => {
  const isThermal = format === 'thermal';

  // Compute active vs delivered pieces for handover summary
  let totalActivePieces = 0;
  let totalDeliveredPieces = 0;

  for (const item of order.items) {
    if (item.itemStatus === 'CANCELLED') continue;

    if (item.physicalGarments && item.physicalGarments.length > 0) {
      const activeGarments = item.physicalGarments.filter((g) => !g.isCancelled);
      totalActivePieces += activeGarments.length;
      totalDeliveredPieces += activeGarments.filter((g) => g.isDelivered).length;
    } else {
      totalActivePieces += item.quantity;
      totalDeliveredPieces += item.deliveredQuantity;
    }
  }

  const remainingPieces = Math.max(0, totalActivePieces - totalDeliveredPieces);
  const isCompletelyDelivered =
    order.status === OrderStatus.DELIVERED ||
    (totalActivePieces > 0 && remainingPieces === 0 && order.amountDue === 0);
  const isPartialHandover = totalDeliveredPieces > 0 && !isCompletelyDelivered;

  // Authoritative financial values directly from order
  const effectivePaid =
    order.effectivePaid !== undefined
      ? order.effectivePaid
      : order.amountPaid - (order.refundAmount || 0) - (order.storeCreditAmount || 0);

  const formatCurrency = (val: number | undefined) => `₹${(val || 0).toFixed(2)}`;

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div
      id={id}
      className={`bg-white text-gray-900 mx-auto ${
        isThermal
          ? 'receipt-thermal p-3 border border-dashed border-gray-300 rounded text-xs'
          : 'receipt-standard p-8 border border-gray-200 rounded-lg shadow-sm text-sm'
      }`}
    >
      {/* ─── 1. Header & Store Info ───────────────────────────────────── */}
      <div className="text-center pb-3 border-b border-gray-300">
        <h1
          className={`font-black tracking-wider uppercase text-gray-900 ${
            isThermal ? 'text-lg leading-tight' : 'text-2xl mb-0.5'
          }`}
        >
          GROWFAST
        </h1>
        <p className={`text-gray-600 font-medium ${isThermal ? 'text-[11px]' : 'text-xs'}`}>
          Laundry & Dry-Cleaning Services
        </p>

        {order.storeName && <p className="font-semibold text-gray-800 mt-1">{order.storeName}</p>}
        {order.storeAddress && (
          <p className={`text-gray-500 ${isThermal ? 'text-[10px]' : 'text-xs'}`}>
            {order.storeAddress}
          </p>
        )}
        {order.storePhone && (
          <p className={`text-gray-500 ${isThermal ? 'text-[10px]' : 'text-xs'}`}>
            Ph: {order.storePhone}
          </p>
        )}
      </div>

      {/* ─── 2. Order Metadata ────────────────────────────────────────── */}
      <div className="py-3 border-b border-gray-200 space-y-1">
        <div className="flex justify-between items-baseline font-bold text-gray-900">
          <span className="text-xs uppercase text-gray-500 font-normal">Order Number</span>
          <span className={isThermal ? 'text-sm' : 'text-base font-mono'}>
            #{order.orderNumber}
          </span>
        </div>

        <div className="flex justify-between text-xs text-gray-700">
          <span className="text-gray-500">Date & Time:</span>
          <span>{formatDate(order.orderDate)}</span>
        </div>

        <div className="flex justify-between text-xs text-gray-700">
          <span className="text-gray-500">Due Date:</span>
          <span className="font-medium">{formatDate(order.effectiveDueDate)}</span>
        </div>

        <div className="flex justify-between text-xs text-gray-700">
          <span className="text-gray-500">Customer:</span>
          <span className="font-semibold text-gray-900">{order.customerName}</span>
        </div>

        {order.customerPhone && (
          <div className="flex justify-between text-xs text-gray-700">
            <span className="text-gray-500">Phone:</span>
            <span>{order.customerPhone}</span>
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-700">
          <span className="text-gray-500">Pickup Type:</span>
          <span className="font-medium">
            {order.pickupType === 'STORE_PICKUP' ? 'Store Counter' : 'Home Delivery'}
          </span>
        </div>

        {order.isExpress && (
          <div className="flex justify-between text-xs font-semibold text-red-600">
            <span>Priority:</span>
            <span>EXPRESS DELIVERY</span>
          </div>
        )}
      </div>

      {/* ─── 3. Items Breakdown ───────────────────────────────────────── */}
      <div className="py-3 border-b border-gray-200">
        <div className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2">
          Order Items
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-[11px] uppercase">
              <th className="py-1">Item / Service</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {order.items.map((item) => {
              const isCancelled = item.itemStatus === 'CANCELLED';
              const cancelledGarmentsCount =
                item.physicalGarments?.filter((g) => g.isCancelled).length || 0;

              return (
                <tr key={item.id} className={isCancelled ? 'opacity-50 line-through' : ''}>
                  <td className="py-1.5 pr-2">
                    <div className="font-semibold text-gray-800">{item.garmentName}</div>
                    <div className="text-[10px] text-gray-500">{item.serviceType}</div>
                    {isCancelled ? (
                      <span className="text-[10px] font-bold text-red-600 uppercase">
                        (Cancelled)
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {item.deliveredQuantity > 0 && (
                          <span className="text-[10px] font-medium text-green-700">
                            ({item.deliveredQuantity} of {item.quantity} delivered)
                          </span>
                        )}
                        {cancelledGarmentsCount > 0 && (
                          <span className="text-[10px] font-medium text-red-600">
                            ({cancelledGarmentsCount} cancelled)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-1.5 text-center font-medium">{item.quantity}</td>
                  <td className="py-1.5 text-right font-mono text-gray-600">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="py-1.5 text-right font-mono font-semibold text-gray-900">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── 4. Authoritative Financial Summary ───────────────────────── */}
      <div className="py-3 border-b border-gray-200 space-y-1.5 text-xs">
        <div className="flex justify-between text-gray-600">
          <span>Subtotal</span>
          <span className="font-mono">{formatCurrency(order.subtotal)}</span>
        </div>

        {order.discountAmount > 0 && (
          <div className="flex justify-between text-green-700">
            <span>Discount</span>
            <span className="font-mono">-{formatCurrency(order.discountAmount)}</span>
          </div>
        )}

        {(order.expressSurcharge ?? 0) > 0 && (
          <div className="flex justify-between text-orange-700">
            <span>Express Surcharge</span>
            <span className="font-mono">+{formatCurrency(order.expressSurcharge)}</span>
          </div>
        )}

        {order.taxAmount > 0 && (
          <div className="flex justify-between text-gray-600">
            <span>Tax (GST)</span>
            <span className="font-mono">+{formatCurrency(order.taxAmount)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
          <span>Total Amount</span>
          <span className="font-mono">{formatCurrency(order.totalAmount)}</span>
        </div>

        <div className="flex justify-between text-gray-600 pt-1">
          <span>Amount Paid</span>
          <span className="font-mono">{formatCurrency(order.amountPaid)}</span>
        </div>

        {(order.refundAmount ?? 0) > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Refunded</span>
            <span className="font-mono">-{formatCurrency(order.refundAmount)}</span>
          </div>
        )}

        {(order.storeCreditAmount ?? 0) > 0 && (
          <div className="flex justify-between text-purple-700">
            <span>Store Credit Issued</span>
            <span className="font-mono">-{formatCurrency(order.storeCreditAmount)}</span>
          </div>
        )}

        {(order.refundAmount || 0) > 0 || (order.storeCreditAmount || 0) > 0 ? (
          <div className="flex justify-between font-medium text-gray-700">
            <span>Effective Paid</span>
            <span className="font-mono">{formatCurrency(effectivePaid)}</span>
          </div>
        ) : null}

        <div
          className={`flex justify-between text-sm font-black pt-1 border-t border-gray-200 ${
            order.amountDue > 0 ? 'text-red-600' : 'text-green-700'
          }`}
        >
          <span>Balance Due</span>
          <span className="font-mono">{formatCurrency(order.amountDue)}</span>
        </div>

        <div className="flex justify-between items-center pt-1 text-xs">
          <span className="text-gray-500">Payment Status:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              order.paymentStatus === PaymentStatus.PAID
                ? 'bg-green-100 text-green-800'
                : order.paymentStatus === PaymentStatus.PARTIAL
                  ? 'bg-yellow-100 text-yellow-800'
                  : order.paymentStatus === PaymentStatus.REFUNDED
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-red-100 text-red-800'
            }`}
          >
            {order.paymentStatus}
          </span>
        </div>
      </div>

      {/* ─── 5. Payment Transactions (if any) ────────────────────────── */}
      {order.payments && order.payments.length > 0 && (
        <div className="py-2.5 border-b border-gray-200 text-xs">
          <div className="font-bold text-[11px] uppercase tracking-wider text-gray-600 mb-1.5">
            Payment Transactions
          </div>
          <div className="space-y-1">
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-[11px] text-gray-700">
                <span>
                  {p.mode}
                  {p.reference ? ` (${p.reference})` : ''} • {formatDate(p.createdAt)}
                </span>
                <span className="font-mono font-medium">{formatCurrency(p.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. Financial Adjustments (if any) ────────────────────────── */}
      {order.adjustments && order.adjustments.length > 0 && (
        <div className="py-2.5 border-b border-gray-200 text-xs">
          <div className="font-bold text-[11px] uppercase tracking-wider text-gray-600 mb-1.5">
            Adjustments / Refunds
          </div>
          <div className="space-y-1">
            {order.adjustments.map((a) => (
              <div key={a.id} className="flex justify-between text-[11px] text-gray-700">
                <span>
                  {a.type} • {a.reason} ({formatDate(a.createdAt)})
                </span>
                <span className="font-mono font-medium">-{formatCurrency(a.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 7. Handover & Delivery Status Audit ──────────────────────── */}
      <div className="py-3 border-b border-gray-200 text-xs space-y-1">
        <div className="font-bold text-[11px] uppercase tracking-wider text-gray-600">
          Handover Status
        </div>

        {isCompletelyDelivered ? (
          <div className="bg-green-50 p-2.5 rounded border border-green-200 text-green-900 space-y-0.5">
            <div className="font-bold text-xs flex items-center gap-1.5">
              <span>✓</span> ORDER COMPLETELY DELIVERED
            </div>
            {order.deliveredAt && (
              <div className="text-[11px] text-green-800">
                Delivered on: {formatDate(order.deliveredAt)}
              </div>
            )}
            {order.deliveredByName && (
              <div className="text-[11px] text-green-800">
                Delivered by: {order.deliveredByName}
              </div>
            )}
          </div>
        ) : isPartialHandover ? (
          <div className="bg-blue-50 p-2.5 rounded border border-blue-200 text-blue-900 space-y-0.5">
            <div className="font-bold text-xs">PARTIAL HANDOVER IN PROGRESS</div>
            <div className="text-[11px] text-blue-800">
              {totalDeliveredPieces} of {totalActivePieces} pieces collected.
            </div>
            <div className="text-[11px] text-blue-800 font-medium">
              {remainingPieces} piece(s) remaining for collection.
            </div>
            <div className="text-[10px] text-blue-600 italic">
              Please retain this receipt for remaining pieces collection.
            </div>
          </div>
        ) : (
          <div className="text-gray-600 text-xs">
            <span>Status: </span>
            <span className="font-semibold text-gray-800">{order.status}</span>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Total Pieces: {totalActivePieces} | Target Delivery:{' '}
              {formatDate(order.effectiveDueDate)}
            </div>
          </div>
        )}
      </div>

      {/* ─── 8. Footer & Terms ────────────────────────────────────────── */}
      <div className="pt-3 text-center space-y-1 text-gray-500 text-[11px]">
        <p className="font-bold text-gray-800">Thank you for choosing GrowFast!</p>
        <p className="text-[10px]">
          Please present this receipt at the counter when collecting your garments.
        </p>
        <p className="text-[9px] text-gray-400 font-mono">
          Printed on {new Date().toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
};
