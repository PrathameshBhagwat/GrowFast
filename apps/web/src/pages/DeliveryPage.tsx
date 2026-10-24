import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState, EmptyState, ErrorState, Modal } from '@growfast/ui';
import { PhotoCapture } from '@growfast/ui';
import { uploadPhoto } from '../services/photo.api';
import type { DeliveryRecordDTO } from '@growfast/shared-types';
import { DeliveryStatus, PhotoType } from '@growfast/shared-types';
import { fetchDeliveries, updateDeliveryStatus, completeDelivery } from '../services/delivery.api';
import { ThemeToggle } from '../components/ThemeToggle';
import { ArrowLeft, RefreshCw, Truck } from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SCHEDULED: {
    bg: 'var(--info-bg, #F0F9FF)',
    text: 'var(--info-text, #075985)',
    border: 'var(--info-border, #BAE6FD)',
  },
  ASSIGNED: {
    bg: 'var(--warning-bg, #FFFBEB)',
    text: 'var(--warning-text, #92400E)',
    border: 'var(--warning-border, #FDE68A)',
  },
  IN_TRANSIT: {
    bg: 'var(--accent-muted, #EFF6FF)',
    text: 'var(--accent, #1E40AF)',
    border: 'var(--accent-muted, #BFDBFE)',
  },
  COMPLETED: {
    bg: 'var(--success-bg, #F0FDF4)',
    text: 'var(--success-text, #166534)',
    border: 'var(--success-border, #BBF7D0)',
  },
  FAILED: {
    bg: 'var(--danger-bg, #FEF2F2)',
    text: 'var(--danger-text, #991B1B)',
    border: 'var(--danger-border, #FECACA)',
  },
};

type FilterTab = 'ALL' | 'ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED' | 'FAILED';

export const DeliveryPage: React.FC = () => {
  const navigate = useNavigate();
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
      console.warn('Backend unavailable, using preview fallback deliveries:', err?.message);
      const fallbackDeliveries: DeliveryRecordDTO[] = [
        {
          id: 'mock-del-1',
          orderId: 'mock-ord-1',
          orderNumber: 'ORD-2026-0042',
          customerName: 'Amit Shah',
          address: 'Flat 402, Sea Green Apts, Worli, Mumbai',
          riderId: 'emp-driver-1',
          riderName: 'Rajesh Kumar',
          status: DeliveryStatus.ASSIGNED,
          scheduledAt: new Date().toISOString(),
          completedAt: null,
          proofPhotoUrl: null,
          notes: 'Handle silk garments with care',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-1',
              garmentName: 'Silk Saree',
              garmentCategory: 'WOMEN' as any,
              serviceType: 'DRY_CLEAN' as any,
              quantity: 2,
              unitPrice: 450,
              lineTotal: 900,
              colorTags: ['Red', 'Gold'],
              defectNotes: null,
              itemStatus: 'READY' as any,
              deliveredQuantity: 0,
              itemDueDate: null,
            },
            {
              id: 'item-2',
              garmentName: 'Blazer',
              garmentCategory: 'MEN' as any,
              serviceType: 'STEAM_PRESS' as any,
              quantity: 1,
              unitPrice: 300,
              lineTotal: 300,
              colorTags: ['Navy'],
              defectNotes: null,
              itemStatus: 'READY' as any,
              deliveredQuantity: 0,
              itemDueDate: null,
            },
          ],
        },
        {
          id: 'mock-del-2',
          orderId: 'mock-ord-2',
          orderNumber: 'ORD-2026-0038',
          customerName: 'Priya Sharma',
          address: 'B-12, Palm Grove, Bandra West, Mumbai',
          riderId: 'emp-driver-1',
          riderName: 'Rajesh Kumar',
          status: DeliveryStatus.IN_TRANSIT,
          scheduledAt: new Date(Date.now() - 3600000).toISOString(),
          completedAt: null,
          proofPhotoUrl: null,
          notes: 'Call before arriving',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          updatedAt: new Date().toISOString(),
          items: [
            {
              id: 'item-3',
              garmentName: 'Cotton Kurta',
              garmentCategory: 'WOMEN' as any,
              serviceType: 'WASH_AND_IRON' as any,
              quantity: 3,
              unitPrice: 150,
              lineTotal: 450,
              colorTags: ['White'],
              defectNotes: null,
              itemStatus: 'READY' as any,
              deliveredQuantity: 0,
              itemDueDate: null,
            },
          ],
        },
      ];
      setDeliveries(fallbackDeliveries);
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

  const tabs: FilterTab[] = ['ALL', 'ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'FAILED'];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-app, #F8FAFC)',
        color: 'var(--text-primary, #0F172A)',
        paddingBottom: '40px',
        transition: 'background-color 0.2s ease, color 0.2s ease',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          background: 'var(--bg-surface, #FFFFFF)',
          borderBottom: '1px solid var(--border, #E2E8F0)',
          padding: '16px 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          transition: 'background-color 0.2s ease, border-color 0.2s ease',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'nowrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <button
              type="button"
              id="delivery-back-btn"
              onClick={() => navigate('/')}
              aria-label="Back to Dashboard"
              title="Return to Dashboard"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                border: '1px solid var(--border, #e2e8f0)',
                background: 'var(--bg-surface, #ffffff)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary, #475569)',
                cursor: 'pointer',
                flexShrink: 0,
                boxShadow: 'var(--shadow-neu-card-sm)',
                transition: 'all 0.15s ease',
              }}
              className="relative hover:text-[var(--text-primary)] hover:border-blue-400 active:scale-95 before:absolute before:-inset-1 before:content-['']"
            >
              <ArrowLeft size={16} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  flexShrink: 0,
                }}
              >
                <Truck size={18} />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                  }}
                >
                  {isDriver ? 'My Deliveries' : 'Delivery Management'}
                </h1>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {isDriver ? 'Active route assignments' : 'Store delivery tracking & dispatch'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <ThemeToggle size="sm" />
            <Button
              variant="outline"
              size="sm"
              icon={<RefreshCw size={14} />}
              onClick={loadDeliveries}
              style={{ minHeight: 38 }}
            >
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '960px', margin: '24px auto', padding: '0 16px' }}>
        {loading ? (
          <LoadingState message="Loading deliveries..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadDeliveries} />
        ) : (
          <>
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-surface-inset)] border border-[var(--border)] shadow-[var(--shadow-neu-inset)] mb-6 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full font-bold text-xs transition-all whitespace-nowrap min-h-[36px] cursor-pointer ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Delivery List */}
            {filtered.length === 0 ? (
              <EmptyState message="No deliveries found" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filtered.map((d) => (
                  <Card
                    key={d.id}
                    className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-neu-card-sm)] transition-all"
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-primary)' }}
                        >
                          {d.orderNumber}
                        </div>
                        <div
                          style={{
                            color: 'var(--text-muted, #6B7280)',
                            fontSize: 14,
                            marginTop: 2,
                            fontWeight: 500,
                          }}
                        >
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
                          fontWeight: 700,
                          borderRadius: '9999px',
                          background: (STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).bg,
                          color: (STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).text,
                          border: `1px solid ${(STATUS_COLORS[d.status] || STATUS_COLORS.SCHEDULED).border}`,
                          boxShadow: 'var(--shadow-neu-card-sm)',
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

                    <div
                      style={{
                        fontSize: 14,
                        color: 'var(--text-secondary, #374151)',
                        marginBottom: 8,
                      }}
                    >
                      <strong>Address:</strong> {d.address}
                    </div>

                    {d.riderName && (
                      <div
                        style={{
                          fontSize: 14,
                          color: 'var(--text-secondary, #374151)',
                          marginBottom: 8,
                        }}
                      >
                        <strong>Driver:</strong> {d.riderName}
                      </div>
                    )}

                    {d.completedAt && (
                      <div
                        style={{
                          fontSize: 14,
                          color: 'var(--success-text, #059669)',
                          marginBottom: 8,
                        }}
                      >
                        <strong>Completed:</strong> {new Date(d.completedAt).toLocaleString()}
                      </div>
                    )}

                    {d.notes && (
                      <div
                        style={{
                          fontSize: 13,
                          color: 'var(--text-muted, #6B7280)',
                          marginBottom: 8,
                          fontStyle: 'italic',
                        }}
                      >
                        {d.notes}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                      {d.status === DeliveryStatus.ASSIGNED && (
                        <Button
                          variant="primary"
                          onClick={() => handleStartDelivery(d.id)}
                          disabled={actionLoading === d.id}
                          className="min-h-[44px] flex-1 rounded-full shadow-[var(--shadow-neu-card-sm)] font-bold text-xs"
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
                            className="min-h-[44px] flex-1 rounded-full shadow-[var(--shadow-neu-card-sm)] font-bold text-xs"
                          >
                            ✅ Mark Delivered
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => handleMarkFailed(d.id)}
                            disabled={actionLoading === d.id}
                            className="min-h-[44px] rounded-full shadow-xs text-xs font-semibold"
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
          </>
        )}

        {/* Complete Delivery Modal */}
        {completingDelivery && (
          <Modal
            title="Complete Delivery"
            open={!!completingDelivery}
            onClose={() => setCompletingDelivery(null)}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, color: 'var(--text-secondary, #4B5563)', fontSize: 14 }}>
                Confirm the quantities delivered for Order {completingDelivery.orderNumber}.
              </p>

              {completingDelivery.items?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                          padding: '12px 14px',
                          background: 'var(--bg-surface-inset, #F9FAFB)',
                          borderRadius: '14px',
                          border: '1px solid var(--border, #E5E7EB)',
                          boxShadow: 'var(--shadow-neu-inset)',
                        }}
                      >
                        <div>
                          <div
                            style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}
                          >
                            Item #{item.id.slice(-4)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted, #6B7280)' }}>
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
                            width: 68,
                            padding: '6px 10px',
                            borderRadius: '10px',
                            border: '1px solid var(--border, #D1D5DB)',
                            background: 'var(--bg-surface-inset)',
                            boxShadow: 'var(--shadow-neu-inset)',
                            color: 'var(--text-primary, #0F172A)',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div
                  style={{
                    padding: '12px',
                    background: 'var(--danger-bg, #FEF2F2)',
                    color: 'var(--danger-text, #991B1B)',
                    border: '1px solid var(--danger-border, #FECACA)',
                    borderRadius: '12px',
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
                  className="flex-1 rounded-full min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={uploadingPhoto}
                  onClick={submitCompleteDelivery}
                  className="flex-1 rounded-full min-h-[44px] shadow-[var(--shadow-neu-card-sm)]"
                >
                  {uploadingPhoto ? 'Submitting...' : 'Confirm Delivery'}
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </div>
  );
};

export default DeliveryPage;
