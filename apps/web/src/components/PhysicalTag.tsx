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
 * 40mm x 40mm physical washable cloth tag layout.
 * Visual source of truth is the reference tag:
 * - Line 1: Store name / location (compact uppercase)
 * - Line 2: Order Number (large, bold, prominent primary anchor e.g. ORD-001284)
 * - Line 3: Customer name
 * - Line 4: Service abbreviation + piece position (e.g. "DC  1/5" or "WSI  12/50")
 * - Line 5: Date with weekday (e.g. "2 Sep 26 Tue")
 * - Line 6: Garment name
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
  } = data;

  const displayOrderNumber = orderNumber || tagId || 'ORD-000000';
  const displayTagId = tagId || orderNumber || '';

  const activeDesign = design || DEFAULT_TAG_DESIGN;
  const padding = activeDesign.containerPaddingMm || DEFAULT_TAG_DESIGN.containerPaddingMm;
  const borderStyle = activeDesign.borderStyle ?? 'dashed';

  const serviceCode = getServiceCode(serviceType);
  const piecePosition = `${unitNumber}/${totalPieces}`;
  const formattedDate = formatTagDate(orderDate);
  const storeHeader = formatStoreHeader(storeName, storeLocation);

  const getBorderValue = () => {
    if (borderStyle === 'none') return 'none';
    const color = isPrintMode ? '#d1d5db' : activeDesign.borderColor || '#9ca3af';
    return `1px ${borderStyle} ${color}`;
  };

  const getAlignClass = (align?: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  const renderField = (fieldCfg: TagFieldConfig) => {
    if (!fieldCfg.enabled) return null;

    const alignClass = getAlignClass(fieldCfg.alignment);
    const weightClass = fieldCfg.isBold ? 'font-bold' : 'font-normal';
    const monoClass = fieldCfg.isMono ? 'font-mono' : '';
    const upperClass = fieldCfg.isUppercase ? 'uppercase' : '';

    switch (fieldCfg.field) {
      case 'storeHeader':
        return (
          <div key="storeHeader" className={`overflow-hidden ${alignClass}`}>
            <span
              className={`tracking-tight text-black truncate leading-none block ${weightClass} ${upperClass}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
              title={storeHeader}
            >
              {storeHeader}
            </span>
          </div>
        );

      case 'orderNumber':
        return (
          <div key="orderNumber" className={`my-0.5 overflow-hidden ${alignClass}`}>
            <div
              className={`tracking-wide text-black leading-none truncate ${fieldCfg.isBold ? 'font-black' : 'font-normal'} ${monoClass} ${upperClass}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
              title={displayOrderNumber}
            >
              {displayOrderNumber}
            </div>
          </div>
        );

      case 'tagId':
        return (
          <div key="tagId" className={`my-0.5 overflow-hidden ${alignClass}`}>
            <div
              className={`tracking-wide text-black leading-none truncate ${fieldCfg.isBold ? 'font-black' : 'font-normal'} ${monoClass} ${upperClass}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
              title={displayTagId}
            >
              {displayTagId}
            </div>
          </div>
        );

      case 'customerName':
        return (
          <div key="customerName" className={`overflow-hidden ${alignClass}`}>
            <div
              className={`text-black truncate leading-tight ${fieldCfg.isBold ? 'font-semibold' : 'font-normal'} ${upperClass}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
              title={customerName}
            >
              {customerName}
            </div>
          </div>
        );

      case 'serviceAndPiece':
        return (
          <div key="serviceAndPiece" className={`my-0.5 overflow-hidden ${alignClass}`}>
            <span
              className={`text-black leading-none ${fieldCfg.isBold ? 'font-black' : 'font-normal'}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
            >
              {serviceCode} <span className="ml-1 tracking-tight">{piecePosition}</span>
            </span>
          </div>
        );

      case 'date':
        return (
          <div key="date" className={`overflow-hidden ${alignClass}`}>
            <div
              className={`text-black truncate leading-tight ${weightClass}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
            >
              {formattedDate}
            </div>
          </div>
        );

      case 'garmentName':
        return (
          <div key="garmentName" className={`overflow-hidden ${alignClass}`}>
            <div
              className={`text-black truncate leading-none tracking-tight ${fieldCfg.isBold ? 'font-semibold' : 'font-normal'} ${upperClass}`}
              style={{ fontSize: `${fieldCfg.fontSize}px` }}
              title={garmentName}
            >
              {garmentName}
            </div>
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

  return (
    <div
      className={`physical-tag-40mm relative select-none ${
        isCancelled ? 'opacity-80' : ''
      } ${className}`}
      style={{
        width: '40mm',
        height: '40mm',
        minWidth: '40mm',
        minHeight: '40mm',
        maxWidth: '40mm',
        maxHeight: '40mm',
        boxSizing: 'border-box',
        padding: `${padding.top}mm ${padding.right}mm ${padding.bottom}mm ${padding.left}mm`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        color: '#000000',
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
