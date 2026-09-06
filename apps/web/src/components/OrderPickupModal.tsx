import React, { useState, useMemo } from 'react';
import { Modal, Button, Card } from '@growfast/ui';
import {
  OrderDetailDTO,
  OrderPickupRequest,
  PaymentMode,
  ItemStatus,
} from '@growfast/shared-types';
import {
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  PackageCheck,
  Plus,
  Minus,
  Sparkles,
} from 'lucide-react';

export interface OrderPickupModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderDetailDTO;
  onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function OrderPickupModal({ open, onClose, order, onSuccess }: OrderPickupModalProps) {
  // 1. Selection State
  const [selectedGarmentIds, setSelectedGarmentIds] = useState<Set<string>>(new Set());
  const [legacyQuantities, setLegacyQuantities] = useState<Record<string, number>>({});

  // 2. Inline Payment State
  const [recordPayment, setRecordPayment] = useState<boolean>(false);
  const [paymentAmount, setPaymentAmount] = useState<string>(
    order.amountDue > 0 ? order.amountDue.toString() : '',
  );
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.UPI);
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [pickupNotes, setPickupNotes] = useState<string>('');

  // 3. Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Partition Items and Garments ─────────────────────────────────────
  const {
    physicalItems,
    legacyItems,
    eligibleGarmentCount,
    eligibleLegacyCount,
    totalActiveUndeliveredCount,
  } = useMemo(() => {
    let eligibleGarments = 0;
    let eligibleLegacy = 0;
    let totalUndelivered = 0;

    const pItems = (order.items || []).filter(
      (item) => item.physicalGarments && item.physicalGarments.length > 0,
    );
    const lItems = (order.items || []).filter(
      (item) =>
        (!item.physicalGarments || item.physicalGarments.length === 0) &&
        item.itemStatus !== ItemStatus.CANCELLED,
    );

    for (const item of pItems) {
      for (const pg of item.physicalGarments!) {
        if (!pg.isCancelled && !pg.isDelivered) {
          totalUndelivered++;
          if (pg.isReady) {
            eligibleGarments++;
          }
        }
      }
    }

    for (const item of lItems) {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      if (remaining > 0) {
        eligibleLegacy += remaining;
        totalUndelivered += remaining;
      }
    }

    return {
      physicalItems: pItems,
      legacyItems: lItems,
      eligibleGarmentCount: eligibleGarments,
      eligibleLegacyCount: eligibleLegacy,
      totalActiveUndeliveredCount: totalUndelivered,
    };
  }, [order]);

  // Selected counts
  const selectedPhysicalCount = selectedGarmentIds.size;
  const selectedLegacyCount = useMemo(() => {
    return Object.values(legacyQuantities).reduce((sum, q) => sum + (q || 0), 0);
  }, [legacyQuantities]);

  const totalSelectedCount = selectedPhysicalCount + selectedLegacyCount;
  const remainingAfterHandover = Math.max(0, totalActiveUndeliveredCount - totalSelectedCount);

  // Determine if this pickup would complete the entire order
  const isFinalHandover = useMemo(() => {
    if (totalSelectedCount === 0) return false;

    // Check all physical items: all active undelivered must be selected
    for (const item of physicalItems) {
      for (const pg of item.physicalGarments!) {
        if (!pg.isCancelled && !pg.isDelivered) {
          if (!selectedGarmentIds.has(pg.id)) {
            return false;
          }
        }
      }
    }

    // Check all legacy items: all remaining quantity must be selected
    for (const item of legacyItems) {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      const selectedQty = legacyQuantities[item.id] || 0;
      if (selectedQty < remaining) {
        return false;
      }
    }

    return true;
  }, [physicalItems, legacyItems, selectedGarmentIds, legacyQuantities, totalSelectedCount]);

  // Handle physical garment selection toggle
  const toggleGarment = (garmentId: string, isSelectable: boolean) => {
    if (!isSelectable || isSubmitting) return;
    setSelectedGarmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(garmentId)) {
        next.delete(garmentId);
      } else {
        next.add(garmentId);
      }
      return next;
    });
  };

  // Handle select all ready garments
  const handleSelectAllReady = () => {
    if (isSubmitting) return;
    const readyIds = new Set<string>();
    for (const item of physicalItems) {
      for (const pg of item.physicalGarments!) {
        if (!pg.isCancelled && !pg.isDelivered && pg.isReady) {
          readyIds.add(pg.id);
        }
      }
    }
    setSelectedGarmentIds(readyIds);

    // Also maximize legacy quantities
    const nextLegacy: Record<string, number> = {};
    for (const item of legacyItems) {
      const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
      if (remaining > 0) {
        nextLegacy[item.id] = remaining;
      }
    }
    setLegacyQuantities(nextLegacy);
  };

  // Handle deselect all
  const handleDeselectAll = () => {
    if (isSubmitting) return;
    setSelectedGarmentIds(new Set());
    setLegacyQuantities({});
  };

  // Handle legacy quantity change
  const handleLegacyQuantityChange = (itemId: string, delta: number, maxQty: number) => {
    if (isSubmitting) return;
    setLegacyQuantities((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  // Submit pickup request
  const handleSubmitPickup = async () => {
    if (totalSelectedCount === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('growfast_token');
      const payload: OrderPickupRequest = {};

      if (selectedGarmentIds.size > 0) {
        payload.garmentIds = Array.from(selectedGarmentIds);
      }

      const legacyItemsPayload = Object.entries(legacyQuantities)
        .filter(([, qty]) => qty > 0)
        .map(([itemId, quantity]) => ({ itemId, quantity }));

      if (legacyItemsPayload.length > 0) {
        payload.legacyItems = legacyItemsPayload;
      }

      // Inline payment if enabled or final handover with balance
      const shouldIncludePayment =
        (recordPayment || isFinalHandover) && order.amountDue > 0 && parseFloat(paymentAmount) > 0;

      if (shouldIncludePayment) {
        const numAmount = parseFloat(paymentAmount);
        if (isNaN(numAmount) || numAmount <= 0) {
          throw new Error('Please enter a valid positive payment amount.');
        }
        payload.payment = {
          amount: Number(numAmount.toFixed(2)),
          mode: paymentMode,
          reference: paymentReference.trim() || undefined,
        };
      }

      if (pickupNotes.trim()) {
        payload.notes = pickupNotes.trim();
      }

      const res = await fetch(`${API_URL}/orders/${order.id}/pickup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Formulate clear, friendly message from backend response
        const msg =
          data.message ||
          (res.status === 403
            ? 'Access denied: Cannot process handover for another store or unauthorized role.'
            : res.status === 409
              ? 'Conflict: Order was modified concurrently. Please refresh.'
              : `Pickup failed (${res.status})`);
        throw new Error(msg);
      }

      // Success
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to record pickup');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAnyEligible = eligibleGarmentCount > 0 || eligibleLegacyCount > 0;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={`Counter Handover — Order #${order.orderNumber}`}
    >
      <div className="space-y-5 pt-2 max-h-[80vh] overflow-y-auto pr-1">
        {/* Error Alert */}
        {errorMessage && (
          <div
            id="pickup-error-banner"
            role="alert"
            className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 flex items-start gap-2"
          >
            <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">{errorMessage}</div>
          </div>
        )}

        {/* 1. Authoritative Financial Summary Bar */}
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-gray-700">Financial Balance</span>
            <span
              className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                order.paymentStatus === 'PAID'
                  ? 'bg-green-100 text-green-800 border-green-200'
                  : order.paymentStatus === 'PARTIAL'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-red-100 text-red-800 border-red-200'
              }`}
            >
              {order.paymentStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-gray-200/80 text-xs">
            <div>
              <span className="text-gray-500 block">Total Amount</span>
              <span className="font-bold text-gray-900 text-sm">₹{order.totalAmount}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Amount Paid</span>
              <span className="font-bold text-green-700 text-sm">₹{order.amountPaid}</span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-gray-500 block">Amount Due</span>
              <span
                id="modal-amount-due"
                className={`font-bold text-sm ${
                  order.amountDue === 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ₹{order.amountDue}
              </span>
            </div>
          </div>

          {order.amountDue === 0 ? (
            <div className="text-xs text-green-700 font-semibold flex items-center gap-1.5 pt-1">
              <CheckCircle2 size={15} className="text-green-600" />
              Order fully settled — No handover payment required.
            </div>
          ) : (
            <div className="text-xs text-amber-800 bg-amber-50/80 p-2 rounded border border-amber-200 flex items-start gap-1.5">
              <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <span>
                Outstanding balance of <strong>₹{order.amountDue}</strong>. Full settlement is
                mandatory before completing final order handover.
              </span>
            </div>
          )}
        </div>

        {/* 2. Selection Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-blue-50/60 border border-blue-200 rounded-xl">
          <div>
            <div className="text-xs text-blue-800 font-semibold uppercase tracking-wider">
              Handover Selection
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">
              <span id="selected-handover-count" className="text-blue-700">
                {totalSelectedCount} selected
              </span>{' '}
              <span className="text-gray-400 font-normal">/</span>{' '}
              <span id="remaining-handover-count" className="text-gray-600">
                {remainingAfterHandover} remaining
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasAnyEligible && (
              <>
                <button
                  type="button"
                  onClick={handleSelectAllReady}
                  disabled={isSubmitting}
                  className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-white border border-blue-300 hover:bg-blue-50 rounded-lg min-h-[44px] flex items-center gap-1 transition-colors"
                  id="select-all-ready-btn"
                >
                  <Sparkles size={14} /> Select All Ready
                </button>
                {totalSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    disabled={isSubmitting}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg min-h-[44px] flex items-center transition-colors"
                    id="deselect-all-btn"
                  >
                    Clear
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* 3. Physical Garments Section */}
        {physicalItems.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>Physical Garment Pieces</span>
              <span className="text-xs font-normal text-gray-500">
                ({eligibleGarmentCount} ready for pickup)
              </span>
            </h3>

            <div className="space-y-4">
              {physicalItems.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="text-xs font-semibold text-gray-600 flex justify-between">
                    <span>
                      {item.garmentName} ({item.serviceType})
                    </span>
                    <span>Qty: {item.quantity}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {item.physicalGarments!.map((pg) => {
                      const isCancelled = Boolean(pg.isCancelled);
                      const isDelivered = Boolean(pg.isDelivered);
                      const isReady = Boolean(pg.isReady);
                      const isSelectable = !isCancelled && !isDelivered && isReady;
                      const isSelected = selectedGarmentIds.has(pg.id);

                      let cardStyles =
                        'border-gray-200 bg-white hover:border-blue-300 cursor-pointer';
                      let badge = null;

                      if (isCancelled) {
                        cardStyles =
                          'border-gray-200 bg-gray-50/90 text-gray-400 cursor-not-allowed opacity-75';
                        badge = (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 border border-red-200">
                            CANCELLED
                          </span>
                        );
                      } else if (isDelivered) {
                        cardStyles =
                          'border-green-200 bg-green-50/50 text-gray-600 cursor-not-allowed';
                        badge = (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-800 border border-green-200 flex items-center gap-1">
                            <Check size={10} strokeWidth={3} /> DELIVERED
                          </span>
                        );
                      } else if (!isReady) {
                        cardStyles =
                          'border-amber-200 bg-amber-50/40 text-gray-600 cursor-not-allowed';
                        badge = (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800 border border-amber-200">
                            NOT READY
                          </span>
                        );
                      } else if (isSelected) {
                        cardStyles =
                          'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/50 cursor-pointer';
                        badge = (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-600 text-white flex items-center gap-1">
                            <Check size={10} strokeWidth={3} /> SELECTED
                          </span>
                        );
                      } else {
                        badge = (
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-green-100 text-green-800 border border-green-200">
                            READY
                          </span>
                        );
                      }

                      return (
                        <div
                          key={pg.id}
                          id={`pickup-card-${pg.id}`}
                          onClick={() => toggleGarment(pg.id, isSelectable)}
                          role="checkbox"
                          aria-checked={isSelected}
                          aria-disabled={!isSelectable}
                          tabIndex={isSelectable ? 0 : -1}
                          onKeyDown={(e) => {
                            if (isSelectable && (e.key === ' ' || e.key === 'Enter')) {
                              e.preventDefault();
                              toggleGarment(pg.id, isSelectable);
                            }
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all min-h-[56px] select-none ${cardStyles}`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-6 h-6 rounded-md flex items-center justify-center border transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : isSelectable
                                    ? 'border-gray-300 bg-white'
                                    : 'border-gray-200 bg-gray-100'
                              }`}
                            >
                              {isSelected && <Check size={14} strokeWidth={3} />}
                            </div>
                            <div>
                              <div className="font-bold text-sm text-gray-900">
                                Garment #{pg.unitNumber}
                              </div>
                              <div className="text-xs text-gray-500">{item.garmentName}</div>
                            </div>
                          </div>
                          <div>{badge}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Legacy Order Items Section */}
        {legacyItems.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
              <span>Standard Order Items</span>
              <span className="text-xs font-normal text-gray-500">
                ({eligibleLegacyCount} remaining)
              </span>
            </h3>

            <div className="space-y-3">
              {legacyItems.map((item) => {
                const remaining = Math.max(0, item.quantity - (item.deliveredQuantity || 0));
                const currentQty = legacyQuantities[item.id] || 0;
                const isFullyDelivered = remaining === 0;

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white border border-gray-200 rounded-xl flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-sm text-gray-900">{item.garmentName}</div>
                      <div className="text-xs text-gray-500">
                        {item.serviceType} • Total: {item.quantity} | Delivered:{' '}
                        {item.deliveredQuantity || 0}
                      </div>
                      <div className="text-xs font-semibold text-blue-700 mt-0.5">
                        Remaining to deliver: {remaining}
                      </div>
                    </div>

                    {isFullyDelivered ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800 border border-green-200">
                        ALL DELIVERED
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id={`legacy-minus-${item.id}`}
                          onClick={() => handleLegacyQuantityChange(item.id, -1, remaining)}
                          disabled={isSubmitting || currentQty <= 0}
                          aria-label={`Decrease handover quantity for ${item.garmentName}`}
                          className="w-11 h-11 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 font-bold transition-colors"
                        >
                          <Minus size={16} />
                        </button>

                        <span
                          id={`legacy-qty-${item.id}`}
                          className="w-10 text-center font-bold text-base text-gray-900"
                        >
                          {currentQty}
                        </span>

                        <button
                          type="button"
                          id={`legacy-plus-${item.id}`}
                          onClick={() => handleLegacyQuantityChange(item.id, 1, remaining)}
                          disabled={isSubmitting || currentQty >= remaining}
                          aria-label={`Increase handover quantity for ${item.garmentName}`}
                          className="w-11 h-11 rounded-lg border border-gray-300 bg-gray-50 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-gray-700 font-bold transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Final Handover Notice / Alert */}
        {isFinalHandover && (
          <div
            id="final-handover-banner"
            className={`p-3.5 rounded-xl border text-sm ${
              order.amountDue > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-green-50 border-green-300 text-green-900'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5 mb-1">
              <PackageCheck size={18} />
              Final Order Handover Selected
            </div>
            <p className="text-xs">
              {order.amountDue > 0
                ? 'This pickup delivers all remaining garments. Final handover requires the full balance of ₹' +
                  order.amountDue +
                  ' to be settled.'
                : 'All remaining garments will be delivered. The order will be finalized and marked DELIVERED.'}
            </p>
          </div>
        )}

        {/* 6. Inline Payment Entry Section */}
        {order.amountDue > 0 && (
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <label
                htmlFor="record-payment-checkbox"
                className="text-sm font-bold text-gray-900 flex items-center gap-2 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  id="record-payment-checkbox"
                  checked={recordPayment || isFinalHandover}
                  disabled={isSubmitting || isFinalHandover} // Locked active on final handover
                  onChange={(e) => setRecordPayment(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Record Settlement Payment Now</span>
              </label>
              {isFinalHandover && (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                  Mandatory for final handover
                </span>
              )}
            </div>

            {(recordPayment || isFinalHandover) && (
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="pickup-payment-amount"
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      Payment Amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="pickup-payment-amount"
                      min="0.01"
                      step="0.01"
                      max={order.amountDue}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder={`Due: ₹${order.amountDue}`}
                      className="w-full text-sm font-semibold px-3 py-2.5 border border-gray-300 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pickup-payment-mode"
                      className="block text-xs font-semibold text-gray-700 mb-1"
                    >
                      Payment Mode <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="pickup-payment-mode"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                      className="w-full text-sm px-3 py-2.5 border border-gray-300 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value={PaymentMode.UPI}>UPI</option>
                      <option value={PaymentMode.CASH}>Cash</option>
                      <option value={PaymentMode.CARD}>Card</option>
                      <option value={PaymentMode.ONLINE}>Online / Transfer</option>
                      <option value={PaymentMode.STORE_CREDIT}>Store Credit</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="pickup-payment-reference"
                    className="block text-xs font-semibold text-gray-700 mb-1"
                  >
                    Payment Reference / Transaction ID (Optional)
                  </label>
                  <input
                    type="text"
                    id="pickup-payment-reference"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="e.g. UPI Ref / Card Last 4"
                    className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 7. Optional Notes */}
        <div>
          <label htmlFor="pickup-notes" className="block text-xs font-semibold text-gray-700 mb-1">
            Handover Notes (Optional)
          </label>
          <input
            type="text"
            id="pickup-notes"
            value={pickupNotes}
            onChange={(e) => setPickupNotes(e.target.value)}
            placeholder="e.g. Picked up by customer's brother"
            className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg min-h-[44px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 8. Modal Actions */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t border-gray-200">
          <Button
            variant="outline"
            id="cancel-pickup-modal-btn"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ minHeight: '44px' }}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>

          <Button
            variant="primary"
            id="confirm-pickup-btn"
            onClick={handleSubmitPickup}
            disabled={
              isSubmitting ||
              totalSelectedCount === 0 ||
              (isFinalHandover &&
                order.amountDue > 0 &&
                (!paymentAmount || parseFloat(paymentAmount) <= 0))
            }
            style={{ minHeight: '44px' }}
            className="w-full sm:w-auto font-bold px-6 min-h-[44px]"
            icon={isSubmitting ? <Loader2 className="animate-spin" size={16} /> : undefined}
          >
            {isSubmitting
              ? 'Processing Handover...'
              : isFinalHandover
                ? `Complete Final Handover (${totalSelectedCount} Pieces)`
                : `Confirm Handover (${totalSelectedCount} Pieces)`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
