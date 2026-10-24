import React, { useState } from 'react';
import { Modal, Button } from '@growfast/ui';
import { OrderDetailDTO } from '@growfast/shared-types';
import { OrderReceipt } from './OrderReceipt';
import { Printer, X } from 'lucide-react';

export interface OrderReceiptModalProps {
  open: boolean;
  onClose: () => void;
  order: OrderDetailDTO;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({ open, onClose, order }) => {
  const [format, setFormat] = useState<'standard' | 'thermal'>('standard');

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Customer Receipt"
      width={format === 'thermal' ? '440px' : '680px'}
    >
      <div className="space-y-4">
        {/* ─── Controls (Hidden when printing via no-print class) ───────── */}
        <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-[var(--bg-surface-inset)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-neu-inset)]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)]">Format:</span>
            <div className="inline-flex p-0.5 rounded-xl bg-[var(--bg-surface)] shadow-[var(--shadow-neu-card-sm)] border border-[var(--border)]">
              <button
                type="button"
                id="receipt-format-standard-btn"
                onClick={() => setFormat('standard')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[44px] transition-colors cursor-pointer ${
                  format === 'standard'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Standard (A4)
              </button>
              <button
                type="button"
                id="receipt-format-thermal-btn"
                onClick={() => setFormat('thermal')}
                className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[44px] transition-colors cursor-pointer ${
                  format === 'thermal'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Thermal (80mm)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              id="close-receipt-modal-btn"
              onClick={onClose}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-semibold rounded-full shadow-[var(--shadow-neu-card-sm)] border border-[var(--border)]"
              icon={<X size={16} />}
            >
              Close
            </Button>
            <Button
              variant="primary"
              id="trigger-print-btn"
              onClick={handlePrint}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] font-bold text-xs px-5 rounded-full shadow-[var(--shadow-neu-card-sm)] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              icon={<Printer size={16} />}
            >
              Print Receipt
            </Button>
          </div>
        </div>

        {/* ─── Scrollable Printable Receipt Container ──────────────────── */}
        <div className="max-h-[70vh] overflow-y-auto p-2 bg-[var(--bg-surface-inset)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-neu-inset)]">
          <OrderReceipt order={order} format={format} id="printable-receipt" />
        </div>
      </div>
    </Modal>
  );
};
