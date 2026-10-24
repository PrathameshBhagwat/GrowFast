import React, { useState } from 'react';
import { Modal, Button } from '@growfast/ui';
import { PhysicalTag, PhysicalTagData } from './PhysicalTag';
import { TagCalibrationCard } from './TagCalibrationCard';
import { TagPrintLayout } from './TagPrintLayout';
import { Printer, X, ChevronLeft, ChevronRight, Grid, Eye, Compass } from 'lucide-react';
import type { TagDesignConfig } from '@growfast/shared-types';

export interface TagPreviewModalProps {
  open: boolean;
  onClose: () => void;
  tags: PhysicalTagData[];
  initialIndex?: number;
  initialMode?: 'single' | 'all' | 'calibration';
  design?: TagDesignConfig;
}

export const TagPreviewModal: React.FC<TagPreviewModalProps> = ({
  open,
  onClose,
  tags,
  initialIndex = 0,
  initialMode = 'single',
  design,
}) => {
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialIndex), Math.max(0, tags.length - 1)),
  );
  const [viewMode, setViewMode] = useState<'single' | 'all' | 'calibration'>(initialMode);

  // Synchronize mode and index when modal opens or initialMode changes
  React.useEffect(() => {
    if (open) {
      setViewMode(initialMode);
      setCurrentIndex(Math.min(Math.max(0, initialIndex), Math.max(0, tags.length - 1)));
    }
  }, [open, initialMode, initialIndex, tags.length]);

  // Keep currentIndex valid if tags length changes
  const safeIndex = Math.min(currentIndex, Math.max(0, tags.length - 1));
  const currentTag = tags[safeIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : tags.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < tags.length - 1 ? prev + 1 : 0));
  };

  const handlePrint = () => {
    window.print();
  };

  if (!open) {
    return null;
  }

  const isCalibration = viewMode === 'calibration';

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          isCalibration ? '40 × 40 mm Tag Calibration Test' : 'Physical Tag Preview (40 × 40 mm)'
        }
        width={viewMode === 'all' && tags.length > 1 ? '720px' : '540px'}
      >
        <div className="space-y-4">
          {/* ─── Top Control Toolbar (Hidden in Print) ───────────────────── */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[var(--bg-surface-inset)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-neu-inset)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-secondary)]">
                {isCalibration
                  ? 'Calibration Mode'
                  : `${tags.length} ${tags.length === 1 ? 'tag' : 'tags'} ready`}
              </span>

              {/* View Mode Switcher */}
              <div className="inline-flex p-0.5 rounded-xl bg-[var(--bg-surface)] shadow-[var(--shadow-neu-card-sm)] border border-[var(--border)] ml-2">
                <button
                  type="button"
                  id="tag-view-single-btn"
                  onClick={() => setViewMode('single')}
                  aria-label="View single tag"
                  className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[44px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                    viewMode === 'single'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Eye size={14} /> Single
                </button>
                {tags.length > 1 && (
                  <button
                    type="button"
                    id="tag-view-all-btn"
                    onClick={() => setViewMode('all')}
                    aria-label="View all tags"
                    className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[44px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                      viewMode === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Grid size={14} /> All ({tags.length})
                  </button>
                )}
                <button
                  type="button"
                  id="tag-view-calib-btn"
                  onClick={() => setViewMode('calibration')}
                  aria-label="Calibration test tag"
                  className={`px-3 py-2 text-xs font-semibold rounded-lg min-h-[44px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                    isCalibration
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Compass size={14} /> Calibration
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                id="close-tag-preview-btn"
                onClick={onClose}
                style={{ minHeight: '44px' }}
                className="min-h-[44px] text-xs font-semibold rounded-full shadow-[var(--shadow-neu-card-sm)] border border-[var(--border)]"
                icon={<X size={16} />}
              >
                Close
              </Button>
              <Button
                variant="primary"
                id="trigger-tag-print-btn"
                onClick={handlePrint}
                style={{ minHeight: '44px' }}
                className="min-h-[44px] font-bold text-xs px-5 rounded-full shadow-[var(--shadow-neu-card-sm)] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-2"
                icon={<Printer size={16} />}
              >
                {isCalibration
                  ? 'Print Calibration Tag'
                  : `Print ${tags.length === 1 ? 'Tag' : `All Selected (${tags.length})`}`}
              </Button>
            </div>
          </div>

          {/* ─── Real 40×40 mm Tag Specification Badge ──────────────────── */}
          <div className="no-print flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Physical target: <strong className="text-[var(--text-primary)]">
                40 mm × 40 mm
              </strong>{' '}
              (1:1 square washable cloth)
            </span>
            <span>Target Scale: 100% (No auto-shrink)</span>
          </div>

          {/* ─── Calibration Mode View ──────────────────────────────────── */}
          {isCalibration ? (
            <div className="no-print flex flex-col items-center justify-center p-6 bg-[var(--bg-surface-inset)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-neu-inset)]">
              <div className="text-xs text-[var(--text-secondary)] mb-4 text-center max-w-sm">
                Print this calibration pattern and measure with a physical ruler to verify exact
                40×40 mm dimensions and printer alignment.
              </div>
              <div
                className="relative bg-white shadow-xl rounded-sm p-1 border border-gray-300"
                style={{
                  width: '42mm',
                  height: '42mm',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TagCalibrationCard />
              </div>
            </div>
          ) : viewMode === 'single' && currentTag ? (
            /* ─── Single Tag Preview Surface ───────────────────────────── */
            <div className="no-print flex flex-col items-center justify-center p-6 bg-[var(--bg-surface-inset)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow-neu-inset)]">
              <div
                className="relative bg-white shadow-xl rounded-sm p-1 border border-gray-300"
                style={{
                  width: '42mm',
                  height: '42mm',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PhysicalTag data={currentTag} design={design} />
              </div>

              {/* Tag Navigation Controls */}
              {tags.length > 1 && (
                <div className="flex items-center justify-center gap-4 mt-5">
                  <button
                    type="button"
                    id="prev-tag-preview-btn"
                    onClick={handlePrev}
                    aria-label="Previous tag"
                    className="p-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] hover:border-blue-400 text-[var(--text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-[var(--shadow-neu-card-sm)] transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <span className="text-sm font-bold text-[var(--text-primary)] min-w-[120px] text-center font-mono">
                    Piece {currentTag.unitNumber}/{currentTag.totalPieces} ({safeIndex + 1} of{' '}
                    {tags.length})
                  </span>

                  <button
                    type="button"
                    id="next-tag-preview-btn"
                    onClick={handleNext}
                    aria-label="Next tag"
                    className="p-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)] hover:border-blue-400 text-[var(--text-primary)] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shadow-[var(--shadow-neu-card-sm)] transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ─── All Selected Tags Grid View ──────────────────────────── */
            <div className="no-print max-h-[60vh] overflow-y-auto p-4 bg-gray-100 dark:bg-slate-950/70 rounded-xl border border-gray-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center justify-center gap-4">
                {tags.map((tag, idx) => (
                  <div
                    key={`${tag.tagId}-${idx}`}
                    className="flex flex-col items-center bg-white p-2 rounded shadow-sm border border-gray-300"
                  >
                    <PhysicalTag data={tag} design={design} />
                    <span className="text-[11px] font-semibold text-gray-600 mt-1">
                      Piece {tag.unitNumber}/{tag.totalPieces}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Print-Only DOM for Browser Print (Hidden on screen via CSS) ─ */}
      <TagPrintLayout
        tags={tags}
        isCalibration={isCalibration}
        id="printable-tags"
        design={design}
      />
    </>
  );
};
