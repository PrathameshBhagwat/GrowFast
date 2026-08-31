import React, { useState } from 'react';
import { Modal, Button, Input } from '@growfast/ui';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api';

interface DueDateEditModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  currentDueDate: string;
  onSuccess: () => void;
}

export function DueDateEditModal({
  open,
  onClose,
  orderId,
  currentDueDate,
  onSuccess,
}: DueDateEditModalProps) {
  const { token } = useAuth();

  // Convert ISO string to YYYY-MM-DDTHH:mm format for datetime-local input
  const initialDate = currentDueDate ? new Date(currentDueDate).toISOString().slice(0, 16) : '';

  const [effectiveDueDate, setEffectiveDueDate] = useState(initialDate);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!effectiveDueDate) {
      setError('Due date is required');
      return;
    }
    if (!reason || reason.trim().length < 5) {
      setError('A reason of at least 5 characters is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Ensure we send full ISO string
      const isoDate = new Date(effectiveDueDate).toISOString();

      const res = await fetch(`${API_URL}/orders/${orderId}/due-date`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          effectiveDueDate: isoDate,
          reason,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.message || 'Failed to update due date');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Override Due Date">
      <div className="space-y-4 py-4">
        {error && <div className="text-sm text-red-600 p-2 bg-red-50 rounded">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Due Date</label>
          <Input
            type="datetime-local"
            value={effectiveDueDate}
            onChange={(e) => setEffectiveDueDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Override Reason</label>
          <Input
            type="text"
            placeholder="e.g., Customer requested early delivery"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">Required for audit log (min 5 characters)</p>
        </div>
      </div>
      <div className="flex justify-end gap-3 mt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </Modal>
  );
}
