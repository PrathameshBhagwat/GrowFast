/**
 * API DTO contracts — shared between backend and frontend.
 * Backend uses these as response shapes; frontend uses them for type-safe API calls.
 */

import {
  Role,
  OrderStatus,
  PaymentStatus,
  PaymentMode,
  PickupType,
  OrderPriority,
  GarmentCategory,
  ServiceCategory,
  ItemStatus,
  PhotoType,
  MembershipTier,
  DeliveryStatus,
} from './enums';

// ─── Auth DTOs ──────────────────────────────────────────────────────

export interface LoginRequest {
  employeeId: string;
  pin: string;
}

export interface LoginResponse {
  accessToken: string;
  employee: EmployeeSummary;
}

export interface EmployeeSummary {
  id: string;
  name: string;
  role: Role;
  storeId: string;
  storeName: string;
}

// ─── Customer DTOs ──────────────────────────────────────────────────

export interface CustomerDTO {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  pincode: string | null;
  membership: MembershipTier;
  discountPercent: number;
  preferences: Record<string, string> | null;
  registrationSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  pincode?: string;
  membership?: MembershipTier;
  discountPercent?: number;
  preferences?: Record<string, string>;
  registrationSource?: string;
}

// ─── Order DTOs ─────────────────────────────────────────────────────

export interface OrderSummaryDTO {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  orderDate: string;
  effectiveDueDate: string;
  isExpress: boolean;
  priority: OrderPriority;
  status: OrderStatus;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: PaymentStatus;
  pickupType: PickupType;
  itemCount: number;
}

export interface OrderDetailDTO extends OrderSummaryDTO {
  systemDueDate: string;
  dueDateOverrideReason: string | null;
  dueDateOverriddenBy: string | null;
  serviceSummary: string | null;
  storeId: string;
  createdById: string;
  createdByName: string;
  items: OrderItemDTO[];
  payments: PaymentDTO[];
}

export interface OrderItemDTO {
  id: string;
  garmentName: string;
  garmentCategory: GarmentCategory;
  serviceType: ServiceCategory;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  colorTags: string[] | null;
  defectNotes: string | null;
  itemStatus: ItemStatus;
  deliveredQuantity: number;
  itemDueDate: string | null;
}

export interface CreateOrderRequest {
  customerId: string;
  isExpress: boolean;
  pickupType: PickupType;
  items: CreateOrderItemRequest[];
  notes?: string;
}

export interface CreateOrderItemRequest {
  garmentCatalogId: string;
  serviceTypeId: string;
  quantity: number;
  colorTags?: string[];
  defectNotes?: string;
}

// ─── Payment DTOs ───────────────────────────────────────────────────

export interface PaymentDTO {
  id: string;
  orderId: string;
  amount: number;
  mode: PaymentMode;
  reference: string | null;
  receivedById: string;
  receivedByName: string;
  createdAt: string;
}

export interface RecordPaymentRequest {
  orderId: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
}

export interface PaymentSummaryDTO {
  orderId: string;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: PaymentStatus;
  paymentCount: number;
  isConsistent: boolean;
}

// ─── Catalog DTOs ───────────────────────────────────────────────────

export interface GarmentCatalogDTO {
  id: string;
  name: string;
  category: GarmentCategory;
  isActive: boolean;
}

export interface UpdateGarmentRequest {
  name?: string;
  category?: GarmentCategory;
  isActive?: boolean;
}

export interface ServiceTypeDTO {
  id: string;
  name: string;
  category: ServiceCategory;
  estimatedDays: number;
  isActive: boolean;
}

// ─── Photo DTOs ─────────────────────────────────────────────────────

export interface OrderPhotoDTO {
  id: string;
  orderItemId: string;
  type: PhotoType;
  url: string;
  uploadedAt: string;
}

// ─── Delivery DTOs ──────────────────────────────────────────────────

export interface DeliveryRecordDTO {
  id: string;
  orderId: string;
  address: string;
  riderId: string | null;
  riderName: string | null;
  status: DeliveryStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  proofPhotoUrl: string | null;
  notes: string | null;
}

// ─── API Response Wrappers ──────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  success: false;
  message: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}
