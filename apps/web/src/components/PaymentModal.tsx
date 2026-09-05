import React, { useState } from 'react';
import { Modal, Button, Card } from '@growfast/ui';
import { OrderDetailDTO, PaymentMode } from '@growfast/shared-types';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderDetailDTO;
  onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function PaymentModal({ open, onClose, order, onSuccess }: PaymentModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;
  const remainingAfterPayment = Math.max(0, order.amountDue - numAmount);
  const totalPaidAfter = order.amountPaid + numAmount;
  const newStatus = remainingAfterPayment === 0 ? 'PAID' : 'PARTIAL';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Record Payment">
      <form onSubmit={handleSubmit} className="space-y-4 pt-4">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}

        <div className="bg-gray-50 p-4 rounded-md space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order Total</span>
            <span className="font-medium">₹{order.totalAmount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Already Paid</span>
            <span className="font-medium text-green-600">₹{order.amountPaid}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t">
            <span className="font-bold text-gray-700">Current Balance</span>
            <span className="font-bold text-red-600">₹{order.amountDue}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount (₹)</label>
          <input
            type="number"
            min="1"
            max={order.amountDue}
            step="0.01"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                <span className="font-medium text-blue-900">₹{totalPaidAfter.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-700">New Balance</span>
                <span className="font-medium text-blue-900">
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
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || numAmount <= 0 || numAmount > order.amountDue}
          >
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
