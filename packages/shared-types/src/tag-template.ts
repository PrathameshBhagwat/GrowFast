/**
 * Tag Template & Visual Layout Contracts (Phase T4: Admin Tag Designer)
 *
 * Defines the presentation customization schema for the 40×40 mm physical washable cloth tag.
 * Allows store owners to customize visual field order, visibility, alignment, font sizing,
 * and borders while strictly preserving the 40×40 mm physical geometry and authoritative data.
 */

export type TagFieldKey =
  | 'storeHeader' // Store name / location
  | 'orderNumber' // Short human-readable Order Business ID (e.g. ORD-001284) - primary anchor
  | 'tagId' // Authoritative internal PhysicalGarment.tagId
  | 'customerName' // Customer name
  | 'serviceAndPiece' // Service abbreviation + Piece position (e.g. DC 1/5)
  | 'date' // Date + weekday (e.g. 08 Oct 26 Thu)
  | 'garmentName'; // Garment description

export type TagTextAlign = 'left' | 'center' | 'right';

export interface TagFieldConfig {
  field: TagFieldKey;
  enabled: boolean;
  fontSize: number; // in px (safe bounds enforced: 6px to 18px)
  alignment: TagTextAlign;
  isBold?: boolean;
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

export interface TagDesignConfig {
  id?: string;
  storeId?: string;
  version: number;
  name: string;
  fields: TagFieldConfig[]; // Array order directly determines vertical rendering sequence
  containerPaddingMm: TagContainerPadding;
  borderStyle: 'dashed' | 'solid' | 'none';
  borderColor?: string;
  lineHeight?: number;
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

/**
 * Approved canonical default tag design baseline.
 * Primary anchor displays the Short Order Business ID (e.g. ORD-001284) alongside piece position (e.g. 1/5).
 */
export const DEFAULT_TAG_DESIGN: TagDesignConfig = {
  version: 1,
  name: 'Standard 40×40 mm Washable Cloth Tag',
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
 * Validates and clamps a TagDesignConfig to safe 40×40 mm boundaries.
 * Prevents negative positioning, extreme fonts, or invalid field keys.
 */
export function sanitizeTagDesign(input?: Partial<TagDesignConfig>): TagDesignConfig {
  if (!input || !Array.isArray(input.fields)) {
    return { ...DEFAULT_TAG_DESIGN };
  }

  const validKeys: TagFieldKey[] = [
    'storeHeader',
    'orderNumber',
    'tagId',
    'customerName',
    'serviceAndPiece',
    'date',
    'garmentName',
  ];

  // Map known fields with safe clamped values
  const fields: TagFieldConfig[] = input.fields
    .filter((f) => validKeys.includes(f.field))
    .map((f) => {
      // Clamped font sizes: 6px to 18px
      const rawFontSize = typeof f.fontSize === 'number' && !isNaN(f.fontSize) ? f.fontSize : 8;
      const clampedFontSize = Math.min(Math.max(rawFontSize, 6), 18);
      const alignment: TagTextAlign = ['left', 'center', 'right'].includes(f.alignment)
        ? f.alignment
        : 'left';

      return {
        field: f.field,
        enabled: f.field === 'orderNumber' ? true : Boolean(f.enabled), // Order Number is mandatory primary anchor
        fontSize: clampedFontSize,
        alignment,
        isBold: f.isBold ?? true,
        isMono: f.field === 'orderNumber' || f.field === 'tagId',
        isUppercase:
          f.isUppercase ??
          (f.field === 'storeHeader' || f.field === 'garmentName' || f.field === 'orderNumber'),
        label: f.label || (f.field === 'orderNumber' ? 'Order Number (Primary Anchor)' : f.field),
      };
    });

  // Ensure all valid keys exist in fields array
  for (const key of validKeys) {
    if (!fields.some((f) => f.field === key)) {
      const defaultField = DEFAULT_TAG_DESIGN.fields.find((df) => df.field === key);
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

  return {
    version: Number(input.version) || 1,
    name: input.name?.trim() || DEFAULT_TAG_DESIGN.name,
    fields,
    containerPaddingMm: clampedPadding,
    borderStyle,
    borderColor: input.borderColor || '#d1d5db',
    lineHeight: 1.15,
  };
}
