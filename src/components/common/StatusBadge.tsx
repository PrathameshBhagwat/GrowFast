import React from 'react';
import { ProcessingStage, PaymentStatus } from '../../types';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Package, 
  Sparkles, 
  Truck, 
  Layers,
  Flame,
  CheckSquare
} from 'lucide-react';

interface StatusBadgeProps {
  status: ProcessingStage | PaymentStatus | 'rework' | 'issue' | 'passed' | string;
  type?: 'stage' | 'payment' | 'qc';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'stage', size = 'sm' }) => {
  const normStatus = status?.toLowerCase() || '';

  // Stage badges
  if (type === 'stage' || normStatus in {
    received: 1, sorting: 1, processing: 1, drying: 1, ironing: 1, 
    quality_check: 1, packed: 1, ready: 1, out_for_delivery: 1, delivered: 1
  }) {
    switch (normStatus) {
      case 'received':
        return <span className="badge badge-neutral"><Clock size={12} /> Received</span>;
      case 'sorting':
        return <span className="badge badge-info"><Layers size={12} /> Sorting</span>;
      case 'processing':
        return <span className="badge badge-purple"><Sparkles size={12} /> In Process</span>;
      case 'drying':
        return <span className="badge badge-info"><Flame size={12} /> Drying</span>;
      case 'ironing':
        return <span className="badge badge-warning"><Flame size={12} /> Steam Pressing</span>;
      case 'quality_check':
        return <span className="badge badge-warning"><CheckSquare size={12} /> QC Pending</span>;
      case 'packed':
        return <span className="badge badge-info"><Package size={12} /> Packed</span>;
      case 'ready':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Ready for Pickup</span>;
      case 'out_for_delivery':
        return <span className="badge badge-purple"><Truck size={12} /> Out for Delivery</span>;
      case 'delivered':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Delivered</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  }

  // Payment status badges
  if (type === 'payment') {
    switch (normStatus) {
      case 'paid':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> Paid</span>;
      case 'partial':
        return <span className="badge badge-warning"><Clock size={12} /> Partial</span>;
      case 'pending':
        return <span className="badge badge-danger"><AlertCircle size={12} /> Unpaid</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  }

  // QC badges
  if (type === 'qc') {
    switch (normStatus) {
      case 'passed':
        return <span className="badge badge-success"><CheckCircle2 size={12} /> QC Passed</span>;
      case 'rework':
        return <span className="badge badge-warning"><AlertCircle size={12} /> Rework Req.</span>;
      case 'issue':
        return <span className="badge badge-danger"><AlertCircle size={12} /> QC Flagged</span>;
      default:
        return <span className="badge badge-neutral"><Clock size={12} /> QC Pending</span>;
    }
  }

  return <span className="badge badge-neutral">{status}</span>;
};
