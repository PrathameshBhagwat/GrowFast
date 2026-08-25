import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import type { OrderSummaryDTO, ApiResponse } from '@growfast/shared-types';
import {
  Package,
  Calendar,
  Clock,
  Zap,
  ArrowRight,
  RefreshCw,
  Info,
  CreditCard,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface CustomerOrderHistoryProps {
  customerId: string;
  customerName: string;
  onNotice?: (msg: string) => void;
}

const STATUS_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  RECEIVED: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  SORTING: { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  PROCESSING: { bg: '#FEF3C7', text: '#B45309', border: '#FDE68A' },
  DRYING: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  IRONING: { bg: '#FEE2E2', text: '#C2410C', border: '#FCA5A5' },
  QUALITY_CHECK: { bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF' },
  PACKED: { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  READY: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
  OUT_FOR_DELIVERY: { bg: '#FFF7ED', text: '#C2410C', border: '#FFEDD5' },
  DELIVERED: { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
  CANCELLED: { bg: '#FEF2F2', text: '#B91C1C', border: '#FCA5A5' },
};

export const CustomerOrderHistory: React.FC<CustomerOrderHistoryProps> = ({
  customerId,
  customerName,
  onNotice,
}) => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [orders, setOrders] = useState<OrderSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCrossTeamSeam, setIsCrossTeamSeam] = useState(false);

  const fetchCustomerOrders = useCallback(async () => {
    if (!customerId) return;

    setIsLoading(true);
    setError(null);
    setIsCrossTeamSeam(false);

    try {
      if (token && !token.startsWith('dev-mock-jwt-')) {
        let res: Response | null = null;
        try {
          res = await fetch(`${API_URL}/orders?customerId=${customerId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } catch {
          res = null;
        }

        if (res && res.ok) {
          const body: ApiResponse<OrderSummaryDTO[]> = await res.json();
          setOrders(Array.isArray(body.data) ? body.data : []);
        } else if (res && res.status === 404) {
          // Endpoint genuinely not implemented by Developer B yet (404 Not Found)
          setIsCrossTeamSeam(true);
          setOrders([]);
        } else if (res && (res.status === 401 || res.status === 403)) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            errBody.message || `Access denied to customer order history (HTTP ${res.status}).`,
          );
        } else if (res && res.status >= 500) {
          throw new Error(`Order service error (HTTP ${res.status}). Please retry.`);
        } else if (res) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.message || `Failed to fetch order history (HTTP ${res.status}).`);
        } else {
          // Network fetch failure when backend server is offline or unreachable
          throw new Error(
            'Unable to connect to backend order service. Please check network connection.',
          );
        }
      } else {
        // Dev mock fallback - Developer B order backend not implemented yet
        setIsCrossTeamSeam(true);
        setOrders([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch customer order history.');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, token]);

  useEffect(() => {
    fetchCustomerOrders();
  }, [fetchCustomerOrders]);

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const handleNotify = (msg: string) => {
    if (onNotice) onNotice(msg);
  };

  return (
    <Card style={{ padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: '#0F172A',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Package size={18} color="#2563EB" />
          Order History ({orders.length})
        </h3>

        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={fetchCustomerOrders}
          disabled={isLoading}
          aria-label="Refresh Order History"
        >
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <LoadingState message="Loading customer order history..." />
      ) : error ? (
        <ErrorState title="Unable to Load Orders" message={error} onRetry={fetchCustomerOrders} />
      ) : isCrossTeamSeam ? (
        <div
          style={{
            background: '#F8FAFC',
            border: '1px dashed #CBD5E1',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <Info size={24} color="#64748B" />
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
            Cross-Team Order Query Integration Seam
          </div>
          <div style={{ fontSize: '0.825rem', color: '#64748B', maxWidth: '480px' }}>
            Developer A frontend customer profile is ready. Pending Developer B implementation of
            backend endpoint <code>GET /api/orders?customerId={customerId}</code>.
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowRight size={14} />}
            onClick={() =>
              handleNotify(
                `Integration Seam Contract: Navigating to Developer B Order Wizard via /orders/new?customerId=${customerId}`,
              )
            }
          >
            Create Order for {customerName}
          </Button>
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="No Past Orders"
          message={`No orders found for ${customerName}.`}
          action={
            <Button
              variant="primary"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() =>
                handleNotify(
                  `Integration Seam Contract: Navigating to Developer B Order Wizard via /orders/new?customerId=${customerId}`,
                )
              }
            >
              Create First Order
            </Button>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {orders.map((order) => {
            const statusStyle = STATUS_COLOR_MAP[order.status] || STATUS_COLOR_MAP.RECEIVED!;

            return (
              <div
                key={order.id}
                style={{
                  padding: '14px 16px',
                  borderRadius: '10px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                      {order.orderNumber}
                    </span>
                    {order.isExpress && (
                      <span
                        style={{
                          background: '#FEF3C7',
                          color: '#B45309',
                          border: '1px solid #FDE68A',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        <Zap size={10} /> EXPRESS
                      </span>
                    )}
                    <span
                      style={{
                        background: statusStyle.bg,
                        color: statusStyle.text,
                        border: `1px solid ${statusStyle.border}`,
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                      }}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      gap: '14px',
                      fontSize: '0.8rem',
                      color: '#64748B',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> Placed: {formatDate(order.orderDate)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Due: {formatDate(order.effectiveDueDate)}
                    </span>
                    <span>Items: {order.itemCount}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                      ₹{order.totalAmount}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                      {order.amountDue > 0 ? (
                        <span style={{ color: '#DC2626', fontWeight: 600 }}>
                          Due: ₹{order.amountDue}
                        </span>
                      ) : (
                        <span style={{ color: '#166534', fontWeight: 600 }}>Paid</span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        navigate(`/orders/${order.id}`);
                      } catch {
                        handleNotify(
                          `Navigating to Developer B Order Details via /orders/${order.id}`,
                        );
                      }
                    }}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
