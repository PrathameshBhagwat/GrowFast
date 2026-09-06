import React, { useState } from 'react';
import { Modal, Button, Card } from '@growfast/ui';
import { OrderDetailDTO, AdjustmentType } from '@growfast/shared-types';
import { Loader2 } from 'lucide-react';

interface FinancialAdjustmentModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderDetailDTO;
  onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function FinancialAdjustmentModal({
  open,
  onClose,
  order,
  onSuccess,
}: FinancialAdjustmentModalProps) {
  const existingRefunds = order.refundAmount || 0;
  const existingStoreCredits = order.storeCreditAmount || 0;
  const existingAdjustments = existingRefunds + existingStoreCredits;
  const maxEligible = Math.max(
    0,
    Number((order.amountPaid - order.totalAmount - existingAdjustments).toFixed(2)),
  );

  const [type, setType] = useState<AdjustmentType>(AdjustmentType.REFUND);
  const [amount, setAmount] = useState<string>(maxEligible > 0 ? maxEligible.toString() : '');
  const [reason, setReason] = useState<string>('');
  const [reference, setReference] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Adjustment amount must be greater than zero.');
      return;
    }
    if (numAmount > maxEligible) {
      setError(`Amount cannot exceed the maximum eligible amount of ₹${maxEligible}.`);
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required for financial adjustments.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('growfast_token');
      const res = await fetch(`${API_URL}/orders/${order.id}/adjustments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          amount: numAmount,
          reason: reason.trim(),
          reference: reference.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Financial adjustment failed');
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
    <Modal open={open} onClose={onClose} title="Financial Adjustment">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">{error}</div>}

        <div className="bg-gray-50 p-4 rounded-md space-y-2 mb-2 border border-gray-200">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order Total</span>
            <span className="font-medium text-gray-900">₹{order.totalAmount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total Paid</span>
            <span className="font-medium text-green-600">₹{order.amountPaid}</span>
          </div>
          {existingRefunds > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Already Refunded</span>
              <span className="font-medium text-orange-600">-₹{existingRefunds}</span>
            </div>
          )}
          {existingStoreCredits > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Already Credited</span>
              <span className="font-medium text-blue-600">₹{existingStoreCredits}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-700">Maximum Eligible Adjustment</span>
            <span className="font-bold text-blue-700">₹{maxEligible}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType(AdjustmentType.REFUND)}
              className={`py-2 px-3 text-sm font-semibold rounded-md border min-h-[44px] transition-colors ${
                type === AdjustmentType.REFUND
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Refund (Cash / Bank)
            </button>
            <button
              type="button"
              onClick={() => setType(AdjustmentType.STORE_CREDIT)}
              className={`py-2 px-3 text-sm font-semibold rounded-md border min-h-[44px] transition-colors ${
                type === AdjustmentType.STORE_CREDIT
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Store Credit
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
          <input
            id="adjustment-amount-input"
            type="number"
            min="0.01"
            max={maxEligible}
            step="0.01"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={loading || maxEligible <= 0}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <input
            id="adjustment-reason-input"
            type="text"
            required
            placeholder="e.g. Customer requested piece cancellation"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reference / Note (Optional)
          </label>
          <input
            id="adjustment-reference-input"
            type="text"
            placeholder="e.g. Voucher #1024 or UPI transaction ID"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px]"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={loading}
            style={{ minHeight: '44px' }}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || numAmount <= 0 || numAmount > maxEligible || !reason.trim()}
            style={{ minHeight: '44px' }}
            icon={loading ? <Loader2 className="animate-spin" size={16} /> : undefined}
          >
            {loading
              ? 'Processing...'
              : type === AdjustmentType.REFUND
                ? 'Issue Refund'
                : 'Grant Store Credit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
