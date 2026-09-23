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

  // Authoritative financial values directly from order DTO (derived via PaymentService)
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

  // Payment modes summary for receipt footer
  const paymentModes =
    order.payments && order.payments.length > 0
      ? Array.from(new Set(order.payments.map((p) => p.mode))).join(', ')
      : null;

  /* ─────────────────────────────────────────────────────────────────────────
   * 80mm THERMAL RECEIPT LAYOUT
   * Clean monospace POS receipt structure with dashed dividers
   * ───────────────────────────────────────────────────────────────────────── */
  if (isThermal) {
    return (
      <div
        id={id}
        className="receipt-thermal w-[76mm] max-w-[76mm] mx-auto p-3 bg-white text-black font-mono text-xs leading-tight border border-dashed border-gray-400 rounded"
        style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
      >
        {/* Store Header */}
        <div className="text-center space-y-0.5 pb-2">
          <div className="font-bold text-sm tracking-wider uppercase">GROWFAST</div>
          <div className="text-[11px] text-gray-700">Laundry &amp; Dry-Cleaning</div>
          {order.storeName && (
            <div className="font-semibold text-xs text-gray-800">{order.storeName}</div>
          )}
          {order.storeAddress && (
            <div className="text-[10px] text-gray-600 break-words">{order.storeAddress}</div>
          )}
          {order.storePhone && (
            <div className="text-[10px] text-gray-600">Ph: {order.storePhone}</div>
          )}
        </div>

        {/* Dashed Separator */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Order & Customer Metadata */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-600">Order No:</span>
            <span className="font-bold">#{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span>{formatDate(order.orderDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Due Date:</span>
            <span>{formatDate(order.effectiveDueDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Customer:</span>
            <span className="font-semibold break-words max-w-[150px] text-right">
              {order.customerName}
            </span>
          </div>
          {order.customerPhone && (
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span>{order.customerPhone}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Pickup:</span>
            <span>{order.pickupType === 'STORE_PICKUP' ? 'Store Counter' : 'Home Delivery'}</span>
          </div>
          {order.isExpress && (
            <div className="flex justify-between text-red-600 font-bold">
              <span>Priority:</span>
              <span>EXPRESS</span>
            </div>
          )}
        </div>

        {/* Dashed Separator */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Items Table: Item | Qty | Amount */}
        <div>
          <div className="flex justify-between text-[10px] font-bold uppercase text-gray-600 pb-1 border-b border-gray-300">
            <span className="w-[50%] text-left">Item</span>
            <span className="w-[18%] text-center">Qty</span>
            <span className="w-[32%] text-right">Amount</span>
          </div>
          <div className="divide-y divide-gray-200 divide-dashed text-[11px]">
            {order.items.map((item) => {
              const isCancelled = item.itemStatus === 'CANCELLED';
              return (
                <div
                  key={item.id}
                  className={`py-1.5 flex justify-between items-start ${
                    isCancelled ? 'opacity-50 line-through' : ''
                  }`}
                >
                  <div className="w-[50%] pr-1">
                    <div className="font-semibold text-gray-900 break-words">
                      {item.garmentName}
                    </div>
                    <div className="text-[10px] text-gray-500">{item.serviceType}</div>
                    {item.weight != null && item.weight > 0 && (
                      <div className="text-[10px] text-gray-700 font-medium">
                        {item.weight} kg × ₹{item.unitPrice}/kg
                      </div>
                    )}
                    {isCancelled && (
                      <span className="text-[9px] text-red-600 uppercase font-bold">
                        (Cancelled)
                      </span>
                    )}
                  </div>
                  <div className="w-[18%] text-center font-medium pt-0.5">
                    {item.weight != null && item.weight > 0 ? `${item.weight} kg` : item.quantity}
                  </div>
                  <div className="w-[32%] text-right font-bold pt-0.5">
                    {formatCurrency(item.lineTotal)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dashed Separator */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Authoritative Financial Breakdown */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between text-gray-700">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Discount</span>
            <span>
              {order.discountAmount > 0 ? `-${formatCurrency(order.discountAmount)}` : '₹0.00'}
            </span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Express</span>
            <span>
              {(order.expressSurcharge ?? 0) > 0
                ? `+${formatCurrency(order.expressSurcharge)}`
                : '₹0.00'}
            </span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>GST</span>
            <span>{order.taxAmount > 0 ? `+${formatCurrency(order.taxAmount)}` : '₹0.00'}</span>
          </div>

          <div className="border-t border-dashed border-gray-400 my-1.5" />

          <div className="flex justify-between text-xs font-bold">
            <span>TOTAL</span>
            <span>{formatCurrency(order.totalAmount)}</span>
          </div>

          <div className="flex justify-between text-gray-700 pt-0.5">
            <span>Paid</span>
            <span>{formatCurrency(order.amountPaid)}</span>
          </div>

          {(order.refundAmount ?? 0) > 0 && (
            <div className="flex justify-between text-red-600">
              <span>Refunded</span>
              <span>-{formatCurrency(order.refundAmount)}</span>
            </div>
          )}

          {(order.storeCreditAmount ?? 0) > 0 && (
            <div className="flex justify-between text-purple-700">
              <span>Store Credit</span>
              <span>-{formatCurrency(order.storeCreditAmount)}</span>
            </div>
          )}

          {((order.refundAmount || 0) > 0 || (order.storeCreditAmount || 0) > 0) && (
            <div className="flex justify-between font-semibold text-gray-800">
              <span>Effective Paid</span>
              <span>{formatCurrency(effectivePaid)}</span>
            </div>
          )}

          <div className="flex justify-between text-xs font-bold pt-1 border-t border-dashed border-gray-300">
            <span>Due</span>
            <span className={order.amountDue > 0 ? 'text-red-600' : 'text-green-700'}>
              {formatCurrency(order.amountDue)}
            </span>
          </div>
        </div>

        {/* Dashed Separator */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Payment Mode & Handover Status */}
        <div className="space-y-1 text-[11px] text-gray-700">
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Mode:</span>
            <span className="font-semibold">{paymentModes || order.paymentStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Status:</span>
            <span className="font-bold">{order.paymentStatus}</span>
          </div>

          {isCompletelyDelivered ? (
            <div className="font-bold text-green-700 text-center py-1 bg-green-50 rounded mt-1">
              ✓ ORDER COMPLETELY DELIVERED
            </div>
          ) : isPartialHandover ? (
            <div className="font-bold text-blue-700 text-center py-1 bg-blue-50 rounded mt-1">
              PARTIAL HANDOVER IN PROGRESS ({totalDeliveredPieces}/{totalActivePieces})
            </div>
          ) : null}
        </div>

        {/* Dashed Separator */}
        <div className="border-t border-dashed border-gray-400 my-2" />

        {/* Footer */}
        <div className="text-center space-y-0.5 pt-1 text-[10px] text-gray-500">
          <div className="font-bold text-gray-800">Thank you for choosing GrowFast!</div>
          <div>Please retain this receipt for collection.</div>
          <div className="text-[9px] text-gray-400">
            Printed: {new Date().toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────────────────
   * STANDARD (A4) RECEIPT LAYOUT
   * Full-width professional invoice/receipt layout with structured grid
   * ───────────────────────────────────────────────────────────────────────── */
  return (
    <div
      id={id}
      className="receipt-standard max-w-2xl mx-auto p-6 sm:p-8 bg-white text-gray-900 border border-gray-200 rounded-lg shadow-sm text-sm"
    >
      {/* ─── 1. Header & Store Info ───────────────────────────────────── */}
      <div className="text-center pb-4 border-b border-gray-300">
        <h1 className="text-2xl sm:text-3xl font-black tracking-wider uppercase text-gray-900 mb-0.5">
          GROWFAST
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 font-medium">
          Laundry &amp; Dry-Cleaning Services
        </p>

        {order.storeName && (
          <p className="font-semibold text-gray-800 mt-1 text-sm">{order.storeName}</p>
        )}
        {order.storeAddress && (
          <p className="text-xs text-gray-500 max-w-md mx-auto break-words">{order.storeAddress}</p>
        )}
        {order.storePhone && <p className="text-xs text-gray-500">Ph: {order.storePhone}</p>}
      </div>

      {/* ─── 2. Order Metadata in Resilient 2-Column Grid ─────────────── */}
      <div className="py-4 border-b border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {/* Left Column: Order Tracking */}
          <div className="space-y-1.5 min-w-0">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-gray-500 uppercase font-medium">Order Number</span>
              <span className="text-base font-bold font-mono text-gray-900 break-words text-right">
                #{order.orderNumber}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Date &amp; Time:</span>
              <span className="text-gray-800 text-right">{formatDate(order.orderDate)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Due Date:</span>
              <span className="font-medium text-gray-900 text-right">
                {formatDate(order.effectiveDueDate)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Pickup Type:</span>
              <span className="font-medium text-gray-800 text-right">
                {order.pickupType === 'STORE_PICKUP' ? 'Store Counter' : 'Home Delivery'}
              </span>
            </div>
            {order.isExpress && (
              <div className="flex justify-between gap-2 text-red-600 font-bold">
                <span>Priority:</span>
                <span>EXPRESS DELIVERY</span>
              </div>
            )}
          </div>

          {/* Right Column: Customer Details */}
          <div className="space-y-1.5 min-w-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Customer:</span>
              <span className="font-semibold text-gray-900 break-words text-right">
                {order.customerName}
              </span>
            </div>
            {order.customerPhone && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Phone:</span>
                <span className="text-gray-800 text-right">{order.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <span className="text-gray-500">Created By:</span>
              <span className="text-gray-700 text-right">{order.createdByName || 'Staff'}</span>
            </div>
            {order.deliveredByName && (
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Delivered By:</span>
                <span className="text-gray-700 text-right">{order.deliveredByName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. Items Breakdown (Fixed Table Columns) ─────────────────── */}
      <div className="py-4 border-b border-gray-200 overflow-x-auto">
        <div className="font-bold text-xs uppercase tracking-wider text-gray-700 mb-2.5">
          Order Items ({totalActivePieces} {totalActivePieces === 1 ? 'Piece' : 'Pieces'})
        </div>

        <table className="w-full text-left border-collapse table-fixed">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500 text-[11px] uppercase">
              <th className="py-1.5 w-[50%]">Item / Service</th>
              <th className="py-1.5 w-[12%] text-center">Qty</th>
              <th className="py-1.5 w-[18%] text-right">Rate</th>
              <th className="py-1.5 w-[20%] text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs">
            {order.items.map((item) => {
              const isCancelled = item.itemStatus === 'CANCELLED';
              const cancelledGarmentsCount =
                item.physicalGarments?.filter((g) => g.isCancelled).length || 0;

              return (
                <tr key={item.id} className={isCancelled ? 'opacity-50 line-through' : ''}>
                  <td className="py-2 pr-2">
                    <div className="font-semibold text-gray-900 break-words">
                      {item.garmentName}
                    </div>
                    <div className="text-[11px] text-gray-500">{item.serviceType}</div>
                    {item.weight != null && item.weight > 0 && (
                      <div className="text-[11px] text-indigo-700 font-medium">
                        Weight: {item.weight} kg @ ₹{item.unitPrice}/kg
                      </div>
                    )}
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
                  <td className="py-2 text-center font-medium text-gray-800">
                    {item.weight != null && item.weight > 0 ? `${item.weight} kg` : item.quantity}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-600">
                    {formatCurrency(item.unitPrice)}
                    {item.weight != null && item.weight > 0 ? '/kg' : ''}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-900">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── 4. Authoritative Financial Summary ───────────────────────── */}
      <div className="py-4 border-b border-gray-200 flex justify-end">
        <div className="w-full sm:w-80 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span className="font-mono">{formatCurrency(order.subtotal)}</span>
          </div>

          {order.discountAmount > 0 && (
            <div className="flex justify-between text-green-700 font-medium">
              <span>Discount</span>
              <span className="font-mono">-{formatCurrency(order.discountAmount)}</span>
            </div>
          )}

          {(order.expressSurcharge ?? 0) > 0 && (
            <div className="flex justify-between text-orange-700 font-medium">
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

          <div className="flex justify-between text-sm font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total Amount</span>
            <span className="font-mono">{formatCurrency(order.totalAmount)}</span>
          </div>

          <div className="flex justify-between text-gray-600 pt-1">
            <span>Amount Paid</span>
            <span className="font-mono">{formatCurrency(order.amountPaid)}</span>
          </div>

          {(order.refundAmount ?? 0) > 0 && (
            <div className="flex justify-between text-red-600 font-medium">
              <span>Refunded</span>
              <span className="font-mono">-{formatCurrency(order.refundAmount)}</span>
            </div>
          )}

          {(order.storeCreditAmount ?? 0) > 0 && (
            <div className="flex justify-between text-purple-700 font-medium">
              <span>Store Credit Issued</span>
              <span className="font-mono">-{formatCurrency(order.storeCreditAmount)}</span>
            </div>
          )}

          {((order.refundAmount || 0) > 0 || (order.storeCreditAmount || 0) > 0) && (
            <div className="flex justify-between font-semibold text-gray-800">
              <span>Effective Paid</span>
              <span className="font-mono">{formatCurrency(effectivePaid)}</span>
            </div>
          )}

          <div
            className={`flex justify-between text-sm font-black pt-1.5 border-t border-gray-200 ${
              order.amountDue > 0 ? 'text-red-600' : 'text-green-700'
            }`}
          >
            <span>Balance Due</span>
            <span className="font-mono">{formatCurrency(order.amountDue)}</span>
          </div>

          <div className="flex justify-between items-center pt-1.5 text-xs">
            <span className="text-gray-500 font-medium">Payment Status:</span>
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
      </div>

      {/* ─── 5. Payment Transactions (if any) ────────────────────────── */}
      {order.payments && order.payments.length > 0 && (
        <div className="py-3 border-b border-gray-200 text-xs">
          <div className="font-bold text-[11px] uppercase tracking-wider text-gray-600 mb-1.5">
            Payment Transactions
          </div>
          <div className="space-y-1">
            {order.payments.map((p) => (
              <div key={p.id} className="flex justify-between text-xs text-gray-700">
                <span className="break-words">
                  <strong className="font-semibold text-gray-900">{p.mode}</strong>
                  {p.reference ? ` (${p.reference})` : ''} • {formatDate(p.createdAt)}
                </span>
                <span className="font-mono font-bold text-green-700 shrink-0 ml-2">
                  {formatCurrency(p.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 6. Financial Adjustments (if any) ────────────────────────── */}
      {order.adjustments && order.adjustments.length > 0 && (
        <div className="py-3 border-b border-gray-200 text-xs">
          <div className="font-bold text-[11px] uppercase tracking-wider text-gray-600 mb-1.5">
            Adjustments &amp; Refunds
          </div>
          <div className="space-y-1">
            {order.adjustments.map((a) => (
              <div key={a.id} className="flex justify-between text-xs text-gray-700">
                <span className="break-words">
                  <strong className="font-semibold text-gray-900">{a.type}</strong> • {a.reason} (
                  {formatDate(a.createdAt)})
                </span>
                <span className="font-mono font-bold text-red-600 shrink-0 ml-2">
                  -{formatCurrency(a.amount)}
                </span>
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
      <div className="pt-4 text-center space-y-1 text-gray-500 text-xs">
        <p className="font-bold text-gray-800">Thank you for choosing GrowFast!</p>
        <p className="text-[11px]">
          Please present this receipt at the counter when collecting your garments.
        </p>
        <p className="text-[10px] text-gray-400 font-mono">
          Printed on {new Date().toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
};
