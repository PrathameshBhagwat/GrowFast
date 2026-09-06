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
    <Modal open={open} onClose={onClose} title="Customer Receipt">
      <div className="space-y-4">
        {/* ─── Controls (Hidden when printing via no-print class) ───────── */}
        <div className="no-print flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Format:</span>
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                id="receipt-format-standard-btn"
                onClick={() => setFormat('standard')}
                className={`px-3 py-2 text-xs font-semibold rounded-l-md border min-h-[44px] transition-colors ${
                  format === 'standard'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Standard (A4)
              </button>
              <button
                type="button"
                id="receipt-format-thermal-btn"
                onClick={() => setFormat('thermal')}
                className={`px-3 py-2 text-xs font-semibold rounded-r-md border border-l-0 min-h-[44px] transition-colors ${
                  format === 'thermal'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
              className="min-h-[44px] text-xs font-semibold"
              icon={<X size={16} />}
            >
              Close
            </Button>
            <Button
              variant="primary"
              id="trigger-print-btn"
              onClick={handlePrint}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] font-bold text-xs px-5 shadow-sm"
              icon={<Printer size={16} />}
            >
              Print Receipt
            </Button>
          </div>
        </div>

        {/* ─── Scrollable Printable Receipt Container ──────────────────── */}
        <div className="max-h-[70vh] overflow-y-auto p-2 bg-gray-100 rounded-lg">
          <OrderReceipt order={order} format={format} id="printable-receipt" />
        </div>
      </div>
    </Modal>
  );
};
