import React from 'react';
import {
  DEFAULT_TAG_DESIGN,
  CANONICAL_7FIELD_TAG_DESIGN,
  type TagDesignConfig,
  type TagFieldConfig,
  formatShopName,
  resolveServiceShortcut,
  resolveGarmentCategory,
  formatGarmentSequence,
  formatPieceNumber,
  formatGarmentTagLine,
  formatTagDueDate,
} from '@growfast/shared-types';

export interface PhysicalTagData {
  orderNumber?: string;
  tagId?: string;
  unitNumber: number;
  totalPieces: number;
  customerName: string;
  serviceType: string;
  garmentName: string;
  garmentCategory?: string;
  pieceNumber?: string;
  shopName?: string;
  serviceShortcut?: string;
  storeName?: string;
  storeLocation?: string;
  orderDate?: string | Date;
  isCancelled?: boolean;
  isDelivered?: boolean;
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
export function getServiceCode(
  serviceType: string,
  customShortcuts?: Record<string, string>,
): string {
  if (!serviceType) return 'GEN';
  return resolveServiceShortcut(serviceType, customShortcuts);
}

/**
 * Formats order date to compact physical tag date format:
 * e.g. "02 Sep 26 Wed" or "08 Oct 26 Thu"
 */
export function formatTagDate(dateInput?: string | Date): string {
  if (!dateInput) return '';
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
      return 'Arial, Helvetica, sans-serif';
    case 'Roboto':
      return 'Roboto, sans-serif';
    case 'Inter':
      return 'Inter, sans-serif';
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
    garmentCategory,
    pieceNumber,
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

  const serviceCode = getServiceCode(serviceType, activeDesign.serviceShortcuts);
  const resolvedCategory = resolveGarmentCategory(garmentCategory, garmentName);
  const resolvedPiece = pieceNumber || formatPieceNumber(unitNumber, totalPieces);
  const resolvedShortcut =
    data.serviceShortcut || resolveServiceShortcut(serviceType, activeDesign.serviceShortcuts);

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
      return formatTagDueDate(preponed);
    }

    return formatTagDueDate(dateObj);
  }, [
    dueDate,
    orderDate,
    activeDesign.preponeWorkshopDueDate,
    activeDesign.workshopPreponeDays,
    isWorkshop,
  ]);

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
      case 'serviceAndPiece': {
        const lineText = formatGarmentTagLine({
          serviceShortcut: serviceCode,
          garmentCategory: resolvedCategory,
          pieceNumber: resolvedPiece,
        });
        const baseFontSize = fieldCfg.fontSize || 12;
        const effectiveFontSize =
          lineText.length > 25
            ? Math.max(8.5, baseFontSize - 3)
            : lineText.length > 18
              ? Math.max(9.5, baseFontSize - 1.5)
              : baseFontSize;

        return (
          <div
            key={fieldCfg.field}
            className={`my-0.5 overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-operational-line"
          >
            <span
              className="block truncate uppercase font-bold tracking-wide break-words"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial Black'),
                fontSize: `${effectiveFontSize}px`,
                fontWeight: fieldCfg.isBold !== false ? 'bold' : 'normal',
                textTransform: 'uppercase',
              }}
              title={lineText}
            >
              {lineText}
            </span>
          </div>
        );
      }

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

      case 'dueDate': {
        const formattedDueDate =
          resolvedDueDate || formatTagDueDate(dueDate || bookingDate || orderDate);
        return (
          <div
            key="dueDate"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-due-date"
          >
            <span
              className="truncate block font-bold"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial'),
                fontSize: `${fieldCfg.fontSize || 9.5}px`,
                fontWeight: fieldCfg.isBold !== false ? 'bold' : 'normal',
              }}
            >
              Due: {formattedDueDate}
            </span>
          </div>
        );
      }

      // ─── Canonical 7-Field & 5-Line Garment Tag Fields ─────────────────────────
      case 'shopName': {
        const resolvedShopName = formatShopName(
          data.shopName || activeDesign.shopName,
          data.storeName,
        );
        return (
          <div
            key="shopName"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-shop-name"
          >
            <span
              className="truncate block tracking-wide font-black"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial Black'),
                fontWeight: fieldCfg.isBold !== false ? 'bold' : 'normal',
                fontSize: `${fieldCfg.fontSize || 10}px`,
              }}
              title={resolvedShopName}
            >
              {resolvedShopName}
            </span>
          </div>
        );
      }

      case 'serviceShortcut': {
        const shortcut = resolvedShortcut;
        return (
          <div
            key="serviceShortcut"
            className={`my-0.5 overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-service-shortcut"
          >
            <span
              className="block truncate font-bold tracking-wide"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial Black'),
                fontSize: `${fieldCfg.fontSize || 12}px`,
              }}
              title={shortcut}
            >
              {shortcut}
            </span>
          </div>
        );
      }

      case 'garmentCategory': {
        const cat = resolvedCategory;
        return (
          <div
            key="garmentCategory"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-garment-category"
          >
            <span
              className="truncate block tracking-wide font-bold uppercase"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial Black'),
                fontSize: `${fieldCfg.fontSize || 11}px`,
              }}
              title={cat}
            >
              {cat}
            </span>
          </div>
        );
      }

      case 'pieceNumber': {
        const piece = resolvedPiece;
        return (
          <div
            key="pieceNumber"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-piece-number"
          >
            <span
              className="truncate block font-bold tracking-wider"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Arial Black'),
                fontSize: `${fieldCfg.fontSize || 11}px`,
              }}
              title={piece}
            >
              {piece}
            </span>
          </div>
        );
      }

      case 'garmentSequence': {
        const seq = formatGarmentSequence(garmentName, unitNumber, totalPieces);
        return (
          <div
            key="garmentSequence"
            className={`overflow-hidden leading-tight ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-garment-sequence"
          >
            <span
              className="truncate block tracking-tight font-bold"
              style={{
                ...baseStyle,
                fontFamily: getCssFontFamily(fieldCfg.font || 'Calibri'),
                fontSize: `${fieldCfg.fontSize || 11}px`,
              }}
              title={seq}
            >
              {seq}
            </span>
          </div>
        );
      }

      // ─── Legacy Phase T4 Aliases ──────────────────────────────────
      case 'storeHeader': {
        const headerText =
          data.shopName || (!data.storeLocation && activeDesign.shopName)
            ? formatShopName(data.shopName || activeDesign.shopName, data.storeName)
            : storeHeader;
        return (
          <div
            key="storeHeader"
            className={`overflow-hidden leading-none ${alignClass}`}
            style={{ textAlign }}
            data-testid="tag-store-header"
          >
            <span
              className="tracking-tight truncate block"
              style={{
                ...baseStyle,
                fontSize: `${fieldCfg.fontSize}px`,
              }}
              title={headerText}
            >
              {headerText}
            </span>
          </div>
        );
      }

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

  const fieldsToRender = React.useMemo(() => {
    const raw =
      activeDesign.fields && activeDesign.fields.length > 0
        ? activeDesign.fields
        : CANONICAL_7FIELD_TAG_DESIGN.fields;

    const hasShopHeader = raw.some(
      (f) => (f.field === 'shopName' || f.field === 'storeHeader') && f.enabled,
    );

    if (!hasShopHeader) {
      const defaultShopHeader: TagFieldConfig = {
        field: 'shopName',
        label: 'Shop Name',
        enabled: true,
        fontSize: 10,
        alignment: 'center',
        isBold: true,
        isUppercase: true,
      };
      return [defaultShopHeader, ...raw];
    }
    return raw;
  }, [activeDesign.fields]);

  // Group adjacent operational fields ('serviceShortcut', 'garmentCategory', 'pieceNumber')
  // when enabled, so they form a unified cohesive line "DC | SHIRT | 1/5"
  const renderedElements = React.useMemo(() => {
    const operationalKeys = new Set(['serviceShortcut', 'garmentCategory', 'pieceNumber']);
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < fieldsToRender.length) {
      const fieldCfg = fieldsToRender[i];

      // Check if this field starts an adjacent sequence of operational fields
      if (operationalKeys.has(fieldCfg.field)) {
        const group: TagFieldConfig[] = [];
        let j = i;
        while (j < fieldsToRender.length && operationalKeys.has(fieldsToRender[j].field)) {
          group.push(fieldsToRender[j]);
          j++;
        }

        const enabledInGroup = group.filter((f) => f.enabled);

        if (group.length > 1) {
          if (enabledInGroup.length > 0) {
            const shortcutCfg = group.find((f) => f.field === 'serviceShortcut' && f.enabled);
            const categoryCfg = group.find((f) => f.field === 'garmentCategory' && f.enabled);
            const pieceCfg = group.find((f) => f.field === 'pieceNumber' && f.enabled);

            const shortcutVal = shortcutCfg ? resolvedShortcut : undefined;
            const categoryVal = categoryCfg ? resolvedCategory : undefined;
            const pieceVal = pieceCfg ? resolvedPiece : undefined;

            const lineText = formatGarmentTagLine({
              serviceShortcut: shortcutVal,
              garmentCategory: categoryVal,
              pieceNumber: pieceVal,
            });

            if (lineText) {
              const primaryCfg = categoryCfg || shortcutCfg || pieceCfg || group[0];
              const textAlign = getAlignStyle(primaryCfg.alignment);
              const alignClass =
                textAlign === 'center'
                  ? 'text-center'
                  : textAlign === 'right'
                    ? 'text-right'
                    : 'text-left';

              // Font scaling for long text
              const baseFontSize = primaryCfg.fontSize || 11;
              const effectiveFontSize =
                lineText.length > 25
                  ? Math.max(8.5, baseFontSize - 3)
                  : lineText.length > 18
                    ? Math.max(9.5, baseFontSize - 1.5)
                    : baseFontSize;

              elements.push(
                <div
                  key={`operational-group-${i}`}
                  className={`my-0.5 overflow-hidden leading-tight ${alignClass}`}
                  style={{ textAlign }}
                  data-testid="tag-operational-line"
                >
                  <span
                    className="block font-bold tracking-wide break-words"
                    style={{
                      textAlign,
                      fontFamily: getCssFontFamily(primaryCfg.font || 'Arial Black'),
                      fontSize: `${effectiveFontSize}px`,
                      lineHeight: 1.15,
                      color: '#000000',
                      textTransform: 'uppercase',
                    }}
                    title={lineText}
                  >
                    {lineText}
                  </span>
                </div>,
              );
            }
          }
          i = j;
          continue;
        }
      }

      // Single standalone field
      const rendered = renderField(fieldCfg);
      if (rendered) {
        elements.push(rendered);
      }
      i++;
    }

    return elements;
  }, [
    fieldsToRender,
    resolvedShortcut,
    resolvedCategory,
    resolvedPiece,
    resolvedDueDate,
    activeDesign,
    customerName,
    displayOrderNumber,
    formattedOrderDate,
    storeHeader,
  ]);

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
      {renderedElements}

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
