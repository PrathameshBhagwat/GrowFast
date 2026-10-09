import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingState } from '@growfast/ui';
import { ThemeToggle } from '../components/ThemeToggle';
import { PhysicalTag, PhysicalTagData } from '../components/PhysicalTag';
import { TagCalibrationCard } from '../components/TagCalibrationCard';
import { TagPrintLayout } from '../components/TagPrintLayout';
import { TagDesignApi } from '../services/tag-design.api';
import { friendlyErrorMessage } from '../services/api';
import {
  DEFAULT_TAG_DESIGN,
  type TagDesignConfig,
  type TagFieldConfig,
  type TagFieldKey,
  type TagTextAlign,
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
  Compass,
  Sliders,
  Type,
  Maximize2,
  Layers,
} from 'lucide-react';

const SAMPLE_PRESETS: { label: string; data: PhysicalTagData }[] = [
  {
    label: 'Standard (Silk Saree)',
    data: {
      orderNumber: 'ORD-001284',
      tagId: 'GF-8402A',
      unitNumber: 1,
      totalPieces: 5,
      customerName: 'Aishwarya Gangam',
      serviceType: 'DRY_CLEAN',
      garmentName: 'Silk Saree',
      storeName: 'A Laundry',
      storeLocation: 'Airoli',
      orderDate: '2026-09-02T10:00:00.000Z',
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
      orderDate: '2026-10-08T18:30:00.000Z',
    },
  },
  {
    label: '50-Piece Batch Tail',
    data: {
      orderNumber: 'ORD-000050',
      tagId: 'GF-5050Z',
      unitNumber: 50,
      totalPieces: 50,
      customerName: 'John Doe',
      serviceType: 'STEAM_PRESS',
      garmentName: 'Denim Jeans',
      storeName: 'A Laundry',
      storeLocation: 'Airoli',
      orderDate: '2026-10-08T12:00:00.000Z',
    },
  },
];

export const TagDesignerPage: React.FC = () => {
  const navigate = useNavigate();
  const { employee } = useAuth();

  const [design, setDesign] = useState<TagDesignConfig>(DEFAULT_TAG_DESIGN);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);
  const [showCalibrationPreview, setShowCalibrationPreview] = useState(false);

  // Load existing active design
  useEffect(() => {
    let isMounted = true;
    TagDesignApi.getDesign()
      .then((loaded) => {
        if (isMounted) {
          setDesign(loaded || DEFAULT_TAG_DESIGN);
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
  }, []);

  const handleFieldToggle = (index: number) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      if (nextFields[index].field === 'orderNumber') return prev;
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

  const handleAlignmentChange = (index: number, alignment: TagTextAlign) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      nextFields[index] = { ...nextFields[index], alignment };
      return { ...prev, fields: nextFields };
    });
  };

  const handleFontSizeChange = (index: number, delta: number) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      const current = nextFields[index].fontSize;
      // Clamped within safe bounds: 6.0px to 18.0px
      const clamped = Math.min(18, Math.max(6, Math.round((current + delta) * 2) / 2));
      nextFields[index] = { ...nextFields[index], fontSize: clamped };
      return { ...prev, fields: nextFields };
    });
  };

  const handleBoldToggle = (index: number) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      nextFields[index] = {
        ...nextFields[index],
        isBold: !nextFields[index].isBold,
      };
      return { ...prev, fields: nextFields };
    });
  };

  const handleUppercaseToggle = (index: number) => {
    setDesign((prev) => {
      const nextFields = [...prev.fields];
      nextFields[index] = {
        ...nextFields[index],
        isUppercase: !nextFields[index].isUppercase,
      };
      return { ...prev, fields: nextFields };
    });
  };

  const handlePaddingChange = (side: 'top' | 'right' | 'bottom' | 'left', delta: number) => {
    setDesign((prev) => {
      const current = prev.containerPaddingMm[side];
      // Clamped within safe bounds: 1.5mm to 4.0mm
      const clamped = Math.min(4.0, Math.max(1.5, Math.round((current + delta) * 10) / 10));
      return {
        ...prev,
        containerPaddingMm: {
          ...prev.containerPaddingMm,
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
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await TagDesignApi.saveDesign(design);
      if (res.data) {
        setDesign(res.data);
      }
      setSuccessMessage(
        'Tag design configuration saved successfully! Active for all orders in your store.',
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setErrorMessage(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Reset tag layout back to canonical default 40×40 mm reference design?',
    );
    if (!confirmed) return;

    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await TagDesignApi.resetDesign();
      if (res.data) {
        setDesign(res.data);
      } else {
        setDesign(DEFAULT_TAG_DESIGN);
      }
      setSuccessMessage('Tag layout reset to canonical 40×40 mm default.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setErrorMessage(friendlyErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = () => {
    window.print();
  };

  if (isLoading) {
    return <LoadingState message="Loading tag designer..." fullPage />;
  }

  const activeSample = SAMPLE_PRESETS[sampleIndex].data;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 p-3 sm:p-6 lg:p-8">
      {/* ─── Top Header Navigation ──────────────────────────────────── */}
      <div className="no-print max-w-7xl mx-auto mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              id="tag-designer-back-btn"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="p-2 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <Sliders size={20} className="text-purple-600 dark:text-purple-400" />
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-slate-100">
                  Admin Tag Designer
                </h1>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  40 × 40 mm
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                Customize washable cloth physical tag layout • Changes presentation only
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              id="reset-tag-design-btn"
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-semibold px-3"
              icon={<RotateCcw size={15} />}
            >
              Reset Default
            </Button>
            <Button
              id="save-tag-design-btn"
              variant="primary"
              onClick={handleSave}
              disabled={isSaving}
              style={{ minHeight: '44px' }}
              className="min-h-[44px] text-xs font-bold px-4 shadow-sm"
              icon={<Save size={15} />}
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
          {/* Card 1: Field Ordering & Visibility */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-purple-600 dark:text-purple-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Field Arrangement & Typography
                </h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Move fields up/down to change vertical flow
              </span>
            </div>

            <div className="space-y-3" id="tag-fields-list">
              {design.fields.map((fieldCfg, index) => {
                const isFirst = index === 0;
                const isLast = index === design.fields.length - 1;

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
                    {/* Header: Reorder buttons, Name, Visibility Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {/* Move Up / Down */}
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
                            {index + 1}. {fieldCfg.label || fieldCfg.field}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400">
                            Key: {fieldCfg.field}
                          </span>
                        </div>
                      </div>

                      {/* Enable/Disable Toggle */}
                      <button
                        type="button"
                        id={`toggle-field-btn-${fieldCfg.field}`}
                        onClick={() => handleFieldToggle(index)}
                        aria-label={`Toggle visibility of ${fieldCfg.label || fieldCfg.field}`}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md border min-h-[44px] cursor-pointer transition-colors ${
                          fieldCfg.enabled
                            ? 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700'
                            : 'bg-gray-100 text-gray-500 border-gray-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}
                      >
                        {fieldCfg.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                        <span>{fieldCfg.enabled ? 'Visible' : 'Hidden'}</span>
                      </button>
                    </div>

                    {/* Field Presentation Controls: Alignment, Font Size, Style */}
                    {fieldCfg.enabled && (
                      <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                        {/* Text Alignment */}
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-gray-500 dark:text-slate-400 mr-1">
                            Align:
                          </span>
                          <div className="inline-flex rounded-md shadow-sm">
                            <button
                              type="button"
                              id={`align-left-btn-${fieldCfg.field}`}
                              onClick={() => handleAlignmentChange(index, 'left')}
                              aria-label="Align left"
                              className={`p-2 rounded-l-md border min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
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
                              onClick={() => handleAlignmentChange(index, 'center')}
                              aria-label="Align center"
                              className={`p-2 border-t border-b border-r min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
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
                              onClick={() => handleAlignmentChange(index, 'right')}
                              aria-label="Align right"
                              className={`p-2 rounded-r-md border border-t border-b border-r min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors cursor-pointer ${
                                fieldCfg.alignment === 'right'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700 hover:bg-gray-50'
                              }`}
                            >
                              <AlignRight size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Font Size Stepper (Clamped 6.0px - 18.0px) */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500 dark:text-slate-400">
                            Size:
                          </span>
                          <button
                            type="button"
                            id={`decrease-fontsize-btn-${fieldCfg.field}`}
                            onClick={() => handleFontSizeChange(index, -0.5)}
                            disabled={fieldCfg.fontSize <= 6}
                            aria-label="Decrease font size"
                            className="px-2.5 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            -
                          </button>
                          <span
                            id={`fontsize-display-${fieldCfg.field}`}
                            className="font-mono font-bold text-xs min-w-[40px] text-center"
                          >
                            {fieldCfg.fontSize}px
                          </span>
                          <button
                            type="button"
                            id={`increase-fontsize-btn-${fieldCfg.field}`}
                            onClick={() => handleFontSizeChange(index, 0.5)}
                            disabled={fieldCfg.fontSize >= 18}
                            aria-label="Increase font size"
                            className="px-2.5 py-1 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>

                        {/* Bold & Uppercase toggles */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            id={`bold-toggle-btn-${fieldCfg.field}`}
                            onClick={() => handleBoldToggle(index)}
                            aria-label="Toggle bold"
                            className={`px-3 py-1.5 rounded border min-h-[44px] text-xs font-bold cursor-pointer transition-colors ${
                              fieldCfg.isBold
                                ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700'
                            }`}
                          >
                            B
                          </button>
                          <button
                            type="button"
                            id={`uppercase-toggle-btn-${fieldCfg.field}`}
                            onClick={() => handleUppercaseToggle(index)}
                            aria-label="Toggle uppercase"
                            className={`px-3 py-1.5 rounded border min-h-[44px] text-xs font-bold cursor-pointer transition-colors ${
                              fieldCfg.isUppercase
                                ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800'
                                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-700'
                            }`}
                          >
                            AA
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Card 2: Margins & Border Styling */}
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Maximize2 size={18} className="text-purple-600 dark:text-purple-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Tag Padding & Border
                </h2>
              </div>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                Safe physical boundary controls
              </span>
            </div>

            {/* Container Padding Steppers */}
            <div className="mb-5">
              <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Safe Tag Inset Padding (mm)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
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
                      {design.containerPaddingMm[side]} mm
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        id={`decrease-padding-btn-${side}`}
                        onClick={() => handlePaddingChange(side, -0.5)}
                        disabled={design.containerPaddingMm[side] <= 1.5}
                        aria-label={`Decrease ${side} padding`}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        id={`increase-padding-btn-${side}`}
                        onClick={() => handlePaddingChange(side, 0.5)}
                        disabled={design.containerPaddingMm[side] >= 4.0}
                        aria-label={`Increase ${side} padding`}
                        className="px-2 py-1 rounded border border-gray-300 dark:border-slate-700 min-h-[44px] min-w-[44px] flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Border Style Selector */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-2">
                Perimeter Guide Line
              </h3>
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

        {/* ─── Right Column: Live 40×40 mm Preview (lg:col-span-5) ──────── */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="p-4 sm:p-5 sticky top-6">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Type size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                  Live 40 × 40 mm Preview
                </h2>
              </div>
              <button
                type="button"
                id="toggle-calib-view-btn"
                onClick={() => setShowCalibrationPreview((prev) => !prev)}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-md border min-h-[44px] flex items-center gap-1 cursor-pointer transition-colors ${
                  showCalibrationPreview
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-700'
                }`}
              >
                <Compass size={14} />
                <span>{showCalibrationPreview ? 'Show Tag' : 'Calibration'}</span>
              </button>
            </div>

            {/* Sample Data Switcher */}
            <div className="mb-4">
              <label
                htmlFor="sample-preset-select"
                className="text-xs font-bold text-gray-700 dark:text-slate-300 block mb-1"
              >
                Sample Garment Order:
              </label>
              <select
                id="sample-preset-select"
                value={sampleIndex}
                onChange={(e) => setSampleIndex(Number(e.target.value))}
                className="w-full text-xs font-semibold p-2.5 rounded-md border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100 min-h-[44px]"
              >
                {SAMPLE_PRESETS.map((preset, idx) => (
                  <option key={preset.label} value={idx}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Render Surface (Exact 40×40 mm Tag) */}
            <div className="flex flex-col items-center justify-center p-6 bg-gray-100 dark:bg-slate-950/70 rounded-xl border border-gray-200 dark:border-slate-800">
              {/* Surrounding mounting plate */}
              <div
                className="relative bg-white shadow-lg rounded-sm p-1 border border-gray-300 flex items-center justify-center"
                style={{
                  width: '42mm',
                  height: '42mm',
                }}
              >
                {showCalibrationPreview ? (
                  <TagCalibrationCard />
                ) : (
                  <PhysicalTag data={activeSample} design={design} />
                )}
              </div>

              {/* Physical specifications readout */}
              <div className="mt-4 text-center space-y-1">
                <div className="text-xs font-bold text-gray-800 dark:text-slate-200 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Exact Print Boundary: 40.0 mm × 40.0 mm
                </div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  Target physical material: Washable cloth garment tag (1:1 square)
                </div>
              </div>
            </div>

            {/* Direct Print Test Action */}
            <div className="mt-5 pt-4 border-t border-gray-200 dark:border-slate-800">
              <Button
                id="designer-print-test-btn"
                variant="primary"
                onClick={handleTestPrint}
                style={{ minHeight: '44px' }}
                className="w-full min-h-[44px] font-bold text-xs shadow-sm flex items-center justify-center gap-2"
                icon={<Printer size={16} />}
              >
                Print Test Sample Tag (40×40 mm)
              </Button>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 text-center mt-2">
                Sends test tag directly to the browser print engine with 0 margins
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* ─── Print-Only DOM Container (targeted by @media print) ──────── */}
      <TagPrintLayout
        tags={[activeSample]}
        isCalibration={showCalibrationPreview}
        id="printable-tags"
        design={design}
      />
    </div>
  );
};

export default TagDesignerPage;
