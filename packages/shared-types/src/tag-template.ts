/**
 * Tag Template & Visual Layout Contracts (Phase T4 & Owner Design Tags)
 *
 * Defines the presentation customization schema for physical washable cloth tags.
 * Allows store owners to customize visual field order, visibility, alignment, font sizing,
 * styles (bold, italic, underline), dimensions, paper, printer, and workshop prepone due dates
 * while strictly preserving physical geometry and authoritative data.
 */

export type TagFieldKey =
  // ─── Reference Image Canonical Fields ──────────────────────────────
  | 'barcode' // BarCode (Code 39 barcode)
  | 'qrcode' // QRCode
  | 'bookingNo' // Booking No. (orderNumber)
  | 'customer' // Customer name
  | 'address' // Customer address
  | 'process' // Service abbreviation + piece position (e.g. DC 1/5)
  | 'itemTotal' // Item Total / total pieces
  | 'remark' // Defect notes / remarks
  | 'colour' // Color tags
  | 'bookingDate' // Order booking date
  | 'dueDate' // Delivery due date
  // ─── Legacy Phase T4 Aliases ────────────────────────────────────────
  | 'storeHeader' // Store name / location
  | 'orderNumber' // Primary anchor
  | 'tagId' // Authoritative internal PhysicalGarment.tagId
  | 'customerName' // Customer name alias
  | 'serviceAndPiece' // Service & piece alias
  | 'date' // Order date alias
  | 'garmentName'; // Garment description

export type TagTextAlign = 'left' | 'center' | 'right';

export interface TagFieldConfig {
  field: TagFieldKey;
  enabled: boolean;
  fontSize: number; // in px
  alignment: TagTextAlign;
  font?: string; // e.g. 'Arial', 'Arial Black', 'Calibri', 'Agency FB', 'C39HrP36DmT'
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  isMono?: boolean;
  isUppercase?: boolean;
  label?: string; // Human readable field label
}

export interface TagContainerPadding {
  top: number; // in mm (safe bounds: 1.5mm to 4mm)
  right: number;
  bottom: number;
  left: number;
}

export interface TagDesignAuditEntry {
  updatedAt: string;
  updatedById: string;
  updatedByName: string;
  updatedByEmail?: string | null;
  version: number;
  changesSummary?: string;
}

export interface TagDesignConfig {
  id?: string;
  storeId?: string;
  version: number;
  name: string;
  width?: string; // e.g. '1.5 in'
  height?: string; // e.g. '1.5 in'
  printer?: string; // e.g. 'TSC TE244'
  wetStrengthPaper?: boolean;
  align?: TagTextAlign;
  preponeWorkshopDueDate?: boolean;
  workshopPreponeDays?: number; // Reference default: 1
  fields: TagFieldConfig[]; // Array order directly determines vertical rendering sequence
  containerPaddingMm: TagContainerPadding;
  borderStyle: 'dashed' | 'solid' | 'none';
  borderColor?: string;
  lineHeight?: number;
  lastUpdatedBy?: {
    id: string;
    name: string;
    email?: string | null;
  };
  lastUpdatedAt?: string;
  auditHistory?: TagDesignAuditEntry[];
}

export interface TagTemplateDTO {
  id: string;
  storeId: string;
  name: string;
  version: number;
  isActive: boolean;
  layout: TagDesignConfig;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTagDesignRequest {
  name?: string;
  layout: TagDesignConfig;
}

export const SUPPORTED_TAG_FONTS = [
  'Arial',
  'Arial Black',
  'Calibri',
  'Agency FB',
  'C39HrP36DmT',
  'Roboto',
  'Inter',
  'Courier New',
] as const;

export type SupportedTagFont = (typeof SUPPORTED_TAG_FONTS)[number];

export const SUPPORTED_TAG_PRINTERS = [
  'TSC TE244',
  'Zebra ZD220 / ZD230',
  'Generic ESC/POS Thermal',
  'Standard Browser / System Printer',
] as const;

export const SUPPORTED_TAG_DIMENSIONS = ['1.5 in', '2.0 in', '40 mm', '50 mm'] as const;

/**
 * Approved canonical reference default tag design from user UI specification.
 */
export const REFERENCE_TAG_DESIGN: TagDesignConfig = {
  version: 1,
  name: 'Standard 1.5×1.5 in Tag (TSC TE244)',
  width: '1.5 in',
  height: '1.5 in',
  printer: 'TSC TE244',
  wetStrengthPaper: true,
  align: 'center',
  preponeWorkshopDueDate: false,
  workshopPreponeDays: 1,
  fields: [
    {
      field: 'barcode',
      label: 'BarCode',
      enabled: false,
      font: 'C39HrP36DmT',
      alignment: 'center',
      fontSize: 26,
      isBold: false,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'qrcode',
      label: 'QRCode',
      enabled: false,
      alignment: 'center',
      fontSize: 32,
    },
    {
      field: 'bookingNo',
      label: 'Booking No.',
      enabled: true,
      font: 'Arial Black',
      alignment: 'center',
      fontSize: 19,
      isBold: true,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'customer',
      label: 'Customer',
      enabled: true,
      font: 'Calibri',
      alignment: 'center',
      fontSize: 11,
      isBold: true,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'address',
      label: 'Address',
      enabled: false,
      font: 'Arial',
      alignment: 'center',
      fontSize: 12,
      isBold: false,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'process',
      label: 'Process',
      enabled: true,
      font: 'Arial',
      alignment: 'center',
      fontSize: 13,
      isBold: true,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'itemTotal',
      label: 'Item Total',
      enabled: true,
      alignment: 'center',
      fontSize: 11,
      isBold: true,
    },
    {
      field: 'remark',
      label: 'Remark',
      enabled: false,
      font: 'Arial',
      alignment: 'center',
      fontSize: 9,
      isBold: false,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'colour',
      label: 'Colour',
      enabled: false,
      alignment: 'center',
      fontSize: 9,
    },
    {
      field: 'bookingDate',
      label: 'Booking Date',
      enabled: false,
      font: 'Agency FB',
      alignment: 'center',
      fontSize: 8,
      isBold: true,
      isItalic: false,
      isUnderline: false,
    },
    {
      field: 'dueDate',
      label: 'Due Date',
      enabled: true,
      font: 'Arial',
      alignment: 'center',
      fontSize: 14,
      isBold: true,
      isItalic: false,
      isUnderline: false,
    },
  ],
  containerPaddingMm: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
  borderStyle: 'dashed',
  borderColor: '#d1d5db',
  lineHeight: 1.15,
};

/**
 * Approved canonical default tag design baseline (Phase T4).
 * Primary anchor displays the Short Order Business ID (e.g. ORD-001284) alongside piece position (e.g. 1/5).
 */
export const DEFAULT_TAG_DESIGN: TagDesignConfig = {
  version: 1,
  name: 'Standard 40×40 mm Washable Cloth Tag',
  width: '1.5 in',
  height: '1.5 in',
  printer: 'TSC TE244',
  wetStrengthPaper: true,
  align: 'center',
  preponeWorkshopDueDate: false,
  workshopPreponeDays: 1,
  fields: [
    {
      field: 'storeHeader',
      enabled: true,
      fontSize: 7.5,
      alignment: 'left',
      isBold: true,
      isUppercase: true,
      label: 'Store & Location',
    },
    {
      field: 'orderNumber',
      enabled: true,
      fontSize: 15,
      alignment: 'left',
      isBold: true,
      isMono: true,
      isUppercase: true,
      label: 'Order Number (Primary Anchor)',
    },
    {
      field: 'customerName',
      enabled: true,
      fontSize: 9,
      alignment: 'left',
      isBold: true,
      label: 'Customer Name',
    },
    {
      field: 'serviceAndPiece',
      enabled: true,
      fontSize: 11,
      alignment: 'left',
      isBold: true,
      label: 'Service & Piece Position',
    },
    {
      field: 'date',
      enabled: true,
      fontSize: 8,
      alignment: 'left',
      isBold: false,
      label: 'Order Date & Weekday',
    },
    {
      field: 'garmentName',
      enabled: true,
      fontSize: 8.5,
      alignment: 'left',
      isBold: true,
      isUppercase: true,
      label: 'Garment Description',
    },
    {
      field: 'tagId',
      enabled: false,
      fontSize: 7.5,
      alignment: 'left',
      isBold: false,
      isMono: true,
      label: 'Internal Piece Tag ID',
    },
  ],
  containerPaddingMm: {
    top: 2.5,
    right: 3.0,
    bottom: 2.5,
    left: 3.0,
  },
  borderStyle: 'dashed',
  borderColor: '#d1d5db',
  lineHeight: 1.15,
};

/**
 * Validates and clamps a TagDesignConfig to safe boundaries.
 * Prevents negative positioning, extreme fonts, or invalid field keys.
 */
export function sanitizeTagDesign(input?: Partial<TagDesignConfig>): TagDesignConfig {
  if (!input || !Array.isArray(input.fields)) {
    return { ...DEFAULT_TAG_DESIGN };
  }

  const referenceKeys: TagFieldKey[] = [
    'barcode',
    'qrcode',
    'bookingNo',
    'customer',
    'address',
    'process',
    'itemTotal',
    'remark',
    'colour',
    'bookingDate',
    'dueDate',
  ];

  const legacyKeys: TagFieldKey[] = [
    'storeHeader',
    'orderNumber',
    'customerName',
    'serviceAndPiece',
    'date',
    'garmentName',
    'tagId',
  ];

  const validKeys: TagFieldKey[] = [...referenceKeys, ...legacyKeys];

  // Map known fields with safe clamped values
  const fields: TagFieldConfig[] = input.fields
    .filter((f) => validKeys.includes(f.field))
    .map((f) => {
      const rawFontSize = typeof f.fontSize === 'number' && !isNaN(f.fontSize) ? f.fontSize : 8;
      // Clamp bounds: standard fields 6-18 (up to 28 for barcode/bookingNo)
      const maxBound = f.field === 'barcode' || f.field === 'bookingNo' ? 28 : 18;
      const clampedFontSize = Math.min(Math.max(rawFontSize, 6), maxBound);
      const alignment: TagTextAlign = ['left', 'center', 'right'].includes(f.alignment)
        ? f.alignment
        : 'center';

      return {
        field: f.field,
        enabled: f.field === 'orderNumber' || f.field === 'bookingNo' ? true : Boolean(f.enabled),
        fontSize: clampedFontSize,
        alignment,
        font: f.font ? String(f.font).trim() : undefined,
        isBold: f.isBold ?? true,
        isItalic: Boolean(f.isItalic),
        isUnderline: Boolean(f.isUnderline),
        isMono: f.field === 'orderNumber' || f.field === 'tagId' || f.field === 'bookingNo',
        isUppercase:
          f.isUppercase ??
          (f.field === 'storeHeader' ||
            f.field === 'garmentName' ||
            f.field === 'orderNumber' ||
            f.field === 'bookingNo'),
        label:
          f.label ||
          (f.field === 'orderNumber'
            ? 'Order Number (Primary Anchor)'
            : f.field === 'bookingNo'
              ? 'Booking No.'
              : f.field),
      };
    });

  // Ensure all keys of the matching set exist
  const isReferenceSet = fields.some((f) => referenceKeys.includes(f.field));
  const expectedKeys = isReferenceSet ? referenceKeys : legacyKeys;
  const defaultSource = isReferenceSet ? REFERENCE_TAG_DESIGN : DEFAULT_TAG_DESIGN;

  for (const key of expectedKeys) {
    if (!fields.some((f) => f.field === key)) {
      const defaultField = defaultSource.fields.find((df) => df.field === key);
      if (defaultField) {
        fields.push({ ...defaultField });
      }
    }
  }

  const padding = input.containerPaddingMm || DEFAULT_TAG_DESIGN.containerPaddingMm;
  const getPad = (val: unknown, fallback: number) =>
    typeof val === 'number' && !isNaN(val) ? val : fallback;

  const clampedPadding: TagContainerPadding = {
    top: Math.min(Math.max(getPad(padding.top, 2.5), 1.5), 4.0),
    right: Math.min(Math.max(getPad(padding.right, 3.0), 1.5), 4.0),
    bottom: Math.min(Math.max(getPad(padding.bottom, 2.5), 1.5), 4.0),
    left: Math.min(Math.max(getPad(padding.left, 3.0), 1.5), 4.0),
  };

  const borderStyle = ['dashed', 'solid', 'none'].includes(input.borderStyle as string)
    ? input.borderStyle!
    : 'dashed';

  const width = input.width ? String(input.width).trim() : '1.5 in';
  const height = input.height ? String(input.height).trim() : '1.5 in';
  const printer = input.printer ? String(input.printer).trim() : 'TSC TE244';
  const wetStrengthPaper =
    input.wetStrengthPaper !== undefined ? Boolean(input.wetStrengthPaper) : true;
  const align = ['left', 'center', 'right'].includes(input.align as string)
    ? (input.align as TagTextAlign)
    : 'center';

  const preponeWorkshopDueDate = Boolean(input.preponeWorkshopDueDate);
  const rawDays = typeof input.workshopPreponeDays === 'number' ? input.workshopPreponeDays : 1;
  const workshopPreponeDays = Math.min(Math.max(Math.round(rawDays), 0), 14);

  return {
    version: Number(input.version) || 1,
    name: input.name?.trim() || defaultSource.name,
    width,
    height,
    printer,
    wetStrengthPaper,
    align,
    preponeWorkshopDueDate,
    workshopPreponeDays,
    fields,
    containerPaddingMm: clampedPadding,
    borderStyle,
    borderColor: input.borderColor || '#d1d5db',
    lineHeight: 1.15,
    lastUpdatedBy: input.lastUpdatedBy,
    lastUpdatedAt: input.lastUpdatedAt,
    auditHistory: Array.isArray(input.auditHistory) ? input.auditHistory : undefined,
  };
}
