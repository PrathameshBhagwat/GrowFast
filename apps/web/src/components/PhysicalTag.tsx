import React from 'react';
import {
  DEFAULT_TAG_DESIGN,
  type TagDesignConfig,
  type TagFieldConfig,
} from '@growfast/shared-types';

export interface PhysicalTagData {
  orderNumber?: string;
  tagId?: string;
  unitNumber: number;
  totalPieces: number;
  customerName: string;
  serviceType: string;
  garmentName: string;
  storeName?: string;
  storeLocation?: string;
  orderDate: string | Date;
  isCancelled?: boolean;
  // Reference Image Fields
  customerAddress?: string;
  itemTotal?: number | string;
  remarks?: string;
  colour?: string;
  bookingDate?: string | Date;
  dueDate?: string | Date;
  isWorkshop?: boolean;
  barcodeValue?: string;
  qrCodeValue?: string;
}

export interface PhysicalTagProps {
  data: PhysicalTagData;
  className?: string;
  style?: React.CSSProperties;
  /** When true, renders in high-contrast print mode without screen borders */
  isPrintMode?: boolean;
  /** Optional customized visual presentation layout (Admin Tag Designer) */
  design?: TagDesignConfig;
}

/**
 * Maps service category or category name to canonical compact service abbreviation
 * e.g. DRY_CLEAN -> DC, STEAM_PRESS / STEAM_IRON -> SI, WASH_IRON -> WSI
 */
export function getServiceCode(serviceType: string): string {
  if (!serviceType) return 'GEN';
  const norm = serviceType.toUpperCase().replace(/\s+/g, '_').replace(/&/g, 'AND');
  if (norm.includes('DRY_CLEAN')) return 'DC';
  if (norm.includes('WASH') && (norm.includes('IRON') || norm.includes('STEAM'))) return 'WSI';
  if (norm.includes('WASH') && norm.includes('FOLD')) return 'W+F';
  if (norm.includes('STEAM') || norm.includes('IRON') || norm.includes('PRESS')) return 'SI';
  if (norm.includes('SHOE')) return 'SC';
  if (norm.includes('LEATHER')) return 'LC';
  if (norm.includes('STAIN')) return 'SR';
  if (norm.includes('PREMIUM')) return 'PC';
  if (norm.includes('WASH') || norm.includes('LAUNDRY')) return 'W';
  return norm.replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'GEN';
}

/**
 * Formats order date to compact physical tag date format:
 * e.g. "02 Sep 26 Wed" or "08 Oct 26 Thu"
 */
export function formatTagDate(dateInput: string | Date): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = daysOfWeek[d.getDay()];
  return `${day} ${month} ${year} ${dow}`;
}

/**
 * Compact store header: Store Name / Location
 * e.g. "GROWFAST / AIROLI"
 */
export function formatStoreHeader(storeName?: string, storeLocation?: string): string {
  const name = (storeName || 'GrowFast Laundry').toUpperCase();
  if (storeLocation) {
    return `${name} / ${storeLocation.toUpperCase()}`;
  }
  return name;
}

/**
 * Resolves font name to CSS fontFamily with reliable fallbacks
 */
export function getCssFontFamily(font?: string): string {
  switch (font) {
    case 'C39HrP36DmT':
      return "'C39HrP36DmT', 'Libre Barcode 39', monospace";
    case 'Arial Black':
      return "'Arial Black', Gadget, sans-serif";
    case 'Calibri':
      return "Calibri, Candara, Segoe, 'Segoe UI', Optima, Arial, sans-serif";
    case 'Agency FB':
      return "'Agency FB', Impact, sans-serif";
    case 'Arial':
      return "Arial, Helvetica, sans-serif";
    case 'Roboto':
      return "Roboto, sans-serif";
    case 'Inter':
      return "Inter, sans-serif";
    case 'Courier New':
      return "'Courier New', Courier, monospace";
    default:
      return 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  }
}

/**
 * Physical washable cloth tag layout.
 * Supports configurable 1.5 in x 1.5 in (or custom) dimensions,
 * all reference image canonical fields, barcodes, QR codes, and typography.
 */
export const PhysicalTag: React.FC<PhysicalTagProps> = ({
  data,
  className = '',
  style = {},
  isPrintMode = false,
  design,
}) => {
  const {
    orderNumber,
    tagId,
    unitNumber,
    totalPieces,
    customerName,
    serviceType,
    garmentName,
    storeName,
    storeLocation,
    orderDate,
    isCancelled,
    customerAddress,
    itemTotal,
    remarks,
    colour,
    bookingDate,
    dueDate,
    isWorkshop,
    barcodeValue,
  } = data;

  const displayOrderNumber = orderNumber || tagId || 'ORD-000000';
  const displayTagId = tagId || orderNumber || '';

  const activeDesign = design || DEFAULT_TAG_DESIGN;
  const padding = activeDesign.containerPaddingMm || DEFAULT_TAG_DESIGN.containerPaddingMm;
  const borderStyle = activeDesign.borderStyle ?? 'dashed';

  const serviceCode = getServiceCode(serviceType);
  const piecePosition = `${unitNumber}/${totalPieces}`;
  const formattedOrderDate = formatTagDate(bookingDate || orderDate);
  const storeHeader = formatStoreHeader(storeName, storeLocation);

  // Workshop Due Date Prepone logic
  const resolvedDueDate = React.useMemo(() => {
    const rawDue = dueDate || orderDate;
    if (!rawDue) return '';
    const dateObj = new Date(rawDue);
    if (isNaN(dateObj.getTime())) return '';

    // If workshop prepone is enabled and this is a workshop tag, bring forward
    if (
      activeDesign.preponeWorkshopDueDate &&
      isWorkshop &&
      (activeDesign.workshopPreponeDays || 0) > 0
    ) {
      const days = activeDesign.workshopPreponeDays || 1;
      const preponed = new Date(dateObj.getTime() - days * 24 * 60 * 60 * 1000);
      return formatTagDate(preponed);
    }

    return formatTagDate(dateObj);
  }, [dueDate, orderDate, activeDesign.preponeWorkshopDueDate, activeDesign.workshopPreponeDays, isWorkshop]);

  const getBorderValue = () => {
    if (borderStyle === 'none') return 'none';
    const color = isPrintMode ? '#d1d5db' : activeDesign.borderColor || '#9ca3af';
    return `1px ${borderStyle} ${color}`;
  };

  const getAlignStyle = (align?: string): React.CSSProperties['textAlign'] => {
    if (align === 'center') return 'center';
    if (align === 'right') return 'right';
    if (align === 'left') return 'left';
    return activeDesign.align || 'center';
  };

  const renderField = (fieldCfg: TagFieldConfig) => {
    if (!fieldCfg.enabled) return null;

    const textAlign = getAlignStyle(fieldCfg.alignment);
    const alignClass =
      textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';
    const fontFamily = getCssFontFamily(fieldCfg.font);
    const fontStyle = fieldCfg.isItalic ? 'italic' : 'normal';
    const textDecoration = fieldCfg.isUnderline ? 'underline' : 'none';
    const fontWeight = fieldCfg.isBold ? ('bold' as const) : ('normal' as const);
    const textTransform = fieldCfg.isUppercase ? ('uppercase' as const) : ('none' as const);

    const baseStyle: React.CSSProperties = {
      textAlign,
      fontFamily,
      fontStyle,
      textDecoration,
      fontWeight,
      textTransform,
      fontSize: `${fieldCfg.fontSize}px`,
      lineHeight: 1.15,
      color: '#000000',
    };

    switch (fieldCfg.field) {
      // ─── Reference Image Canonical Fields ─────────────────────────
      case 'barcode': {
        const rawCode = barcodeValue || orderNumber || tagId || 'ORD001284';
        const formattedCode = `*${rawCode.replace(/[^A-Za-z0-9-]/g, '').toUpperCase()}*`;
        return (
          <div
            key="barcode"
            className={`overflow-hidden my-0.5 leading-none ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="tracking-wider block"
              style={{
                fontFamily: getCssFontFamily(fieldCfg.font || 'C39HrP36DmT'),
                fontSize: `${fieldCfg.fontSize || 26}px`,
                letterSpacing: '2px',
                color: '#000000',
              }}
              title={rawCode}
            >
              {formattedCode}
            </span>
          </div>
        );
      }

      case 'qrcode': {
        return (
          <div
            key="qrcode"
            className={`my-0.5 flex justify-center leading-none ${alignClass}`}
            style={{ textAlign }}
          >
            <div
              className="bg-black p-0.5 rounded flex items-center justify-center text-white font-mono text-[7px]"
              style={{
                width: `${fieldCfg.fontSize || 32}px`,
                height: `${fieldCfg.fontSize || 32}px`,
              }}
              title={`QR: ${orderNumber || tagId}`}
            >
              <svg viewBox="0 0 24 24" className="w-full h-full text-white fill-current">
                <path d="M2 2h8v8H2V2zm2 2v4h4V4H4zm10-2h8v8h-8V2zm2 2v4h4V4h-4zM2 14h8v8H2v-8zm2 2v4h4v-4H4zm14 2h2v4h-2v-4zm-4-2h2v2h-2v-2zm2-2h2v2h-2v-2zm2 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 2h2v2h-2v-2z" />
              </svg>
            </div>
          </div>
        );
      }

      case 'bookingNo':
      case 'orderNumber':
        return (
          <div
            key="bookingNo"
            className={`my-0.5 overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block tracking-wide"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial Black'),
                fontWeight: fieldCfg.isBold !== false ? '900' : 'normal',
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={displayOrderNumber}
            >
              {displayOrderNumber}
            </span>
          </div>
        );

      case 'customer':
      case 'customerName':
        return (
          <div
            key="customer"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Calibri'),
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={customerName}
            >
              {customerName}
            </span>
          </div>
        );

      case 'address':
        return (
          <div
            key="address"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial'),
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={customerAddress || storeLocation || 'Pune'}
            >
              {customerAddress || storeLocation || 'Pune'}
            </span>
          </div>
        );

      case 'process':
      case 'serviceAndPiece':
        return (
          <div
            key="process"
            className={`my-0.5 overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="block truncate"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial'),
                fontSize: `${fieldCfg.fontSize}px`,
              }}
            >
              {serviceCode} <span className="ml-1 tracking-tight">{piecePosition}</span>
            </span>
          </div>
        );

      case 'itemTotal':
        return (
          <div
            key="itemTotal"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block"
              style={{
                ...baseStyle,
                fontSize: `${fieldCfg.fontSize}px`,
              }}
            >
              {itemTotal ? `Total: ${itemTotal}` : `Total: ${totalPieces} Pcs`}
            </span>
          </div>
        );

      case 'remark':
        return (
          <div
            key="remark"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial'),
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={remarks || 'No remarks'}
            >
              {remarks || 'No remarks'}
            </span>
          </div>
        );

      case 'colour':
        return (
          <div
            key="colour"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block text-slate-700"
              style={{
                ...baseStyle,
                fontSize: `${fieldCfg.fontSize}px`,
              }}
            >
              {colour || 'Standard'}
            </span>
          </div>
        );

      case 'bookingDate':
      case 'date':
        return (
          <div
            key="bookingDate"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Agency FB'),
                fontSize: `${fieldCfg.fontSize}px`,
              }}
            >
              {formattedOrderDate}
            </span>
          </div>
        );

      case 'dueDate':
        return (
          <div
            key="dueDate"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial'),
                fontSize: `${fieldCfg.fontSize}px`,
              }}
            >
              Due: {resolvedDueDate || formattedOrderDate}
            </span>
          </div>
        );

      // ─── Legacy Phase T4 Aliases ──────────────────────────────────
      case 'storeHeader':
        return (
          <div
            key="storeHeader"
            className={`overflow-hidden leading-none ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="tracking-tight truncate block"
              style={{
                ...baseStyle,
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={storeHeader}
            >
              {storeHeader}
            </span>
          </div>
        );

      case 'tagId':
        return (
          <div
            key="tagId"
            className={`my-0.5 overflow-hidden leading-none ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="tracking-wide block truncate"
              style={{
                ...baseStyle,
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={displayTagId}
            >
              {displayTagId}
            </span>
          </div>
        );

      case 'garmentName':
        return (
          <div
            key="garmentName"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
          >
            <span
              className="truncate block tracking-tight"
              style={{
                ...baseStyle,
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={garmentName}
            >
              {garmentName}
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  const fieldsToRender =
    activeDesign.fields && activeDesign.fields.length > 0
      ? activeDesign.fields
      : DEFAULT_TAG_DESIGN.fields;

  // Resolve dimensions e.g. '1.5 in' -> '40mm' (calibrated for 40x40mm thermal cloth tags)
  const resolveDimension = (dim?: string, fallback = '40mm') => {
    if (!dim) return fallback;
    if (dim.includes('1.5 in') || dim === '1.5in') return '40mm';
    if (dim.includes('2.0 in') || dim === '2.0in') return '50mm';
    if (dim.includes('40 mm') || dim === '40mm') return '40mm';
    if (dim.includes('50 mm') || dim === '50mm') return '50mm';
    return dim;
  };

  const tagWidth = resolveDimension(activeDesign.width, '40mm');
  const tagHeight = resolveDimension(activeDesign.height, '40mm');

  return (
    <div
      className={`physical-tag-40mm physical-tag-container relative select-none ${
        isCancelled ? 'opacity-80' : ''
      } ${className}`}
      style={{
        width: tagWidth,
        height: tagHeight,
        minWidth: tagWidth,
        minHeight: tagHeight,
        maxWidth: tagWidth,
        maxHeight: tagHeight,
        boxSizing: 'border-box',
        padding: `${padding.top}mm ${padding.right}mm ${padding.bottom}mm ${padding.left}mm`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily: getCssFontFamily(),
        lineHeight: activeDesign.lineHeight || 1.15,
        overflow: 'hidden',
        border: getBorderValue(),
        boxShadow: isPrintMode ? 'none' : '0 1px 3px rgba(0,0,0,0.08)',
        ...style,
      }}
      data-tag-id={tagId}
      data-unit-number={unitNumber}
    >
      {fieldsToRender.map(renderField)}

      {/* ─── Optional Cancelled Watermark ───────────────────────────── */}
      {isCancelled && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
        >
          <span className="text-[11px] font-black tracking-widest text-red-600 border border-red-600 px-1 py-0.5 rotate-[-15deg] uppercase bg-white/90">
            CANCELLED
          </span>
        </div>
      )}
    </div>
  );
};
