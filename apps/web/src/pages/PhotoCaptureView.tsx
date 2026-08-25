import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PhotoCapture, Button, Card, LoadingState, EmptyState, ErrorState } from '@growfast/ui';
import { PhotoType } from '@growfast/shared-types';
import type { OrderPhotoDTO } from '@growfast/shared-types';
import { uploadPhoto, getOrderPhotos } from '../services/photo.api';
import { ArrowLeft, Camera, CheckCircle, SkipForward, AlertCircle, ImageIcon } from 'lucide-react';

// ── Photo category configuration ────────────────────────────────────

interface PhotoCategory {
  type: PhotoType;
  label: string;
  description: string;
  skippable: boolean;
}

/**
 * Categories for intake photo capture.
 * DELIVERY_PROOF is excluded — that belongs to the Delivery feature.
 */
const INTAKE_CATEGORIES: PhotoCategory[] = [
  {
    type: PhotoType.FRONT,
    label: 'Front View',
    description: 'Take a photo of the garment from the front',
    skippable: false,
  },
  {
    type: PhotoType.BACK,
    label: 'Back View',
    description: 'Take a photo of the garment from the back',
    skippable: false,
  },
  {
    type: PhotoType.DAMAGE,
    label: 'Damage',
    description: 'Document any pre-existing damage',
    skippable: true,
  },
  {
    type: PhotoType.STAIN,
    label: 'Stain',
    description: 'Document any stains for treatment',
    skippable: true,
  },
  {
    type: PhotoType.TAG,
    label: 'Care Label / Tag',
    description: 'Photograph the garment care label',
    skippable: true,
  },
];

// ── Per-category capture state ──────────────────────────────────────

type CaptureStatus = 'not_started' | 'uploading' | 'uploaded' | 'upload_failed' | 'skipped';

interface CaptureState {
  status: CaptureStatus;
  /** Error message from a failed upload */
  error?: string;
  /** The OrderPhotoDTO returned after successful upload */
  photo?: OrderPhotoDTO;
}

type CaptureStates = Record<string, CaptureState>;

function initialCaptureStates(): CaptureStates {
  const states: CaptureStates = {};
  for (const cat of INTAKE_CATEGORIES) {
    states[cat.type] = { status: 'not_started' };
  }
  return states;
}

// ── Gallery grouping helper ─────────────────────────────────────────

function groupPhotosByType(photos: OrderPhotoDTO[]): Record<string, OrderPhotoDTO[]> {
  const groups: Record<string, OrderPhotoDTO[]> = {};
  for (const photo of photos) {
    if (!groups[photo.type]) {
      groups[photo.type] = [];
    }
    groups[photo.type].push(photo);
  }
  return groups;
}

/** Human-friendly label for a PhotoType */
function photoTypeLabel(type: string): string {
  const map: Record<string, string> = {
    FRONT: 'Front View',
    BACK: 'Back View',
    DAMAGE: 'Damage',
    STAIN: 'Stain',
    TAG: 'Care Label / Tag',
    DELIVERY_PROOF: 'Delivery Proof',
  };
  return map[type] || type;
}

// ═════════════════════════════════════════════════════════════════════
// PhotoCaptureView Component
// ═════════════════════════════════════════════════════════════════════

export const PhotoCaptureView: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  // ── Capture workflow state ──────────────────────────────────────
  const [captureStates, setCaptureStates] = useState<CaptureStates>(initialCaptureStates);

  // ── Gallery state ──────────────────────────────────────────────
  const [galleryPhotos, setGalleryPhotos] = useState<OrderPhotoDTO[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  // ── Load existing photos on mount ──────────────────────────────
  const loadGallery = useCallback(async () => {
    if (!token || !orderId) return;

    setGalleryLoading(true);
    setGalleryError(null);

    try {
      const photos = await getOrderPhotos(token, orderId);
      setGalleryPhotos(photos);
    } catch (err) {
      setGalleryError(err instanceof Error ? err.message : 'Failed to load photos');
    } finally {
      setGalleryLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    loadGallery();
  }, [loadGallery]);

  // ── Handle photo capture → upload ─────────────────────────────
  const handleCapture = useCallback(
    async (type: PhotoType, file: File) => {
      if (!token || !orderId) return;

      // Set uploading state
      setCaptureStates((prev) => ({
        ...prev,
        [type]: { status: 'uploading' },
      }));

      try {
        const photo = await uploadPhoto(token, file, orderId, type);

        setCaptureStates((prev) => ({
          ...prev,
          [type]: { status: 'uploaded', photo },
        }));

        // Refresh gallery to include the new photo
        setGalleryPhotos((prev) => [photo, ...prev]);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setCaptureStates((prev) => ({
          ...prev,
          [type]: { status: 'upload_failed', error: errorMessage },
        }));
      }
    },
    [token, orderId],
  );

  // ── Handle skip ────────────────────────────────────────────────
  const handleSkip = useCallback((type: PhotoType) => {
    setCaptureStates((prev) => ({
      ...prev,
      [type]: { status: 'skipped' },
    }));
  }, []);

  // ── Handle retry ───────────────────────────────────────────────
  const handleRetry = useCallback((type: PhotoType) => {
    setCaptureStates((prev) => ({
      ...prev,
      [type]: { status: 'not_started' },
    }));
  }, []);

  // ── Guard: orderId must exist ──────────────────────────────────
  if (!orderId) {
    return (
      <ErrorState
        title="Missing Order ID"
        message="No order ID was provided. Please navigate from an order."
        onRetry={() => navigate('/')}
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={18} />}
          onClick={() => navigate(-1)}
          style={{ minHeight: '44px', minWidth: '44px' }}
        >
          Back
        </Button>
        <div style={{ flex: 1 }}>
          <h1 style={styles.headerTitle}>Order Photos</h1>
          <p style={styles.headerSubtitle}>Order: {orderId.substring(0, 8)}…</p>
        </div>
        <div style={styles.headerIcon}>
          <Camera size={24} />
        </div>
      </header>

      {/* Capture Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Capture Photos</h2>
        <p style={styles.sectionSubtitle}>
          Take required photos. Optional categories can be skipped if not needed.
        </p>

        <div style={styles.categoryList}>
          {INTAKE_CATEGORIES.map((cat) => {
            const state = captureStates[cat.type] || { status: 'not_started' };
            return (
              <CategoryCard
                key={cat.type}
                category={cat}
                state={state}
                onCapture={(file) => handleCapture(cat.type, file)}
                onSkip={() => handleSkip(cat.type)}
                onRetry={() => handleRetry(cat.type)}
              />
            );
          })}
        </div>
      </section>

      {/* Gallery Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Photo Gallery</h2>
        <p style={styles.sectionSubtitle}>All photos attached to this order.</p>

        {galleryLoading ? (
          <LoadingState message="Loading photos..." />
        ) : galleryError ? (
          <ErrorState title="Could not load photos" message={galleryError} onRetry={loadGallery} />
        ) : galleryPhotos.length === 0 ? (
          <EmptyState
            title="No photos yet"
            message="Photos will appear here after they are captured and uploaded."
            icon={<ImageIcon size={56} strokeWidth={1.5} />}
          />
        ) : (
          <PhotoGallery photos={galleryPhotos} />
        )}
      </section>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// CategoryCard — individual photo type capture card
// ═════════════════════════════════════════════════════════════════════

interface CategoryCardProps {
  category: PhotoCategory;
  state: CaptureState;
  onCapture: (file: File) => void;
  onSkip: () => void;
  onRetry: () => void;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  state,
  onCapture,
  onSkip,
  onRetry,
}) => {
  return (
    <Card padding="md" elevated style={styles.categoryCard}>
      {/* Card header */}
      <div style={styles.categoryHeader}>
        <div style={{ flex: 1 }}>
          <div style={styles.categoryLabelRow}>
            <span style={styles.categoryLabel}>{category.label}</span>
            {!category.skippable && <span style={styles.requiredBadge}>Required</span>}
            {category.skippable && <span style={styles.optionalBadge}>Optional</span>}
          </div>
          <p style={styles.categoryDescription}>{category.description}</p>
        </div>
        <StatusIndicator status={state.status} />
      </div>

      {/* Card body — depends on state */}
      <div style={styles.categoryBody}>
        {state.status === 'not_started' && (
          <div style={styles.captureArea}>
            <PhotoCapture
              onCapture={onCapture}
              allowCamera={true}
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              label=""
            />
            {category.skippable && (
              <Button
                variant="ghost"
                size="md"
                icon={<SkipForward size={16} />}
                onClick={onSkip}
                style={{ minHeight: '44px', marginTop: '8px' }}
              >
                Skip — No {category.label.toLowerCase()} to document
              </Button>
            )}
          </div>
        )}

        {state.status === 'uploading' && (
          <div style={styles.statusArea}>
            <LoadingState message="Uploading photo..." />
          </div>
        )}

        {state.status === 'uploaded' && (
          <div style={styles.statusArea}>
            <div style={styles.successRow}>
              <CheckCircle size={20} color="#059669" />
              <span style={styles.successText}>Photo uploaded successfully</span>
            </div>
            {state.photo?.url && (
              <img
                src={state.photo.url}
                alt={`${category.label} photo`}
                style={styles.uploadedPreview}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        )}

        {state.status === 'upload_failed' && (
          <div style={styles.statusArea}>
            <div style={styles.errorRow}>
              <AlertCircle size={20} color="#EF4444" />
              <span style={styles.errorText}>{state.error || 'Upload failed'}</span>
            </div>
            <Button
              variant="outline"
              size="md"
              onClick={onRetry}
              style={{ minHeight: '44px', marginTop: '12px' }}
            >
              Try Again
            </Button>
          </div>
        )}

        {state.status === 'skipped' && (
          <div style={styles.statusArea}>
            <div style={styles.skippedRow}>
              <SkipForward size={18} color="#94A3B8" />
              <span style={styles.skippedText}>Skipped — no record created</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              style={{ minHeight: '44px', marginTop: '8px' }}
            >
              Undo skip
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};

// ═════════════════════════════════════════════════════════════════════
// StatusIndicator — visual badge for capture state
// ═════════════════════════════════════════════════════════════════════

const StatusIndicator: React.FC<{ status: CaptureStatus }> = ({ status }) => {
  const configs: Record<CaptureStatus, { bg: string; color: string; text: string }> = {
    not_started: { bg: '#F1F5F9', color: '#64748B', text: 'Pending' },
    uploading: { bg: '#DBEAFE', color: '#2563EB', text: 'Uploading' },
    uploaded: { bg: '#D1FAE5', color: '#059669', text: 'Done' },
    upload_failed: { bg: '#FEE2E2', color: '#DC2626', text: 'Failed' },
    skipped: { bg: '#F1F5F9', color: '#94A3B8', text: 'Skipped' },
  };

  const config = configs[status];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '9999px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {config.text}
    </span>
  );
};

// ═════════════════════════════════════════════════════════════════════
// PhotoGallery — displays existing photos grouped by type
// ═════════════════════════════════════════════════════════════════════

const PhotoGallery: React.FC<{ photos: OrderPhotoDTO[] }> = ({ photos }) => {
  const grouped = groupPhotosByType(photos);

  return (
    <div style={styles.galleryContainer}>
      {Object.entries(grouped).map(([type, typePhotos]) => (
        <div key={type} style={styles.galleryGroup}>
          <h3 style={styles.galleryGroupTitle}>{photoTypeLabel(type)}</h3>
          <div style={styles.galleryGrid}>
            {typePhotos.map((photo) => (
              <GalleryImage key={photo.id} photo={photo} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// GalleryImage — individual photo tile with broken image fallback
// ═════════════════════════════════════════════════════════════════════

const GalleryImage: React.FC<{ photo: OrderPhotoDTO }> = ({ photo }) => {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div style={styles.brokenImage}>
        <ImageIcon size={28} color="#CBD5E1" />
        <span style={{ fontSize: '0.7rem', color: '#94A3B8', textAlign: 'center' }}>
          Image unavailable
        </span>
      </div>
    );
  }

  return (
    <div style={styles.galleryImageWrapper}>
      <img
        src={photo.url}
        alt={`${photo.type} photo`}
        style={styles.galleryImage}
        loading="lazy"
        onError={() => setBroken(true)}
      />
      <div style={styles.galleryImageMeta}>
        <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
          {new Date(photo.uploadedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════
// Styles
// ═════════════════════════════════════════════════════════════════════

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: '#F8FAFC',
    fontFamily: "'Inter', sans-serif",
    overflowY: 'auto',
    paddingBottom: '40px',
  },

  // ── Header ──────────────────────────────────────────────────────
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 20px',
    background: '#FFFFFF',
    borderBottom: '1px solid #E2E8F0',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: '1.125rem',
    fontWeight: 800,
    color: '#0F172A',
    margin: 0,
    lineHeight: 1.3,
  },
  headerSubtitle: {
    fontSize: '0.8rem',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.3,
  },
  headerIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#FFFFFF',
    flexShrink: 0,
  },

  // ── Sections ────────────────────────────────────────────────────
  section: {
    padding: '20px',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#0F172A',
    margin: '0 0 4px',
  },
  sectionSubtitle: {
    fontSize: '0.84rem',
    color: '#64748B',
    margin: '0 0 16px',
  },

  // ── Category list ──────────────────────────────────────────────
  categoryList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  categoryCard: {
    transition: 'all 200ms ease',
  },

  // ── Category card internals ────────────────────────────────────
  categoryHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '12px',
  },
  categoryLabelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
  },
  categoryLabel: {
    fontSize: '0.95rem',
    fontWeight: 700,
    color: '#0F172A',
  },
  requiredBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.68rem',
    fontWeight: 600,
    background: '#FEF2F2',
    color: '#DC2626',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  },
  optionalBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.68rem',
    fontWeight: 600,
    background: '#F0FDF4',
    color: '#059669',
    letterSpacing: '0.03em',
    textTransform: 'uppercase' as const,
  },
  categoryDescription: {
    fontSize: '0.8rem',
    color: '#64748B',
    margin: 0,
    lineHeight: 1.4,
  },

  // ── Category body areas ────────────────────────────────────────
  categoryBody: {
    minHeight: '48px',
  },
  captureArea: {
    display: 'flex',
    flexDirection: 'column',
  },
  statusArea: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
  },

  // ── Status rows ────────────────────────────────────────────────
  successRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  successText: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: '#059669',
  },
  errorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  errorText: {
    fontSize: '0.88rem',
    fontWeight: 600,
    color: '#EF4444',
  },
  skippedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  skippedText: {
    fontSize: '0.84rem',
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  // ── Uploaded preview ───────────────────────────────────────────
  uploadedPreview: {
    width: '100%',
    maxWidth: '280px',
    maxHeight: '180px',
    objectFit: 'cover' as const,
    borderRadius: '8px',
    marginTop: '12px',
    border: '1px solid #E2E8F0',
  },

  // ── Gallery ────────────────────────────────────────────────────
  galleryContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  galleryGroup: {},
  galleryGroupTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: '#334155',
    margin: '0 0 10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  galleryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
  },
  galleryImageWrapper: {
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #E2E8F0',
    background: '#FFFFFF',
  },
  galleryImage: {
    width: '100%',
    height: '120px',
    objectFit: 'cover' as const,
    display: 'block',
  },
  galleryImageMeta: {
    padding: '6px 8px',
    borderTop: '1px solid #F1F5F9',
  },
  brokenImage: {
    width: '100%',
    height: '120px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    background: '#F8FAFC',
    borderRadius: '10px',
    border: '1px solid #E2E8F0',
  },
};
