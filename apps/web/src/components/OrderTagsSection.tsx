import React, { useState, useMemo, useEffect } from 'react';
import { Card, Button } from '@growfast/ui';
import { OrderDetailDTO, OrderPhotoDTO, type TagDesignConfig } from '@growfast/shared-types';
import { PhysicalTagData } from './PhysicalTag';
import { TagPreviewModal } from './TagPreviewModal';
import { TagPrintLayout } from './TagPrintLayout';
import { TagDesignApi } from '../services/tag-design.api';
import {
  Printer,
  Eye,
  Tag as TagIcon,
  CheckSquare,
  Square,
  Camera,
  Check,
  Compass,
  Palette,
} from 'lucide-react';

export interface OrderTagsSectionProps {
  order: OrderDetailDTO;
  onViewPhotos: (photos: OrderPhotoDTO[], index: number, label: string) => void;
  className?: string;
  design?: TagDesignConfig;
  onOpenDesigner?: () => void;
}

interface GarmentTagEntry {
  garmentId: string;
  orderItemId: string;
  tagId: string;
  unitNumber: number;
  totalPieces: number;
  garmentName: string;
  serviceType: string;
  isReady: boolean;
  isCancelled: boolean;
  isDelivered: boolean;
  photos: OrderPhotoDTO[];
  tagData: PhysicalTagData;
}

export const OrderTagsSection: React.FC<OrderTagsSectionProps> = ({
  order,
  onViewPhotos,
  className = '',
  design,
  onOpenDesigner,
}) => {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTags, setPreviewTags] = useState<PhysicalTagData[]>([]);
  const [initialPreviewIndex, setInitialPreviewIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<'single' | 'all' | 'calibration'>('single');
  const [activeDesign, setActiveDesign] = useState<TagDesignConfig | undefined>(design);

  useEffect(() => {
    if (design) {
      setActiveDesign(design);
      return;
    }
    let isMounted = true;
    TagDesignApi.getDesign()
      .then((cfg) => {
        if (isMounted && cfg) {
          setActiveDesign(cfg);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [design]);

  // Extract all authoritative physical garments across all order items
  const tagEntries: GarmentTagEntry[] = useMemo(() => {
    const list: GarmentTagEntry[] = [];
    if (!order.items) return list;

    for (const item of order.items) {
      if (!item.physicalGarments || item.physicalGarments.length === 0) {
        continue;
      }

      for (const pg of item.physicalGarments) {
        const pieceTagId = pg.tagId || `GF-${pg.id.slice(-6).toUpperCase()}`;
        const tagData: PhysicalTagData = {
          orderNumber: order.orderNumber,
          tagId: pieceTagId,
          unitNumber: pg.unitNumber,
          totalPieces: item.quantity,
          customerName: order.customerName,
          serviceType: item.serviceType,
          garmentName: item.garmentName,
          storeName: order.storeName,
          storeLocation: order.storeAddress ? order.storeAddress.split(',')[0].trim() : undefined,
          orderDate: order.orderDate,
          isCancelled: Boolean(pg.isCancelled),
        };

        list.push({
          garmentId: pg.id,
          orderItemId: item.id,
          tagId: pieceTagId,
          unitNumber: pg.unitNumber,
          totalPieces: item.quantity,
          garmentName: item.garmentName,
          serviceType: item.serviceType,
          isReady: Boolean(pg.isReady),
          isCancelled: Boolean(pg.isCancelled),
          isDelivered: Boolean(pg.isDelivered),
          photos: pg.photos || [],
          tagData,
        });
      }
    }

    // Sort deterministically: unitNumber ascending
    return list.sort((a, b) => a.unitNumber - b.unitNumber);
  }, [order]);

  // Non-cancelled garments eligible for bulk printing
  const activeEntries = useMemo(() => tagEntries.filter((e) => !e.isCancelled), [tagEntries]);

  const allActiveSelected =
    activeEntries.length > 0 && activeEntries.every((e) => selectedTagIds.has(e.garmentId));

  const handleToggleSelect = (garmentId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(garmentId)) {
        next.delete(garmentId);
      } else {
        next.add(garmentId);
      }
      return next;
    });
  };

  const handleSelectAllToggle = () => {
    if (allActiveSelected) {
      setSelectedTagIds(new Set());
    } else {
      setSelectedTagIds(new Set(activeEntries.map((e) => e.garmentId)));
    }
  };

  const handleOpenCalibration = () => {
    setPreviewTags([]);
    setInitialPreviewIndex(0);
    setPreviewMode('calibration');
    setPreviewModalOpen(true);
  };

  const handlePreviewSingle = (entry: GarmentTagEntry) => {
    setPreviewTags([entry.tagData]);
    setInitialPreviewIndex(0);
    setPreviewMode('single');
    setPreviewModalOpen(true);
  };

  const handlePrintSingle = (entry: GarmentTagEntry) => {
    setPreviewTags([entry.tagData]);
    setInitialPreviewIndex(0);
    setPreviewMode('single');
    setPreviewModalOpen(true);
  };

  const handlePreviewSelected = () => {
    const selected = tagEntries
      .filter((e) => selectedTagIds.has(e.garmentId))
      .map((e) => e.tagData);
    if (selected.length === 0) return;
    setPreviewTags(selected);
    setInitialPreviewIndex(0);
    setPreviewMode(selected.length > 1 ? 'all' : 'single');
    setPreviewModalOpen(true);
  };

  const handlePrintAll = () => {
    const activeTags = activeEntries.map((e) => e.tagData);
    if (activeTags.length === 0) return;
    setPreviewTags(activeTags);
    setInitialPreviewIndex(0);
    setPreviewMode('all');
    setPreviewModalOpen(true);
  };

  const selectedCount = selectedTagIds.size;

  // Check if order has only weight-based items without physical garments
  const hasWeightBasedOnly =
    tagEntries.length === 0 && order.items && order.items.some((item) => (item.weight ?? 0) > 0);

  return (
    <Card className={`no-print-card ${className}`}>
      {/* ─── Header & Summary ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <TagIcon className="text-blue-600 dark:text-blue-400" size={20} />
            <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Garment Tags</h2>
            <span
              id="total-tags-badge"
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {tagEntries.length} {tagEntries.length === 1 ? 'Piece' : 'Pieces'}
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            40 × 40 mm washable cloth tags attached to physical garments
          </p>
        </div>

        {/* ─── Batch Actions Toolbar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Always accessible Calibration / Test Tag button */}
          <Button
            id="calibrate-tag-btn"
            variant="ghost"
            size="sm"
            onClick={handleOpenCalibration}
            style={{ minHeight: '44px' }}
            className="text-xs font-semibold px-2.5 min-h-[44px] flex items-center gap-1.5 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-850"
            icon={<Compass size={15} />}
            title="Test 40×40 mm printer calibration"
          >
            Test Tag
          </Button>

          {/* Optional Tag Designer navigation button (Admin/Owner) */}
          {onOpenDesigner && (
            <Button
              id="open-tag-designer-btn"
              variant="ghost"
              size="sm"
              onClick={onOpenDesigner}
              style={{ minHeight: '44px' }}
              className="text-xs font-semibold px-2.5 min-h-[44px] flex items-center gap-1.5 text-purple-700 dark:text-purple-300 hover:text-purple-800 dark:hover:text-purple-200 border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40"
              icon={<Palette size={15} />}
              title="Customize 40×40 mm tag layout (Admin)"
            >
              Tag Designer
            </Button>
          )}

          {tagEntries.length > 0 && activeEntries.length > 0 && (
            <button
              type="button"
              id="select-all-tags-btn"
              onClick={handleSelectAllToggle}
              className="text-xs font-semibold text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 px-2.5 py-2 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] transition-colors cursor-pointer"
            >
              {allActiveSelected ? (
                <>
                  <CheckSquare size={16} className="text-blue-600" /> Deselect All
                </>
              ) : (
                <>
                  <Square size={16} /> Select All ({activeEntries.length})
                </>
              )}
            </button>
          )}

          {tagEntries.length > 0 && selectedCount > 0 && (
            <Button
              id="print-selected-tags-btn"
              variant="primary"
              size="sm"
              onClick={handlePreviewSelected}
              style={{ minHeight: '44px' }}
              className="text-xs font-bold px-3 min-h-[44px] flex items-center gap-1.5 shadow-sm"
              icon={<Printer size={16} />}
            >
              Print Selected ({selectedCount})
            </Button>
          )}

          {tagEntries.length > 0 && (
            <Button
              id="print-all-tags-btn"
              variant="outline"
              size="sm"
              disabled={activeEntries.length === 0}
              onClick={handlePrintAll}
              style={{ minHeight: '44px' }}
              className="text-xs font-semibold px-3 min-h-[44px] flex items-center gap-1.5"
              icon={<Printer size={16} />}
            >
              Print All Tags ({activeEntries.length})
            </Button>
          )}
        </div>
      </div>

      {/* ─── Empty States ────────────────────────────────────────────── */}
      {tagEntries.length === 0 && (
        <div
          id="no-tags-empty-state"
          className="text-center py-8 px-4 bg-gray-50 dark:bg-slate-900/40 rounded-lg border border-dashed border-gray-300 dark:border-slate-800"
        >
          <TagIcon className="mx-auto text-gray-400 dark:text-slate-500 mb-2" size={32} />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
            {hasWeightBasedOnly ? 'Weight-Based Laundry Batch' : 'No Garment Tags Available'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {hasWeightBasedOnly
              ? 'This order contains weight-based laundry. Weight-based batches do not produce individual physical garment tags.'
              : 'This order does not currently have individual physical garments assigned.'}
          </p>
        </div>
      )}

      {/* ─── Tag Grid / Row ──────────────────────────────────────────── */}
      {tagEntries.length > 0 && (
        <div
          id="tag-grid"
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {tagEntries.map((entry) => {
            const isSelected = selectedTagIds.has(entry.garmentId);

            return (
              <div
                key={entry.garmentId}
                id={`tag-card-${entry.garmentId}`}
                data-testid={`tag-card-${entry.unitNumber}`}
                className={`relative flex flex-col justify-between p-3 rounded-lg border transition-all ${
                  entry.isCancelled
                    ? 'bg-gray-50/70 border-gray-200 border-dashed dark:bg-slate-900/40 dark:border-slate-800 opacity-75'
                    : isSelected
                      ? 'bg-blue-50/60 border-blue-400 dark:bg-blue-950/40 dark:border-blue-600 shadow-sm ring-1 ring-blue-400'
                      : 'bg-white border-gray-200 dark:bg-slate-850 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700 shadow-sm'
                }`}
              >
                {/* ─── Card Header: Checkbox & Piece Position ───────── */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id={`select-tag-checkbox-${entry.garmentId}`}
                      aria-label={`Select tag for Piece ${entry.unitNumber}/${entry.totalPieces}`}
                      disabled={entry.isCancelled}
                      onClick={() => handleToggleSelect(entry.garmentId)}
                      className={`p-1 rounded min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                        entry.isCancelled
                          ? 'opacity-40 cursor-not-allowed'
                          : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={18} className="text-gray-400 dark:text-slate-500" />
                      )}
                    </button>

                    <div>
                      <span className="text-xs font-bold text-gray-900 dark:text-slate-100 block">
                        Piece {entry.unitNumber}/{entry.totalPieces}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-slate-400">
                        {entry.garmentName}
                      </span>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div>
                    {entry.isCancelled ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                        CANCELLED
                      </span>
                    ) : entry.isDelivered ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800 flex items-center gap-1">
                        <Check size={10} strokeWidth={3} /> DELIVERED
                      </span>
                    ) : entry.isReady ? (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 border border-green-200 dark:border-green-800">
                        READY
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                        PROCESSING
                      </span>
                    )}
                  </div>
                </div>

                {/* ─── Tag Identity Badge ────────────────────────────── */}
                <div className="bg-gray-50 dark:bg-slate-900 p-2 rounded border border-gray-100 dark:border-slate-800 my-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-gray-400 dark:text-slate-500">
                      Order / Piece
                    </span>
                    <span
                      id={`tag-order-piece-${entry.garmentId}`}
                      className="font-mono text-xs font-black text-blue-700 dark:text-blue-300 tracking-wider"
                    >
                      #{order.orderNumber} ({entry.unitNumber}/{entry.totalPieces})
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-slate-500">
                    <span className="uppercase font-semibold">Internal Tag</span>
                    <span id={`tag-id-display-${entry.garmentId}`} className="font-mono">
                      {entry.tagId}
                    </span>
                  </div>
                </div>

                {/* ─── Footer: Photos & Quick Print Actions ──────────── */}
                <div className="flex items-center justify-between gap-1 mt-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                  {/* Photo Viewer seam */}
                  {entry.photos.length > 0 ? (
                    <button
                      type="button"
                      id={`view-photos-btn-${entry.garmentId}`}
                      onClick={() =>
                        onViewPhotos(
                          entry.photos,
                          0,
                          `${entry.garmentName} (Piece ${entry.unitNumber}/${entry.totalPieces} • Tag ${entry.tagId})`,
                        )
                      }
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 min-h-[44px] px-1 cursor-pointer"
                      title="View garment photos"
                    >
                      <Camera size={14} />
                      <span>{entry.photos.length} photos</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-gray-400 dark:text-slate-500">No photos</span>
                  )}

                  {/* Actions: Preview & Print */}
                  <div className="flex items-center gap-1">
                    <Button
                      id={`preview-tag-btn-${entry.garmentId}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewSingle(entry)}
                      style={{ minHeight: '44px' }}
                      className="text-xs min-h-[44px] px-2"
                      title="Preview 40×40 mm tag"
                      icon={<Eye size={14} />}
                    >
                      Preview
                    </Button>
                    <Button
                      id={`print-tag-btn-${entry.garmentId}`}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintSingle(entry)}
                      style={{ minHeight: '44px' }}
                      className="text-xs min-h-[44px] px-2 font-semibold"
                      title="Print tag"
                      icon={<Printer size={14} />}
                    >
                      Print
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── 40×40 mm Preview & Print Modal ──────────────────────────── */}
      <TagPreviewModal
        open={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        tags={previewTags}
        initialIndex={initialPreviewIndex}
        initialMode={previewMode}
        design={activeDesign}
      />
    </Card>
  );
};
