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

  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [deliveredQuantity, setDeliveredQuantity] = useState<number>(item.deliveredQuantity);
  const [itemStatus, setItemStatus] = useState<ItemStatus>(item.itemStatus);
  const [defectNotes, setDefectNotes] = useState<string>(item.defectNotes || '');
  const [colorTagsStr, setColorTagsStr] = useState<string>(item.colorTags?.join(', ') || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when item changes
  useEffect(() => {
    if (open) {
      setQuantity(item.quantity);
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
      const colorTags = colorTagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        quantity,
        deliveredQuantity,
        itemStatus,
        defectNotes,
        colorTags,
      };

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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 p-2 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivered Quantity
            </label>
            <input
              type="number"
              min="0"
              max={quantity}
              value={deliveredQuantity}
              onChange={(e) => setDeliveredQuantity(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 p-2 min-h-[44px]"
            />
          </div>
        </div>

        <Select
          id="item-status"
          label="Item Status"
          options={itemStatusOptions}
          value={itemStatus}
          onChange={(e) => setItemStatus(e.target.value as ItemStatus)}
        />

        <Input
          id="color-tags"
          label="Color Tags (comma separated)"
          value={colorTagsStr}
          onChange={(e) => setColorTagsStr(e.target.value)}
          placeholder="e.g. Red, Blue Stripe"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Defect Notes</label>
          <textarea
            value={defectNotes}
            onChange={(e) => setDefectNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 min-h-[44px]"
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
