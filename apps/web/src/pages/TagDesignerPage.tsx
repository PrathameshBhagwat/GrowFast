import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState, Modal } from '@growfast/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { PhysicalTag, PhysicalTagData } from '../components/PhysicalTag';
import { TagCalibrationCard } from '../components/TagCalibrationCard';
import { TagPrintLayout } from '../components/TagPrintLayout';
import { TagDesignApi } from '../services/tag-design.api';
import { friendlyErrorMessage } from '../services/api';
import {
  REFERENCE_TAG_DESIGN,
  DEFAULT_TAG_DESIGN,
  SUPPORTED_TAG_FONTS,
  SUPPORTED_TAG_PRINTERS,
  SUPPORTED_TAG_DIMENSIONS,
  type TagDesignConfig,
  type TagFieldConfig,
  type TagFieldKey,
  type TagTextAlign,
  type TagDesignAuditEntry,
} from '@growfast/shared-types';
import {
  ArrowLeft,
  Save,
  RotateCcw,
  Printer,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  AlignLeft,
  AlignCenter,
  AlignRight,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Maximize2,
  Layers,
  Download,
  History,
  Clock,
  User,
  ShieldAlert,
  Info,
} from 'lucide-react';

const SAMPLE_PRESETS: { label: string; data: PhysicalTagData }[] = [
  {
    label: 'Standard Order (Silk Saree)',
    data: {
      orderNumber: 'ORD-001284',
      tagId: 'GF-8402A',
      unitNumber: 1,
      totalPieces: 5,
      customerName: 'Aishwarya Gangam',
      serviceType: 'DRY_CLEAN',
      garmentName: 'Silk Saree',
      storeName: 'GrowFast Laundry',
      storeLocation: 'Airoli, Navi Mumbai',
      customerAddress: 'Flat 402, Sunshine Heights, Airoli',
      itemTotal: '5 Pcs',
      remarks: 'Mild stain on border',
      colour: 'Navy Blue',
      orderDate: '2026-10-18T10:00:00.000Z',
      bookingDate: '2026-10-18T10:00:00.000Z',
      dueDate: '2026-10-21T18:00:00.000Z',
      barcodeValue: 'ORD001284-01',
      qrCodeValue: 'GF-8402A',
      isWorkshop: false,
    },
  },
  {
    label: 'Workshop Processing Tag (Prepone Test)',
    data: {
      orderNumber: 'ORD-001285',
      tagId: 'GF-8403W',
      unitNumber: 2,
      totalPieces: 5,
      customerName: 'Aishwarya Gangam',
      serviceType: 'DRY_CLEAN',
      garmentName: 'Heavy Designer Sherwani',
      storeName: 'GrowFast Central Workshop',
      storeLocation: 'Airoli Hub',
      customerAddress: 'Flat 402, Sunshine Heights, Airoli',
      itemTotal: '5 Pcs',
      remarks: 'Zari embroidery inspection required',
      colour: 'Golden Cream',
      orderDate: '2026-10-18T10:00:00.000Z',
      bookingDate: '2026-10-18T10:00:00.000Z',
      dueDate: '2026-10-21T18:00:00.000Z',
      barcodeValue: 'ORD001285-02',
      qrCodeValue: 'GF-8403W',
      isWorkshop: true, // Marked as workshop tag to verify prepone calculation
    },
  },
  {
    label: 'Long Text Stress Test',
    data: {
      orderNumber: 'ORD-009999',
      tagId: 'GF-LONGLBL-999',
      unitNumber: 48,
      totalPieces: 50,
      customerName: 'Dr. Rajeshwari Swaminathan-Venkatesh',
      serviceType: 'WASH_IRON',
      garmentName: 'Embroidered Heavy Designer Sherwani with Dupatta',
      storeName: 'GrowFast Laundry Flagship Hub',
      storeLocation: 'Navi Mumbai Central Sector 19',
      customerAddress: 'Villa 12, Palm Meadows Estate, Sector 19',
      itemTotal: '50 Pcs',
      remarks: 'Handle with delicate silicone solvent only',
      colour: 'Royal Purple & Gold',
      orderDate: '2026-10-18T10:00:00.000Z',
      bookingDate: '2026-10-18T10:00:00.000Z',
      dueDate: '2026-10-22T18:00:00.000Z',
      barcodeValue: 'ORD009999-48',
      qrCodeValue: 'GF-LONGLBL-999',
      isWorkshop: false,
    },
  },
];

export const TagDesignerPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();

  const [design, setDesign] = useState<TagDesignConfig>(REFERENCE_TAG_DESIGN);
  const [initialDesignJson, setInitialDesignJson] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingFont, setIsDownloadingFont] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [auditList, setAuditList] = useState<TagDesignAuditEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Check if owner role
  const isOwner = employee?.role === 'OWNER';

  // Load existing active design
  useEffect(() => {
    if (!isOwner) {
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    TagDesignApi.getDesign()
      .then((loaded) => {
        if (isMounted) {
          const active = loaded || REFERENCE_TAG_DESIGN;
          setDesign(active);
          setInitialDesignJson(JSON.stringify(active));
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMessage(friendlyErrorMessage(err));
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [isOwner]);

  // Determine if there are unsaved changes
  const isDirty = useMemo(() => {
    if (!initialDesignJson) return false;
    return JSON.stringify(design) !== initialDesignJson;
  }, [design, initialDesignJson]);

  // General tag setting handlers
  const handleWidthChange = (width: string) => {
    setDesign((prev) => ({ ...prev, width }));
  };

  const handleHeightChange = (height: string) => {
    setDesign((prev) => ({ ...prev, height }));
  };

  const handlePrinterChange = (printer: string) => {
    setDesign((prev) => ({ ...prev, printer }));
  };

  const handleWetStrengthToggle = (wetStrengthPaper: boolean) => {
    setDesign((prev) => ({ ...prev, wetStrengthPaper }));
  };

  const handleOverallAlignChange = (align: TagTextAlign) => {
    setDesign((prev) => ({ ...prev, align }));
  };

  const handleWorkshopPreponeToggle = (preponeWorkshopDueDate: boolean) => {
    setDesign((prev) => ({ ...prev, preponeWorkshopDueDate }));
  };

  const handleWorkshopDaysChange = (days: number) => {
    const clamped = Math.max(0, Math.min(14, isNaN(days) ? 1 : days));
    setDesign((prev) => ({ ...prev, workshopPreponeDays: clamped }));
  };

  // Field configuration handlers
  const handleFieldToggle = (index: number) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      // Booking No. (orderNumber) is protected primary anchor
      if (nextFields[index].field === 'orderNumber' || nextFields[index].field === 'bookingNo') {
        return prev;
      }
      nextFields[index] = {
        ...nextFields[index],
        enabled: !nextFields[index].enabled,
      };
      return { ...prev, fields: nextFields };
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      const temp = nextFields[index - 1];
      nextFields[index - 1] = nextFields[index];
      nextFields[index] = temp;
      return { ...prev, fields: nextFields };
    });
  };

  const handleMoveDown = (index: number) => {
    setDesign((prev) => {
      if (index >= prev.fields.length - 1) return prev;
      const nextFields = [...prev.fields];
      const temp = nextFields[index + 1];
      nextFields[index + 1] = nextFields[index];
      nextFields[index] = temp;
      return { ...prev, fields: nextFields };
    });
  };

  const handleFieldFontChange = (index: number, font: string) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      nextFields[index] = { ...nextFields[index], font };
      return { ...prev, fields: nextFields };
    });
  };

  const handleFieldAlignmentChange = (index: number, alignment: TagTextAlign) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      nextFields[index] = { ...nextFields[index], alignment };
      return { ...prev, fields: nextFields };
    });
  };

  const handleFieldFontSizeChange = (index: number, delta: number) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      const current = nextFields[index].fontSize;
      const isLargeField =
        nextFields[index].field === 'barcode' || nextFields[index].field === 'bookingNo';
      const maxBound = isLargeField ? 28 : 18;
      const clamped = Math.min(maxBound, Math.max(6, Math.round((current + delta) * 2) / 2));
      nextFields[index] = { ...nextFields[index], fontSize: clamped };
      return { ...prev, fields: nextFields };
    });
  };

  const handleFieldStyleToggle = (index: number, style: 'bold' | 'italic' | 'underline') => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      if (style === 'bold') {
        nextFields[index] = { ...nextFields[index], isBold: !nextFields[index].isBold };
      } else if (style === 'italic') {
        nextFields[index] = { ...nextFields[index], isItalic: !nextFields[index].isItalic };
      } else if (style === 'underline') {
        nextFields[index] = { ...nextFields[index], isUnderline: !nextFields[index].isUnderline };
      }
      return { ...prev, fields: nextFields };
    });
  };

  const handlePaddingChange = (side: 'top' | 'right' | 'bottom' | 'left', delta: number) => {
    setDesign((prev) => {
      const current = prev.containerPaddingMm?.[side] ?? 2.5;
      const clamped = Math.min(4.0, Math.max(1.5, Math.round((current + delta) * 10) / 10));
      return {
        ...prev,
        containerPaddingMm: {
          ...(prev.containerPaddingMm || REFERENCE_TAG_DESIGN.containerPaddingMm),
          [side]: clamped,
        },
      };
    });
  };

  const handleBorderStyleChange = (style: 'dashed' | 'solid' | 'none') => {
    setDesign((prev) => ({
      ...prev,
      borderStyle: style,
    }));
  };

  const handleSave = async () => {
    if (!isOwner) {
      setErrorMessage('Access denied: Only Store Owners can save tag design settings.');
      return;
    }

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await TagDesignApi.saveDesign(design);
      if (res.data) {
        setDesign(res.data);
        setInitialDesignJson(JSON.stringify(res.data));
      }
      setSuccessMessage(
        'Design Tags configuration saved successfully! Active for all orders in your store.',
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setErrorMessage(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!isOwner) {
      setErrorMessage('Access denied: Only Store Owners can reset tag design settings.');
      return;
    }

    const confirmed = window.confirm(
      'Reset tag layout back to canonical reference default design (1.5 × 1.5 in)?',
    );
    if (!confirmed) return;

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await TagDesignApi.resetDesign();
      if (res.data) {
        setDesign(res.data);
        setInitialDesignJson(JSON.stringify(res.data));
      } else {
        setDesign(REFERENCE_TAG_DESIGN);
        setInitialDesignJson(JSON.stringify(REFERENCE_TAG_DESIGN));
      }
      setSuccessMessage('Tag layout reset to canonical reference default.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setErrorMessage(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadFont = async () => {
    if (!isOwner) {
      setErrorMessage('Access denied: Only Store Owners can download thermal printer font assets.');
      return;
    }

    setIsDownloadingFont(true);
    setErrorMessage(null);
    try {
      await TagDesignApi.downloadFont();
      setSuccessMessage('Font C39HrP36DmT.ttf downloaded successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setErrorMessage(friendlyErrorMessage(err));
    } finally {
      setIsDownloadingFont(false);
    }
  };

  const handleOpenHistory = async () => {
    setShowHistoryModal(true);
    setIsLoadingHistory(true);
    try {
      const history = await TagDesignApi.getHistory();
      setAuditList(history.data || design.auditHistory || []);
    } catch {
      setAuditList(design.auditHistory || []);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={24} />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100 mb-2">
            Owner Access Required
          </h1>
          <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">
            Only authenticated Store Owners have permission to view, customize, or save Design Tags
            and font settings.
          </p>
          <Button variant="primary" onClick={() => navigate('/')} className="w-full">
            Return to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingState message="Loading Design Tags..." fullPage />;
  }

  const activeSample = SAMPLE_PRESETS[sampleIndex].data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 p-3 sm:p-6 lg:p-8">
      {/* ─── Top Header Navigation ──────────────────────────────────── */}
      <div className="no-print max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="tag-designer-back-btn"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="p-2.5 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Sliders size={20} className="text-blue-600 dark:text-blue-400" />
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100 tracking-tight">
                  Design Tags
                </h1>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {design.width || '1.5 in'} × {design.height || '1.5 in'}
                </span>
                {isDirty ? (
                  <span
                    id="unsaved-changes-badge"
                    className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved Changes
                  </span>
                ) : (
                  <span
                    id="saved-config-badge"
                    className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-900 dark:bg-green-950/80 dark:text-green-200 border border-green-300 dark:border-green-700 flex items-center gap-1"
                  >
                    <CheckCircle2 size={12} className="text-green-600 dark:text-green-400" />
                    Saved
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-slate-400 mt-1">
                <span>Configure layout & typography for physical cloth tags</span>
                {design.lastUpdatedAt && (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-gray-600 dark:text-slate-400">
                    <Clock size={12} />
                    Last saved: {new Date(design.lastUpdatedAt).toLocaleDateString()} at{' '}
                    {new Date(design.lastUpdatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                {design.lastUpdatedBy?.name && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-gray-600 dark:text-slate-400">
                    <User size={12} />
                    by {design.lastUpdatedBy.name} (Owner)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <Button
              id="tag-design-history-btn"
              variant="outline"
              size="sm"
              onClick={handleOpenHistory}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-semibold px-3"
              icon={<History size={16} />}
              aria-label="View design change history"
            >
              History
            </Button>
            <Button
              id="download-font-btn"
              variant="outline"
              size="sm"
              onClick={handleDownloadFont}
              disabled={isDownloadingFont}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-semibold px-3"
              icon={<Download size={16} />}
              aria-label="Download Font"
            >
              {isDownloadingFont ? 'Downloading...' : 'Download Font'}
            </Button>
            <Button
              id="reset-tag-design-btn"
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSaving}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-semibold px-3"
              icon={<RotateCcw size={16} />}
            >
              Reset Default
            </Button>
            <Button
              id="save-tag-design-btn"
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-bold px-4 shadow-sm"
              icon={<Save size={16} />}
            >
              {isSaving ? 'Saving...' : 'Save Design'}
            </Button>
          </div>
        </div>

        {/* ─── Feedback Alerts ────────────────────────────────────────── */}
        {successMessage && (
          <div
            id="designer-success-alert"
            className="mt-4 p-3 bg-green-50 dark:bg-green-950/60 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg text-xs font-medium flex items-center gap-2"
          >
            <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div
            id="designer-error-alert"
            className="mt-4 p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg text-xs font-medium flex items-center gap-2"
          >
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ─── Main Content Grid: Left Controls, Right Preview ──────────── */}
      <div className="no-print max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ─── Left Column: Controls (lg:col-span-7) ───────────────────── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: General Tag Settings (Reference Image Section A) */}
          <Card className="p-4 sm:p-5">
            <div className="pb-3 mb-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Maximize2 size={18} className="text-blue-600 dark:text-blue-400" />
                General Tag Settings
              </h2>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Physical Geometry
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Width Selector */}
              <div>
                <label
                  htmlFor="tag-width-select"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
                >
                  Width
                </label>
                <select
                  id="tag-width-select"
                  value={design.width || '1.5 in'}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {SUPPORTED_TAG_DIMENSIONS.map((dim) => (
                    <option key={dim} value={dim}>
                      {dim}
                    </option>
                  ))}
                </select>
              </div>

              {/* Height Selector */}
              <div>
                <label
                  htmlFor="tag-height-select"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
                >
                  Height
                </label>
                <select
                  id="tag-height-select"
                  value={design.height || '1.5 in'}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {SUPPORTED_TAG_DIMENSIONS.map((dim) => (
                    <option key={dim} value={dim}>
                      {dim}
                    </option>
                  ))}
                </select>
              </div>

              {/* Printer Selector */}
              <div>
                <label
                  htmlFor="tag-printer-select"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
                >
                  Printer
                </label>
                <select
                  id="tag-printer-select"
                  value={design.printer || 'TSC TE244'}
                  onChange={(e) => handlePrinterChange(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {SUPPORTED_TAG_PRINTERS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* Align Selector */}
              <div>
                <label
                  htmlFor="tag-overall-align-select"
                  className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5"
                >
                  Align
                </label>
                <select
                  id="tag-overall-align-select"
                  value={design.align || 'center'}
                  onChange={(e) => handleOverallAlignChange(e.target.value as TagTextAlign)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>

              {/* Wet Strength Paper Checkbox */}
              <div className="sm:col-span-2 flex items-center pt-2 sm:pt-6">
                <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px] px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 hover:bg-gray-100 dark:hover:bg-slate-850 w-full transition-colors">
                  <input
                    type="checkbox"
                    id="wet-strength-paper-checkbox"
                    checked={Boolean(design.wetStrengthPaper)}
                    onChange={(e) => handleWetStrengthToggle(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900 dark:text-slate-100">
                      Wet Strength Paper
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400">
                      Optimizes thermal heat settings for non-tear washable cloth tags
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </Card>

          {/* Card 2: Tag Field Configuration Table (Reference Image Section B & C) */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Tag Field Configuration
                </h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                11 Reference Fields
              </span>
            </div>

            {/* Field Table Container */}
            <div className="space-y-3" id="tag-fields-table">
              {design.fields.map((fieldCfg, index) => {
                const isFirst = index === 0;
                const isLast = index === design.fields.length - 1;
                const isFixedKey =
                  fieldCfg.field === 'bookingNo' || fieldCfg.field === 'orderNumber';
                const supportsFont =
                  fieldCfg.field !== 'qrcode' &&
                  fieldCfg.field !== 'itemTotal' &&
                  fieldCfg.field !== 'colour';
                const supportsStyle =
                  fieldCfg.field !== 'barcode' &&
                  fieldCfg.field !== 'qrcode' &&
                  fieldCfg.field !== 'colour';

                return (
                  <div
                    key={fieldCfg.field}
                    id={`field-row-${fieldCfg.field}`}
                    className={`p-3 rounded-lg border transition-all ${
                      fieldCfg.enabled
                        ? 'bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 shadow-sm'
                        : 'bg-gray-50 dark:bg-slate-950/50 border-gray-200 dark:border-slate-850 opacity-60'
                    }`}
                  >
                    {/* Header Row: Reorder, Name, Print Yes/No */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Move Up / Down Steppers */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            id={`move-up-btn-${fieldCfg.field}`}
                            onClick={() => handleMoveUp(index)}
                            disabled={isFirst}
                            aria-label={`Move ${fieldCfg.label || fieldCfg.field} up`}
                            className={`p-1.5 rounded border min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                              isFirst
                                ? 'opacity-30 cursor-not-allowed border-gray-200 dark:border-slate-800'
                                : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                            }`}
                          >
                            <ChevronUp size={18} />
                          </button>
                          <button
                            type="button"
                            id={`move-down-btn-${fieldCfg.field}`}
                            onClick={() => handleMoveDown(index)}
                            disabled={isLast}
                            aria-label={`Move ${fieldCfg.label || fieldCfg.field} down`}
                            className={`p-1.5 rounded border min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                              isLast
                                ? 'opacity-30 cursor-not-allowed border-gray-200 dark:border-slate-800'
                                : 'bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200'
                            }`}
                          >
                            <ChevronDown size={18} />
                          </button>
                        </div>

                        <div>
                          <span className="text-xs font-bold text-gray-900 dark:text-slate-100 block">
                            {fieldCfg.label || fieldCfg.field}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400">
                            Key: {fieldCfg.field}
                          </span>
                        </div>
                      </div>

                      {/* Print Yes / No Button Toggle */}
                      <button
                        type="button"
                        id={`toggle-field-btn-${fieldCfg.field}`}
                        onClick={() => handleFieldToggle(index)}
                        disabled={isFixedKey}
                        aria-label={`Toggle Print for ${fieldCfg.label || fieldCfg.field}`}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border min-h-[44px] transition-colors cursor-pointer ${
                          isFixedKey
                            ? 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 opacity-90 cursor-default'
                            : fieldCfg.enabled
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                              : 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {fieldCfg.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                        <span>Print: {fieldCfg.enabled ? 'Yes' : 'No'}</span>
                      </button>
                    </div>

                    {/* Controls Row: Font, Align, Size, Style (Visible when enabled) */}
                    {fieldCfg.enabled && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs items-center">
                        {/* Font Family Dropdown */}
                        {supportsFont ? (
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block mb-1">
                              Font:
                            </span>
                            <select
                              id={`font-select-${fieldCfg.field}`}
                              value={fieldCfg.font || 'Arial'}
                              onChange={(e) => handleFieldFontChange(index, e.target.value)}
                              className="w-full min-h-[44px] px-2 py-1 text-xs rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-medium"
                            >
                              {SUPPORTED_TAG_FONTS.map((font) => (
                                <option key={font} value={font}>
                                  {font}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block mb-1">
                              Renderer:
                            </span>
                            <span className="inline-block px-2 py-2 text-xs text-gray-500 dark:text-slate-400 font-mono">
                              Vector Engine
                            </span>
                          </div>
                        )}

                        {/* Alignment Selector */}
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block mb-1">
                            Align:
                          </span>
                          <div className="inline-flex rounded-md shadow-sm w-full">
                            <button
                              type="button"
                              id={`align-left-btn-${fieldCfg.field}`}
                              onClick={() => handleFieldAlignmentChange(index, 'left')}
                              aria-label="Align left"
                              className={`flex-1 p-2 rounded-l-md border min-h-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                                fieldCfg.alignment === 'left'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-50'
                              }`}
                            >
                              <AlignLeft size={16} />
                            </button>
                            <button
                              type="button"
                              id={`align-center-btn-${fieldCfg.field}`}
                              onClick={() => handleFieldAlignmentChange(index, 'center')}
                              aria-label="Align center"
                              className={`flex-1 p-2 border-t border-b border-r min-h-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                                fieldCfg.alignment === 'center'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-50'
                              }`}
                            >
                              <AlignCenter size={16} />
                            </button>
                            <button
                              type="button"
                              id={`align-right-btn-${fieldCfg.field}`}
                              onClick={() => handleFieldAlignmentChange(index, 'right')}
                              aria-label="Align right"
                              className={`flex-1 p-2 rounded-r-md border border-t border-b border-r min-h-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                                fieldCfg.alignment === 'right'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-50'
                              }`}
                            >
                              <AlignRight size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Font Size Stepper */}
                        <div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block mb-1">
                            Size:
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              id={`decrease-fontsize-btn-${fieldCfg.field}`}
                              onClick={() => handleFieldFontSizeChange(index, -1)}
                              disabled={fieldCfg.fontSize <= 6}
                              aria-label="Decrease font size"
                              className="px-2.5 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              -
                            </button>
                            <span
                              id={`fontsize-display-${fieldCfg.field}`}
                              className="font-mono font-bold text-xs min-w-[36px] text-center"
                            >
                              {fieldCfg.fontSize}px
                            </span>
                            <button
                              type="button"
                              id={`increase-fontsize-btn-${fieldCfg.field}`}
                              onClick={() => handleFieldFontSizeChange(index, 1)}
                              disabled={fieldCfg.fontSize >= 28}
                              aria-label="Increase font size"
                              className="px-2.5 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        {/* Style Checkboxes (Bold, Italic, Underline) */}
                        {supportsStyle ? (
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block mb-1">
                              Style:
                            </span>
                            <div className="flex items-center gap-1.5">
                              {/* Bold */}
                              <button
                                type="button"
                                id={`bold-toggle-btn-${fieldCfg.field}`}
                                onClick={() => handleFieldStyleToggle(index, 'bold')}
                                aria-label="Toggle bold"
                                className={`flex-1 py-1 rounded border min-h-[44px] font-bold text-xs cursor-pointer transition-colors ${
                                  fieldCfg.isBold !== false
                                    ? 'bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700'
                                }`}
                              >
                                B
                              </button>
                              {/* Italic */}
                              <button
                                type="button"
                                id={`italic-toggle-btn-${fieldCfg.field}`}
                                onClick={() => handleFieldStyleToggle(index, 'italic')}
                                aria-label="Toggle italic"
                                className={`flex-1 py-1 rounded border min-h-[44px] italic font-serif text-xs cursor-pointer transition-colors ${
                                  fieldCfg.isItalic
                                    ? 'bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700'
                                }`}
                              >
                                I
                              </button>
                              {/* Underline */}
                              <button
                                type="button"
                                id={`underline-toggle-btn-${fieldCfg.field}`}
                                onClick={() => handleFieldStyleToggle(index, 'underline')}
                                aria-label="Toggle underline"
                                className={`flex-1 py-1 rounded border min-h-[44px] underline text-xs cursor-pointer transition-colors ${
                                  fieldCfg.isUnderline
                                    ? 'bg-blue-100 text-blue-900 border-blue-400 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700'
                                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700'
                                }`}
                              >
                                U
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 block mb-1">
                              Style:
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-slate-500">
                              Auto-Formatted
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Section D: Additional Reference Option (Bottom Checkbox & Input) */}
            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-950/20 p-3.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    id="workshop-prepone-checkbox"
                    checked={Boolean(design.preponeWorkshopDueDate)}
                    onChange={(e) => handleWorkshopPreponeToggle(e.target.checked)}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-900 dark:text-slate-100">
                      Select to bring forward/Prepone Due Date for Workshop tags only.
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-slate-400">
                      Shifts the printed due date forward for factory/workshop processing without
                      altering stored customer order dates.
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-2 pl-6 sm:pl-0">
                  <span className="text-xs text-gray-600 dark:text-slate-400 font-medium whitespace-nowrap">
                    Prepone by:
                  </span>
                  <input
                    type="number"
                    id="workshop-prepone-days-input"
                    min={0}
                    max={14}
                    value={design.workshopPreponeDays ?? 1}
                    onChange={(e) => handleWorkshopDaysChange(parseInt(e.target.value, 10))}
                    disabled={!design.preponeWorkshopDueDate}
                    className="w-16 min-h-[44px] px-2.5 py-1 text-xs font-bold text-center rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 disabled:opacity-40"
                  />
                  <span className="text-xs text-gray-500 dark:text-slate-400">day(s)</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Card 3: Boundary Inset Padding & Perimeter Guide */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-slate-800">
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                <Maximize2 size={18} className="text-blue-600 dark:text-blue-400" />
                Tag Padding & Boundary Guideline
              </h2>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                Physical Edge Margins
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                const padVal = design.containerPaddingMm?.[side] ?? 2.5;
                return (
                  <div
                    key={side}
                    className="p-2.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center"
                  >
                    <span className="text-[10px] font-bold text-gray-500 dark:text-slate-400 uppercase">
                      {side}
                    </span>
                    <span
                      id={`padding-display-${side}`}
                      className="text-sm font-black text-gray-900 dark:text-slate-100 my-1 font-mono"
                    >
                      {padVal} mm
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        id={`decrease-padding-btn-${side}`}
                        onClick={() => handlePaddingChange(side, -0.5)}
                        disabled={padVal <= 1.5}
                        aria-label={`Decrease ${side} padding`}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        id={`increase-padding-btn-${side}`}
                        onClick={() => handlePaddingChange(side, 0.5)}
                        disabled={padVal >= 4.0}
                        aria-label={`Increase ${side} padding`}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <span className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-2">
                Perimeter Guide Line:
              </span>
              <div className="inline-flex rounded-md shadow-sm">
                {(['dashed', 'solid', 'none'] as const).map((style, idx) => (
                  <button
                    key={style}
                    type="button"
                    id={`border-style-btn-${style}`}
                    onClick={() => handleBorderStyleChange(style)}
                    className={`px-4 py-2 text-xs font-semibold border min-h-[44px] flex items-center gap-1.5 transition-colors cursor-pointer ${
                      idx === 0
                        ? 'rounded-l-md'
                        : idx === 2
                          ? 'rounded-r-md border-l-0'
                          : 'border-l-0'
                    } ${
                      design.borderStyle === style
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="capitalize">{style}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        {/* ─── Right Column: Live Tag Preview (lg:col-span-5) ───────────── */}
        <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Printer size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Live Tag Preview
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                Live Rendering
              </span>
            </div>

            {/* Preset Selector */}
            <div className="mb-4">
              <label
                htmlFor="preview-sample-select"
                className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1"
              >
                Sample Data Scenario:
              </label>
              <select
                id="preview-sample-select"
                value={sampleIndex}
                onChange={(e) => setSampleIndex(Number(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-medium"
              >
                {SAMPLE_PRESETS.map((preset, idx) => (
                  <option key={preset.label} value={idx}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Physical Tag Visual Sandbox */}
            <div className="bg-slate-100 dark:bg-slate-900/80 rounded-xl p-6 flex flex-col items-center justify-center border border-dashed border-slate-300 dark:border-slate-800 min-h-[260px] relative overflow-hidden">
              {/* Sample Data Watermark Notice */}
              <div className="absolute top-2 left-2 right-2 flex items-center justify-center gap-1.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50/90 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded px-2 py-0.5 uppercase tracking-wider">
                <Info size={11} />
                <span>Preview Sample Data • Not real customer data</span>
              </div>

              {/* The Rendered Tag */}
              <div className="mt-5 p-2 bg-white shadow-xl rounded-sm">
                <PhysicalTag data={activeSample} design={design} />
              </div>

              {/* Tag Spec Badge */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-gray-500 dark:text-slate-400">
                <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  Size: {design.width || '1.5 in'} × {design.height || '1.5 in'}
                </span>
                <span className="font-mono bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-gray-200 dark:border-slate-700">
                  Printer: {design.printer || 'TSC TE244'}
                </span>
                {design.preponeWorkshopDueDate && activeSample.isWorkshop && (
                  <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                    Workshop Preponed: -{design.workshopPreponeDays || 1} day(s)
                  </span>
                )}
              </div>
            </div>

            {/* Test Print Action */}
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-slate-800">
              <Button
                variant="outline"
                className="w-full min-h-[44px] text-xs font-semibold"
                icon={<Printer size={16} />}
                onClick={() => window.print()}
              >
                Test Print Sample Tag
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Change History Audit Modal (Section 5) ───────────────────── */}
      {showHistoryModal && (
        <Modal
          open={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title="Tag Design Change History (Audit Log)"
          width="640px"
        >
          <div className="p-1 space-y-4">
            <p className="text-xs text-gray-600 dark:text-slate-400">
              Immutable audit record of all tag design modifications for this store. Accessible
              exclusively by Store Owners.
            </p>

            {isLoadingHistory ? (
              <div className="py-8 text-center text-xs text-gray-500">Loading audit history...</div>
            ) : auditList.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                No past design modifications recorded. You are currently on baseline version 1.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {auditList.map((entry, idx) => (
                  <div
                    key={`${entry.version}-${idx}`}
                    className="p-3.5 rounded-lg border border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono text-[10px]">
                          v{entry.version}
                        </span>
                        <span>{entry.updatedByName}</span>
                      </span>
                      <span className="text-[11px] text-gray-500 font-mono">
                        {new Date(entry.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    {entry.updatedByEmail && (
                      <div className="text-[11px] text-gray-500 font-mono">
                        Email: {entry.updatedByEmail}
                      </div>
                    )}
                    <div className="text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-950 p-2 rounded border border-gray-200 dark:border-slate-850">
                      {entry.changesSummary || 'Updated tag layout configuration.'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistoryModal(false)}
                className="min-h-[44px]"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── Hidden Container for Test Printing ────────────────────────── */}
      <TagPrintLayout tags={[activeSample]} design={design} />
    </div>
  );
};

export default TagDesignerPage;
