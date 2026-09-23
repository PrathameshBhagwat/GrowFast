import React, { useState } from 'react';
import { Modal, Button, Card } from '@growfast/ui';
import { OrderDetailDTO, PaymentMode } from '@growfast/shared-types';
import { CheckCircle2, Printer } from 'lucide-react';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderDetailDTO;
  onSuccess: () => Promise<void> | void;
  onOpenReceipt?: () => void;
  onOpenReceiptAndPrint?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function PaymentModal({
  open,
  onClose,
  order,
  onSuccess,
  onOpenReceipt,
  onOpenReceiptAndPrint,
}: PaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    amountReceived: number;
  } | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const remainingAfterPayment = Math.max(0, order.amountDue - numAmount);
  const totalPaidAfter = order.amountPaid + numAmount;
  const newStatus = remainingAfterPayment === 0 ? 'PAID' : 'PARTIAL';

  const handleClose = () => {
    if (loading) return;
    setPaymentSuccess(null);
    setAmount('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent duplicate submissions

    if (numAmount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (numAmount > order.amountDue) {
      setError('Amount cannot exceed current balance.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('growfast_token');
      const res = await fetch(`${API_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          amount: numAmount,
          mode: PaymentMode.CASH, // Defaulting to CASH for walk-in MVP
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Payment failed');
      }

      // 1. Backend confirmed payment
      // 2. Refresh authoritative order state from backend
      await onSuccess();

      // 3. Switch to post-payment success screen
      setPaymentSuccess({
        amountReceived: numAmount,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Post-Payment Success State ─────────────────────────────────────────────
  if (paymentSuccess) {
    const isFullyPaid = order.amountDue === 0;

    return (
      <Modal open={open} onClose={handleClose} title="Payment Successful">
        <div className="py-3 text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 size={32} />
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900">Payment Confirmed</h3>
            {isFullyPaid ? (
              <div className="mt-2 space-y-1">
                <p className="text-base font-semibold text-green-700 font-mono">
                  ₹{paymentSuccess.amountReceived.toFixed(2)} received
                </p>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">
                  Order Fully Paid
                </span>
              </div>
            ) : (
              <div className="mt-3 space-y-1.5 bg-gray-50 border border-gray-200 rounded-lg p-3 max-w-xs mx-auto text-left text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">Paid:</span>
                  <span className="font-bold text-gray-900 font-mono">
                    ₹{paymentSuccess.amountReceived.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-amber-700">
                  <span className="font-medium">Remaining:</span>
                  <span className="font-bold font-mono">₹{order.amountDue.toFixed(2)}</span>
                </div>
                <div className="pt-1.5 border-t border-gray-200 flex justify-between text-xs">
                  <span className="text-gray-500 font-medium">Status:</span>
                  <span className="font-bold text-yellow-800 bg-yellow-100 px-2 py-0.5 rounded">
                    PARTIAL
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 justify-center pt-2 border-t border-gray-100">
            <Button
              type="button"
              variant="outline"
              id="post-payment-view-receipt-btn"
              onClick={() => {
                handleClose();
                onOpenReceipt?.();
              }}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-semibold"
            >
              View Receipt
            </Button>
            <Button
              type="button"
              variant="primary"
              id="post-payment-print-receipt-btn"
              onClick={() => {
                handleClose();
                if (onOpenReceiptAndPrint) {
                  onOpenReceiptAndPrint();
                } else if (onOpenReceipt) {
                  onOpenReceipt();
                }
              }}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-bold shadow-sm"
              icon={<Printer size={16} />}
            >
              Print Receipt
            </Button>
          </div>

          <div>
            <button
              type="button"
              id="post-payment-done-btn"
              onClick={handleClose}
              className="text-xs text-gray-500 hover:text-gray-700 underline pt-1 cursor-pointer"
            >
              Done &amp; Return to Order
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // ─── Initial Payment Entry Form ─────────────────────────────────────────────
  return (
    <Modal open={open} onClose={handleClose} title="Record Payment">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}

        <div className="bg-gray-50 p-4 rounded-md space-y-2 mb-4 border border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order Total</span>
            <span className="font-medium font-mono">₹{order.totalAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Already Paid</span>
            <span className="font-medium text-green-600 font-mono">
              ₹{order.amountPaid.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-700">Current Balance Due</span>
            <span className="font-bold text-red-600 font-mono">₹{order.amountDue.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <label
            htmlFor="payment-amount-input"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Payment Amount (₹)
          </label>
          <input
            id="payment-amount-input"
            type="number"
            min="0.01"
            max={order.amountDue}
            step="0.01"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading}
          />
        </div>

        {numAmount > 0 && numAmount <= order.amountDue && (
          <Card className="bg-blue-50/50 border-blue-100">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Simulated After Payment</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-blue-700">New Paid Amount</span>
                <span className="font-medium text-blue-900 font-mono">
                  ₹{totalPaidAfter.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-700">New Balance</span>
                <span className="font-medium text-blue-900 font-mono">
                  ₹{remainingAfterPayment.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1 border-t border-blue-100 mt-1">
                <span className="text-blue-700">Status</span>
                <span className="font-bold text-blue-900">{newStatus}</span>
              </div>
            </div>
          </Card>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            style={{ minHeight: '44px' }}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || numAmount <= 0 || numAmount > order.amountDue}
            style={{ minHeight: '44px' }}
            className="min-h-[44px] font-bold"
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
