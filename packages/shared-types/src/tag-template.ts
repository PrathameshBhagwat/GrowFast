/**
 * Tag Template & Visual Layout Contracts (Phase T4 & Owner Design Tags)
 *
 * Defines the presentation customization schema for physical washable cloth tags.
 * Allows store owners to customize visual field order, visibility, alignment, font sizing,
 * styles (bold, italic, underline), dimensions, paper, printer, and workshop prepone due dates
 * while strictly preserving physical geometry and authoritative data.
 */

export type TagFieldKey =
  // ─── Canonical Garment Tag Fields ──────────────────────────────────
  | 'shopName' // Line 1: Shop Name
  | 'orderNumber' // Line 2: Order Number (Primary Anchor)
  | 'customerName' // Line 3: Customer Name
  | 'serviceShortcut' // Line 4/5: Service Shortcut (e.g. DC, SI, SC, ST)
  | 'garmentCategory' // Line 4/5: Garment Category / Item Type (e.g. SHIRT, PANT, JACKET)
  | 'pieceNumber' // Line 4/5: Piece Number position (e.g. 1/5, 1/3)
  | 'dueDate' // Line 5: Delivery due date (e.g. Due: 03 Nov 26)
  | 'garmentSequence' // Legacy combined garment & piece (e.g. Shirt 1/5)
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
  // ─── Legacy Phase T4 Aliases ────────────────────────────────────────
  | 'storeHeader' // Store name / location
  | 'tagId' // Authoritative internal PhysicalGarment.tagId
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
  shopName?: string; // Configured Shop Name, default 'GrowFast'
  serviceShortcuts?: Record<string, string>; // Owner-configured service shortcuts map
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
 * Standard canonical service shortcuts.
 * Owner can configure and customize any shortcut through the admin interface.
 */
export const DEFAULT_SERVICE_SHORTCUTS: Record<string, string> = {
  DRY_CLEAN: 'DC',
  STEAM_PRESS: 'SI',
  SHOE_CLEAN: 'SC',
  WEIGHT_BASED: 'ST',
  WASH_IRON: 'WSI',
  WASH: 'W',
  LEATHER_CLEAN: 'RC',
  STAIN_REMOVAL: 'FS',
  // Human readable service names
  'Dry Clean': 'DC',
  'Dry Cleaning': 'DC',
  'Steam Iron': 'SI',
  'Steam Press': 'SI',
  'Shoe Cleaning': 'SC',
  'Starching': 'ST',
  'Starching Dc': 'ST',
  'Wash and Steam Iron': 'WSI',
  'Wash & Steam Iron': 'WSI',
  'Wash and Fold': 'W+F',
  'Wash & Fold': 'W+F',
  'Standard Wash': 'W',
  'Premium Laundry': 'PL',
  'Woolen Laundry': 'WL',
  'Laundry for White': 'LW',
  'Reprocess Cleaning': 'RC',
  'Free Shoe': 'FS',
};

/**
 * Canonical 7-Field Physical Garment Tag Fields (Section 6 & Acceptance Criteria):
 * 1. Shop Name (shopName)
 * 2. Order Number (orderNumber)
 * 3. Customer Name (customerName)
 * 4. Service Shortcut (serviceShortcut)
 * 5. Garment Category (garmentCategory)
 * 6. Piece Number (pieceNumber)
 * 7. Due Date (dueDate)
 *
 * All 7 fields enabled by default.
 */
export const CANONICAL_7FIELD_TAG_FIELDS: TagFieldConfig[] = [
  {
    field: 'shopName',
    label: 'Shop Name',
    enabled: true,
    fontSize: 10,
    alignment: 'center',
    isBold: true,
    isUppercase: true,
  },
  {
    field: 'orderNumber',
    label: 'Order Number',
    enabled: true,
    fontSize: 13,
    alignment: 'center',
    isBold: true,
    isMono: true,
    isUppercase: true,
  },
  {
    field: 'customerName',
    label: 'Customer Name',
    enabled: true,
    fontSize: 10,
    alignment: 'center',
    isBold: true,
  },
  {
    field: 'serviceShortcut',
    label: 'Service Shortcut',
    enabled: true,
    fontSize: 11,
    alignment: 'center',
    isBold: true,
  },
  {
    field: 'garmentCategory',
    label: 'Garment Category',
    enabled: true,
    fontSize: 11,
    alignment: 'center',
    isBold: true,
    isUppercase: true,
  },
  {
    field: 'pieceNumber',
    label: 'Piece Number',
    enabled: true,
    fontSize: 11,
    alignment: 'center',
    isBold: true,
  },
  {
    field: 'dueDate',
    label: 'Due Date',
    enabled: true,
    fontSize: 9.5,
    alignment: 'center',
    isBold: true,
  },
];

export const CANONICAL_7FIELD_TAG_DESIGN: TagDesignConfig = {
  version: 1,
  name: 'Standard 40×40 mm Physical Garment Tag',
  shopName: 'GrowFast',
  serviceShortcuts: { ...DEFAULT_SERVICE_SHORTCUTS },
  width: '1.5 in',
  height: '1.5 in',
  printer: 'TSC TE244',
  wetStrengthPaper: true,
  align: 'center',
  fields: CANONICAL_7FIELD_TAG_FIELDS,
  containerPaddingMm: { top: 2.0, right: 2.5, bottom: 2.0, left: 2.5 },
  borderStyle: 'dashed',
  borderColor: '#d1d5db',
  lineHeight: 1.15,
};

/**
 * Canonical 5-Line Garment Tag Fields:
 * Line 1: Shop Name
 * Line 2: Order Number
 * Line 3: Customer Name
 * Line 4: Service Shortcut (e.g. DC, SI, SC, ST)
 * Line 5: Garment Type and Piece Sequence (e.g. Shirt 1/5, Pant 1/3)
 */
export const CANONICAL_5LINE_TAG_FIELDS: TagFieldConfig[] = [
  {
    field: 'shopName',
    label: 'Shop Name',
    enabled: true,
    fontSize: 10,
    alignment: 'center',
    isBold: true,
    isUppercase: true,
  },
  {
    field: 'orderNumber',
    label: 'Order Number',
    enabled: true,
    fontSize: 14,
    alignment: 'center',
    isBold: true,
    isMono: true,
    isUppercase: true,
  },
  {
    field: 'customerName',
    label: 'Customer Name',
    enabled: true,
    fontSize: 10,
    alignment: 'center',
    isBold: true,
  },
  {
    field: 'serviceShortcut',
    label: 'Service Shortcut',
    enabled: true,
    fontSize: 12,
    alignment: 'center',
    isBold: true,
  },
  {
    field: 'garmentSequence',
    label: 'Garment Type & Piece Sequence',
    enabled: true,
    fontSize: 11,
    alignment: 'center',
    isBold: true,
  },
];

export const CANONICAL_5LINE_TAG_DESIGN: TagDesignConfig = {
  version: 1,
  name: 'Canonical 5-Line Garment Tag',
  shopName: 'GrowFast',
  serviceShortcuts: { ...DEFAULT_SERVICE_SHORTCUTS },
  width: '1.5 in',
  height: '1.5 in',
  printer: 'TSC TE244',
  wetStrengthPaper: true,
  align: 'center',
  fields: CANONICAL_5LINE_TAG_FIELDS,
  containerPaddingMm: { top: 2.0, right: 2.5, bottom: 2.0, left: 2.5 },
  borderStyle: 'dashed',
  borderColor: '#d1d5db',
  lineHeight: 1.15,
};

/**
 * Resolves a short, readable service code for garment tags with fallback logic.
 */
export function resolveServiceShortcut(
  serviceIdentifier?: string | null,
  customShortcuts?: Record<string, string> | null,
): string {
  if (!serviceIdentifier || typeof serviceIdentifier !== 'string') {
    return 'GEN';
  }

  const raw = serviceIdentifier.trim();
  if (!raw) return 'GEN';

  // 1. Check custom shortcuts if provided
  if (customShortcuts && typeof customShortcuts === 'object') {
    if (customShortcuts[raw]) {
      return customShortcuts[raw].trim().toUpperCase();
    }
    const upperRaw = raw.toUpperCase().replace(/\s+/g, '_');
    for (const [key, val] of Object.entries(customShortcuts)) {
      if (
        key === raw ||
        key.toUpperCase() === raw.toUpperCase() ||
        key.toUpperCase().replace(/\s+/g, '_') === upperRaw
      ) {
        if (val && typeof val === 'string' && val.trim()) {
          return val.trim().toUpperCase();
        }
      }
    }
  }

  // 2. Check built-in standard shortcuts
  if (DEFAULT_SERVICE_SHORTCUTS[raw]) {
    return DEFAULT_SERVICE_SHORTCUTS[raw];
  }
  const normKey = raw.toUpperCase().replace(/\s+/g, '_');
  if (DEFAULT_SERVICE_SHORTCUTS[normKey]) {
    return DEFAULT_SERVICE_SHORTCUTS[normKey];
  }

  // 3. Fallback based on name contents
  if (
    normKey.includes('WASH') &&
    (normKey.includes('IRON') || normKey.includes('STEAM') || normKey.includes('PRESS'))
  ) {
    return 'WSI';
  }
  if (normKey.includes('WASH') && normKey.includes('FOLD')) return 'W+F';
  if (normKey.includes('DRY_CLEAN')) return 'DC';
  if (normKey.includes('STARCH')) return 'ST';
  if (normKey.includes('STEAM') || normKey.includes('IRON') || normKey.includes('PRESS')) return 'SI';
  if (normKey.includes('SHOE')) return 'SC';
  if (normKey.includes('PREMIUM')) return 'PL';
  if (normKey.includes('WOOL')) return 'WL';
  if (normKey.includes('WHITE')) return 'LW';
  if (normKey.includes('LEATHER') || normKey.includes('REPROCESS')) return 'RC';
  if (normKey.includes('STAIN') || normKey.includes('FREE_SHOE')) return 'FS';
  if (normKey.includes('WASH') || normKey.includes('LAUNDRY')) return 'W';

  // 4. Generate abbreviation from initials or first characters
  const words = raw.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const initials = words.map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (initials.length >= 2) return initials.slice(0, 4);
  }

  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.slice(0, 3) || 'GEN';
}

/**
 * Formats garment type and piece position: e.g. "Shirt 1/5", "Pant 1/3"
 */
export function formatGarmentSequence(
  garmentName?: string | null,
  unitNumber?: number | null,
  totalPieces?: number | null,
): string {
  let name = (garmentName || 'Garment').trim();
  if (name.toLowerCase() === 'pants') {
    name = 'Pant';
  } else if (name.toLowerCase() === 'shirts') {
    name = 'Shirt';
  }
  const unit = typeof unitNumber === 'number' && unitNumber > 0 ? unitNumber : 1;
  const total = typeof totalPieces === 'number' && totalPieces > 0 ? totalPieces : 1;
  return `${name} ${unit}/${total}`;
}

/**
 * Formats shop name displayed at the top of the tag: e.g. "GrowFast"
 * Does not add branch name, location, address, or phone number.
 */
export function formatShopName(
  configuredShopName?: string | null,
  storeName?: string | null,
): string {
  if (configuredShopName && typeof configuredShopName === 'string' && configuredShopName.trim()) {
    return configuredShopName.trim();
  }
  if (storeName && typeof storeName === 'string' && storeName.trim()) {
    const parts = storeName.split('/');
    const cleaned = (parts[0] || '').trim();
    if (cleaned.toLowerCase().includes('branch') && !cleaned.toLowerCase().includes('growfast')) {
      return 'GrowFast';
    }
    const stripped = cleaned.replace(/\s+Branch$/i, '').trim();
    return stripped || 'GrowFast';
  }
  return 'GrowFast';
}

/**
 * Department/demographic categories that represent broad sections rather than specific garment item types.
 */
export const DEPARTMENT_CATEGORY_ENUMS = new Set([
  'MEN',
  'WOMEN',
  'KIDS',
  'HOUSEHOLD',
  'SPECIAL',
  'WEIGHT_BASED',
  'OTHERS',
  'HOME_CLEANING',
]);

/**
 * Common plural mappings to canonical singular uppercase garment category/item names.
 */
export const GARMENT_PLURAL_MAP: Record<string, string> = {
  SHIRTS: 'SHIRT',
  PANTS: 'PANT',
  TROUSERS: 'TROUSER',
  'T-SHIRTS': 'T-SHIRT',
  'T SHIRTS': 'T-SHIRT',
  JACKETS: 'JACKET',
  SUITS: 'SUIT',
  SAREES: 'SAREE',
  DRESSES: 'DRESS',
  'BED SHEETS': 'BED SHEET',
  BEDSHEETS: 'BED SHEET',
  CURTAINS: 'CURTAIN',
  BAGS: 'BAG',
  COATS: 'COAT',
  KURTAS: 'KURTA',
  SWEATERS: 'SWEATER',
  BLAZERS: 'BLAZER',
  BLOUSES: 'BLOUSE',
  JEANS: 'JEANS',
  SHORTS: 'SHORTS',
};

/**
 * Resolves the canonical uppercase garment category or item type for garment tags.
 * Strips broad demographic categories (e.g. MEN, WOMEN) in favor of specific item names.
 * Normalizes plurals (e.g. Shirts -> SHIRT, Pants -> PANT).
 * Falls back to 'GARMENT' if neither category nor item name is provided.
 */
export function resolveGarmentCategory(
  garmentCategory?: string | null,
  garmentName?: string | null,
): string {
  let candidate = (garmentCategory || '').trim();
  if (candidate && !DEPARTMENT_CATEGORY_ENUMS.has(candidate.toUpperCase())) {
    // Already a specific category
  } else {
    // Fall back to garmentName
    candidate = (garmentName || '').trim();
  }

  if (!candidate) {
    return 'GARMENT';
  }

  // Remove trailing parentheses notes (e.g. "Bedsheet (Single)" -> "Bedsheet")
  candidate = candidate.replace(/\s*\([^)]*\)/g, '').trim();

  const upper = candidate.toUpperCase().replace(/\s+/g, ' ');

  // Direct plural lookup
  if (GARMENT_PLURAL_MAP[upper]) {
    return GARMENT_PLURAL_MAP[upper];
  }

  // Handle common variants
  if (upper === 'T SHIRT') return 'T-SHIRT';
  if (upper === 'BEDSHEET') return 'BED SHEET';

  // Suffix plural removal (e.g. "SILK SAREES" -> "SILK SAREE")
  for (const [plural, singular] of Object.entries(GARMENT_PLURAL_MAP)) {
    if (upper.endsWith(' ' + plural)) {
      return upper.slice(0, -(plural.length)) + singular;
    }
  }

  return upper || 'GARMENT';
}

/**
 * Formats individual piece number with group denominator: e.g. "1/5", "3/3", "1/1"
 */
export function formatPieceNumber(
  unitNumber?: number | null,
  totalPieces?: number | null,
): string {
  const unit = typeof unitNumber === 'number' && unitNumber > 0 ? unitNumber : 1;
  const total = typeof totalPieces === 'number' && totalPieces > 0 ? totalPieces : 1;
  return `${unit}/${total}`;
}

/**
 * Formats the combined operational tag line: e.g. "DC | SHIRT | 1/5", "DC | PANT | 1/3", "SI | JACKET | 1/2"
 * Omits disabled/empty elements gracefully.
 */
export function formatGarmentTagLine(options: {
  serviceShortcut?: string | null;
  garmentCategory?: string | null;
  pieceNumber?: string | null;
}): string {
  const parts: string[] = [];
  if (options.serviceShortcut && options.serviceShortcut.trim()) {
    parts.push(options.serviceShortcut.trim());
  }
  if (options.garmentCategory && options.garmentCategory.trim()) {
    parts.push(options.garmentCategory.trim());
  }
  if (options.pieceNumber && options.pieceNumber.trim()) {
    parts.push(options.pieceNumber.trim());
  }
  return parts.join(' | ');
}

/**
 * Formats due date for physical tag: e.g. "03 Nov 26"
 */
export function formatTagDueDate(dateInput?: string | Date): string {
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
  return `${day} ${month} ${year}`;
}

/**
 * Approved canonical reference default tag design from user UI specification.
 */
export const REFERENCE_TAG_DESIGN: TagDesignConfig = {
  version: 1,
  name: 'Standard 1.5×1.5 in Tag (TSC TE244)',
  shopName: 'GrowFast',
  serviceShortcuts: { ...DEFAULT_SERVICE_SHORTCUTS },
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
  shopName: 'GrowFast',
  serviceShortcuts: { ...DEFAULT_SERVICE_SHORTCUTS },
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

  const canonical7Keys: TagFieldKey[] = [
    'shopName',
    'orderNumber',
    'customerName',
    'serviceShortcut',
    'garmentCategory',
    'pieceNumber',
    'dueDate',
  ];

  const canonical5Keys: TagFieldKey[] = [
    'shopName',
    'serviceShortcut',
    'garmentSequence',
  ];

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

  const validKeys: TagFieldKey[] = [
    ...canonical7Keys,
    ...canonical5Keys,
    ...referenceKeys,
    ...legacyKeys,
  ];

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
            f.field === 'bookingNo' ||
            f.field === 'shopName' ||
            f.field === 'garmentCategory'),
        label:
          f.label ||
          (f.field === 'orderNumber'
            ? 'Order Number'
            : f.field === 'bookingNo'
              ? 'Booking No.'
              : f.field === 'shopName'
                ? 'Shop Name'
                : f.field === 'customerName' || f.field === 'customer'
                  ? 'Customer Name'
                  : f.field === 'serviceShortcut'
                    ? 'Service Shortcut'
                    : f.field === 'garmentCategory'
                      ? 'Garment Category'
                      : f.field === 'pieceNumber'
                        ? 'Piece Number'
                        : f.field === 'dueDate'
                          ? 'Due Date'
                          : f.field === 'garmentSequence'
                            ? 'Garment Type & Piece Sequence'
                            : f.field),
      };
    });

  // Ensure all keys of the matching set exist
  const isCanonicalSet = fields.some(
    (f) => f.field === 'garmentCategory' || f.field === 'pieceNumber' || f.field === 'shopName',
  );
  const isReferenceSet = !isCanonicalSet && fields.some((f) => referenceKeys.includes(f.field));
  const expectedKeys = isCanonicalSet
    ? canonical7Keys
    : isReferenceSet
      ? referenceKeys
      : legacyKeys;
  const defaultSource = isCanonicalSet
    ? CANONICAL_7FIELD_TAG_DESIGN
    : isReferenceSet
      ? REFERENCE_TAG_DESIGN
      : DEFAULT_TAG_DESIGN;

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

  // Sanitize shopName (Owner configuration)
  const shopName =
    typeof input.shopName === 'string' && input.shopName.trim()
      ? input.shopName.trim().slice(0, 50)
      : input.shopName === undefined
        ? (defaultSource.shopName || 'GrowFast')
        : 'GrowFast';

  // Sanitize serviceShortcuts (Owner configuration)
  const serviceShortcuts: Record<string, string> = {
    ...DEFAULT_SERVICE_SHORTCUTS,
  };
  if (input.serviceShortcuts && typeof input.serviceShortcuts === 'object') {
    for (const [key, val] of Object.entries(input.serviceShortcuts)) {
      if (typeof key === 'string' && typeof val === 'string') {
        const cleanKey = key.trim();
        const cleanVal = val.trim().toUpperCase().slice(0, 6);
        if (cleanKey && cleanVal) {
          serviceShortcuts[cleanKey] = cleanVal;
        }
      }
    }
  }

  return {
    version: Number(input.version) || 1,
    name: input.name?.trim() || defaultSource.name,
    shopName,
    serviceShortcuts,
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
