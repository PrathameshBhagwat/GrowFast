import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState, EmptyState, ErrorState, Modal } from '@growfast/ui';
import { PhotoCapture } from '@growfast/ui';
import { uploadPhoto } from '../services/photo.api';
import type { DeliveryRecordDTO } from '@growfast/shared-types';
import { DeliveryStatus, PhotoType } from '@growfast/shared-types';
import { fetchDeliveries, updateDeliveryStatus, completeDelivery } from '../services/delivery.api';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SCHEDULED: { bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' },
  ASSIGNED: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  IN_TRANSIT: { bg: '#EFF6FF', text: '#1E40AF', border: '#BFDBFE' },
  COMPLETED: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
  FAILED: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
};

type FilterTab = 'ALL' | 'ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED' | 'FAILED';

export const DeliveryPage: React.FC = () => {
  const { employee, token } = useAuth();
  const [deliveries, setDeliveries] = useState<DeliveryRecordDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal State
  const [completingDelivery, setCompletingDelivery] = useState<DeliveryRecordDTO | null>(null);
  const [deliveredQuantities, setDeliveredQuantities] = useState<Record<string, number>>({});
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const isDriver = employee?.role === 'DELIVERY';

  const loadDeliveries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDeliveries();
      setDeliveries(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const handleStartDelivery = async (id: string) => {
    if (!confirm('Start this delivery?')) return;
    try {
      setActionLoading(id);
      await updateDeliveryStatus(id, { status: DeliveryStatus.IN_TRANSIT });
      await loadDeliveries();
    } catch (err: any) {
      alert(err.message || 'Failed to start delivery');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenCompleteModal = (delivery: DeliveryRecordDTO) => {
    const initialQuantities: Record<string, number> = {};
    if (delivery.items) {
      delivery.items.forEach((item) => {
        // default to remaining quantity
        initialQuantities[item.id] = Math.max(0, item.quantity - item.deliveredQuantity);
      });
    }
    setDeliveredQuantities(initialQuantities);
    setProofPhoto(null);
    setCompletingDelivery(delivery);
  };

  const submitCompleteDelivery = async () => {
    if (!completingDelivery) return;
    try {
      setUploadingPhoto(true);
      let proofPhotoUrl: string | undefined = undefined;

      // Upload proof photo if captured
      if (proofPhoto && token) {
        try {
          const photoResult = await uploadPhoto(
            token,
            proofPhoto,
            completingDelivery.orderId,
            PhotoType.DELIVERY_PROOF,
          );
          proofPhotoUrl = photoResult.url;
        } catch (photoErr: any) {
          console.error('Photo upload failed:', photoErr);
          const proceed = window.confirm(
            'The proof photo failed to upload. Do you want to complete the delivery without the photo?',
          );
          if (!proceed) {
            setUploadingPhoto(false);
            return;
          }
        }
      }

      // Collect only the items with > 0 delivery quantity in this trip
      const deliveredItems = Object.entries(deliveredQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => ({ itemId, quantity: qty }));

      await completeDelivery(completingDelivery.id, {
        notes: 'Delivered',
        proofPhotoUrl,
        deliveredItems: deliveredItems.length > 0 ? deliveredItems : undefined,
      });

      setCompletingDelivery(null);
      await loadDeliveries();
    } catch (err: any) {
      alert(err.message || 'Failed to complete delivery');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleMarkFailed = async (id: string) => {
    const reason = prompt('Why did the delivery fail?');
    if (!reason) return;
    try {
      setActionLoading(id);
      await updateDeliveryStatus(id, { status: DeliveryStatus.FAILED, notes: reason });
      await loadDeliveries();
    } catch (err: any) {
      alert(err.message || 'Failed to update delivery');
    } finally {
      setActionLoading(null);
    }
  };

  const filtered =
    activeTab === 'ALL' ? deliveries : deliveries.filter((d) => d.status === activeTab);

  if (loading) return <LoadingState message="Loading deliveries..." fullPage />;
  if (error) return <ErrorState message={error} onRetry={loadDeliveries} />;

  const tabs: FilterTab[] = ['ALL', 'ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'FAILED'];

  return (
    <div style={{ padding: '16px', maxWidth: 800, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
          {isDriver ? 'My Deliveries' : 'Delivery Management'}
        </h1>
        <Button variant="secondary" onClick={loadDeliveries} style={{ minHeight: 44 }}>
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: activeTab === tab ? '2px solid #3B82F6' : '1px solid #E5E7EB',
              background: activeTab === tab ? '#EFF6FF' : '#FFF',
              color: activeTab === tab ? '#1E40AF' : '#6B7280',
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 14,
              cursor: 'pointer',
              minHeight: 44,
              whiteSpace: 'nowrap',
            }}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Delivery List */}
      {filtered.length === 0 ? (
        <EmptyState message="No deliveries found" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((d) => (
            <Card key={d.id} style={{ padding: 16 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{d.orderNumber}</div>
                  <div style={{ color: '#6B7280', fontSize: 14, marginTop: 2 }}>
                    {d.customerName}
                  </div>
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: '9999px',
                    background: (STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).bg,
                    color: (STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).text,
                    border: `1px solid ${(STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).border}`,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: (STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).text,
                      flexShrink: 0,
                    }}
                  />
                  {d.status.replace('_', ' ')}
                </span>
              </div>

              <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
                <strong>Address:</strong> {d.address}
              </div>

              {d.riderName && (
                <div style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
                  <strong>Driver:</strong> {d.riderName}
                </div>
              )}

              {d.completedAt && (
                <div style={{ fontSize: 14, color: '#059669', marginBottom: 8 }}>
                  <strong>Completed:</strong> {new Date(d.completedAt).toLocaleString()}
                </div>
              )}

              {d.notes && (
                <div
                  style={{ fontSize: 13, color: '#6B7280', marginBottom: 8, fontStyle: 'italic' }}
                >
                  {d.notes}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {d.status === DeliveryStatus.ASSIGNED && (
                  <Button
                    variant="primary"
                    onClick={() => handleStartDelivery(d.id)}
                    disabled={actionLoading === d.id}
                    style={{ minHeight: 44, flex: 1 }}
                  >
                    {actionLoading === d.id ? 'Starting...' : '🚚 Start Delivery'}
                  </Button>
                )}

                {d.status === DeliveryStatus.IN_TRANSIT && (
                  <>
                    <Button
                      variant="primary"
                      onClick={() => handleOpenCompleteModal(d)}
                      disabled={actionLoading === d.id}
                      style={{ minHeight: 44, flex: 1 }}
                    >
                      ✅ Mark Delivered
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleMarkFailed(d.id)}
                      disabled={actionLoading === d.id}
                      style={{ minHeight: 44 }}
                    >
                      ❌ Failed
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Complete Delivery Modal */}
      {completingDelivery && (
        <Modal
          title="Complete Delivery"
          open={!!completingDelivery}
          onClose={() => setCompletingDelivery(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, color: '#4B5563', fontSize: 14 }}>
              Confirm the quantities delivered for Order {completingDelivery.orderNumber}.
            </p>

            {completingDelivery.items?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {completingDelivery.items.map((item) => {
                  const maxAllowed = item.quantity - item.deliveredQuantity;
                  if (item.itemStatus === 'CANCELLED' || maxAllowed <= 0) return null;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px',
                        background: '#F9FAFB',
                        borderRadius: '8px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>
                          Item #{item.id.slice(-4)}
                        </div>
                        <div style={{ fontSize: 12, color: '#6B7280' }}>
                          Ordered: {item.quantity} | Delivered: {item.deliveredQuantity}
                        </div>
                      </div>
                      <input
                        type="number"
                        min={0}
                        max={maxAllowed}
                        value={deliveredQuantities[item.id] ?? 0}
                        onChange={(e) =>
                          setDeliveredQuantities((prev) => ({
                            ...prev,
                            [item.id]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        style={{
                          width: 60,
                          padding: '6px',
                          borderRadius: '4px',
                          border: '1px solid #D1D5DB',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '8px',
                  background: '#FEF2F2',
                  color: '#991B1B',
                  borderRadius: '8px',
                  fontSize: 14,
                }}
              >
                No items found for this order.
              </div>
            )}

            <div style={{ marginTop: 8 }}>
              <PhotoCapture
                label="Proof of Delivery (Optional)"
                onCapture={setProofPhoto}
                onRemove={() => setProofPhoto(null)}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <Button
                variant="secondary"
                onClick={() => setCompletingDelivery(null)}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={uploadingPhoto}
                onClick={submitCompleteDelivery}
                style={{ flex: 1 }}
              >
                {uploadingPhoto ? 'Submitting...' : 'Confirm Delivery'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DeliveryPage;
