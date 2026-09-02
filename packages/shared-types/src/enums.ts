/**
 * Shared enums for the Laundry Management System.
 * Used by both backend and frontend — do NOT duplicate these.
 */

// ─── Employee & Auth ───────────────────────────────────────────────

export enum Role {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  COUNTER = 'COUNTER',
  DELIVERY = 'DELIVERY',
}

// ─── Order Lifecycle ────────────────────────────────────────────────

export enum OrderStatus {
  RECEIVED = 'RECEIVED',
  SORTING = 'SORTING',
  PROCESSING = 'PROCESSING',
  DRYING = 'DRYING',
  IRONING = 'IRONING',
  QUALITY_CHECK = 'QUALITY_CHECK',
  PACKED = 'PACKED',
  READY = 'READY',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum ItemStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  QUALITY_CHECK = 'QUALITY_CHECK',
  READY = 'READY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// ─── Payment ────────────────────────────────────────────────────────

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  ONLINE = 'ONLINE',
  STORE_CREDIT = 'STORE_CREDIT',
}

// ─── Pickup & Delivery ─────────────────────────────────────────────

export enum PickupType {
  STORE_PICKUP = 'STORE_PICKUP',
  HOME_DELIVERY = 'HOME_DELIVERY',
}

export enum DeliveryStatus {
  SCHEDULED = 'SCHEDULED',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ─── Photos ─────────────────────────────────────────────────────────

export enum PhotoType {
  FRONT = 'FRONT',
  BACK = 'BACK',
  DAMAGE = 'DAMAGE',
  STAIN = 'STAIN',
  TAG = 'TAG',
  DELIVERY_PROOF = 'DELIVERY_PROOF',
}

// ─── Sync (for future offline support) ─────────────────────────────

export enum SyncStatus {
  SYNCED = 'SYNCED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

// ─── Garment & Service ─────────────────────────────────────────────

export enum GarmentCategory {
  MEN = 'MEN',
  WOMEN = 'WOMEN',
  KIDS = 'KIDS',
  HOUSEHOLD = 'HOUSEHOLD',
  SHOES = 'SHOES',
  SPECIAL = 'SPECIAL',
  WEIGHT_BASED = 'WEIGHT_BASED',
  OTHERS = 'OTHERS',
  HOME_CLEANING = 'HOME_CLEANING',
}

export enum ServiceCategory {
  DRY_CLEAN = 'DRY_CLEAN',
  STEAM_PRESS = 'STEAM_PRESS',
  WASH = 'WASH',
  WASH_IRON = 'WASH_IRON',
  SHOE_CLEAN = 'SHOE_CLEAN',
  LEATHER_CLEAN = 'LEATHER_CLEAN',
  STAIN_REMOVAL = 'STAIN_REMOVAL',
  WEIGHT_BASED = 'WEIGHT_BASED',
}

// ─── Order Priority ─────────────────────────────────────────────────

export enum OrderPriority {
  STANDARD = 'STANDARD',
  EXPRESS = 'EXPRESS',
  VIP = 'VIP',
}

// ─── QC Status ──────────────────────────────────────────────────────

export enum QCStatus {
  PENDING = 'PENDING',
  PASSED = 'PASSED',
  REWORK = 'REWORK',
  ISSUE = 'ISSUE',
}

// ─── Customer Membership ────────────────────────────────────────────

export enum MembershipTier {
  NONE = 'NONE',
  SILVER = 'SILVER',
  GOLD = 'GOLD',
  PLATINUM = 'PLATINUM',
}

// ─── Registration Source ────────────────────────────────────────────

export enum RegistrationSource {
  WALK_IN = 'WALK_IN',
  PHONE = 'PHONE',
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  APP = 'APP',
}
