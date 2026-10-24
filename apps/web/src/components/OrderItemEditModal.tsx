import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button } from '@growfast/ui';
import { ItemStatus, OrderItemDTO } from '@growfast/shared-types';
import { useAuth } from '../contexts/AuthContext';

interface OrderItemEditModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  item: OrderItemDTO;
  onSuccess: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

const itemStatusOptions = Object.values(ItemStatus).map((status) => ({
  value: status,
  label: status,
}));

export const OrderItemEditModal: React.FC<OrderItemEditModalProps> = ({
  open,
  onClose,
  orderId,
  item,
  onSuccess,
}) => {
  const { token } = useAuth();

  const isWeightBased = item.weight != null && item.weight > 0;

  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [weight, setWeight] = useState<number | undefined>(item.weight ?? undefined);
  const [deliveredQuantity, setDeliveredQuantity] = useState<number>(item.deliveredQuantity);
  const [itemStatus, setItemStatus] = useState<ItemStatus>(item.itemStatus);
  const [defectNotes, setDefectNotes] = useState<string>(item.defectNotes || '');
  const [colorTagsStr, setColorTagsStr] = useState<string>(item.colorTags?.join(', ') || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPhysicalGarments = Boolean(item.physicalGarments && item.physicalGarments.length > 0);

  // Sync state when item changes
  useEffect(() => {
    if (open) {
      setQuantity(item.quantity);
      setWeight(item.weight ?? undefined);
      setDeliveredQuantity(item.deliveredQuantity);
      setItemStatus(item.itemStatus);
      setDefectNotes(item.defectNotes || '');
      setColorTagsStr(item.colorTags?.join(', ') || '');
      setError(null);
    }
  }, [open, item]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      if (isWeightBased) {
        if (weight == null || isNaN(weight) || weight < 2.0) {
          setError('Minimum permitted weight is 2.00 kg');
          setSaving(false);
          return;
        }
      }

      const colorTags = colorTagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: Record<string, any> = {
        quantity,
        deliveredQuantity,
        defectNotes,
        colorTags,
      };

      if (isWeightBased) {
        payload.weight = Number(weight);
      }

      if (!hasPhysicalGarments) {
        payload.itemStatus = itemStatus;
      }

      const res = await fetch(`${API_URL}/orders/${orderId}/items/${item.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to update item');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Item: ${item.garmentName}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {isWeightBased ? (
            <div>
              <label htmlFor="item-weight" className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">
                Weight (kg)
              </label>
              <div className="relative">
                <input
                  id="item-weight"
                  type="number"
                  step="0.01"
                  min="2.00"
                  value={weight ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                    setWeight(val);
                  }}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface-inset)] p-2.5 pr-10 min-h-[44px] text-[var(--text-primary)] shadow-[var(--shadow-neu-inset)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <span className="absolute right-3 top-3 text-xs text-[var(--text-secondary)] font-semibold pointer-events-none">
                  kg
                </span>
              </div>
              <div className="mt-1.5 flex flex-col text-xs text-[var(--text-secondary)]">
                <span>Rate: ₹{item.unitPrice}/kg</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  New Total: ₹{((weight ?? 0) * item.unitPrice).toFixed(2)}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label
                htmlFor="item-quantity"
                className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5"
              >
                Quantity
              </label>
              <input
                id="item-quantity"
                type="number"
                min="1"
                value={quantity}
                disabled={hasPhysicalGarments}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface-inset)] p-2.5 min-h-[44px] text-[var(--text-primary)] shadow-[var(--shadow-neu-inset)] focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-[var(--bg-surface-hover)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed"
              />
              {hasPhysicalGarments && (
                <span className="text-xs text-[var(--text-muted)] mt-1 block">Fixed by physical garments</span>
              )}
            </div>
          )}
          <div>
            <label
              htmlFor="item-delivered-quantity"
              className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5"
            >
              {isWeightBased ? 'Delivered Batch' : 'Delivered Quantity'}
            </label>
            <input
              id="item-delivered-quantity"
              type="number"
              min="0"
              max={quantity}
              value={deliveredQuantity}
              onChange={(e) => setDeliveredQuantity(Number(e.target.value))}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface-inset)] p-2.5 min-h-[44px] text-[var(--text-primary)] shadow-[var(--shadow-neu-inset)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {isWeightBased && (
              <span className="text-xs text-[var(--text-muted)] mt-1 block">1 = full batch delivered</span>
            )}
          </div>
        </div>

        {hasPhysicalGarments ? (
          <div>
            <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">Status</label>
            <div
              id="derived-item-status"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface-inset)] p-3 text-sm font-medium text-[var(--text-primary)] min-h-[44px] flex items-center justify-between shadow-[var(--shadow-neu-inset)]"
            >
              <span className="font-semibold text-[var(--text-primary)]">{item.itemStatus}</span>
              <span className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 px-2.5 py-0.5 rounded-full font-semibold">
                Derived from garments
              </span>
            </div>
          </div>
        ) : (
          <Select
            id="item-status"
            label="Item Status"
            options={itemStatusOptions}
            value={itemStatus}
            onChange={(e) => setItemStatus(e.target.value as ItemStatus)}
          />
        )}

        <Input
          id="color-tags"
          label="Color Tags (comma separated)"
          value={colorTagsStr}
          onChange={(e) => setColorTagsStr(e.target.value)}
          placeholder="e.g. Red, Blue Stripe"
        />

        <div>
          <label className="block text-sm font-semibold text-[var(--text-primary)] mb-1.5">Defect Notes</label>
          <textarea
            value={defectNotes}
            onChange={(e) => setDefectNotes(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface-inset)] p-3 min-h-[44px] text-[var(--text-primary)] shadow-[var(--shadow-neu-inset)] focus:ring-2 focus:ring-blue-500 focus:outline-none"
            placeholder="e.g. Missing button, torn collar..."
            rows={3}
          />
        </div>

        {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

        <div className="flex gap-3 pt-4">
          <Button
            id="cancel-edit-item"
            variant="secondary"
            onClick={onClose}
            fullWidth
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            id="save-edit-item"
            variant="primary"
            onClick={handleSave}
            fullWidth
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
