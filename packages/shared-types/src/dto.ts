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
  NotificationEventType,
  NotificationChannel,
  NotificationStatus,
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

export interface EmployeeDTO {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: Role;
  storeId: string;
  storeName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeRequest {
  name: string;
  phone?: string;
  email?: string;
  pin: string;
  role: Role;
  storeId?: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  phone?: string | null;
  email?: string | null;
  role?: Role;
  isActive?: boolean;
  pin?: string;
  storeId?: string;
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

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  email?: string | null;
  address?: string | null;
  pincode?: string | null;
  membership?: MembershipTier;
  discountPercent?: number;
  preferences?: Record<string, string> | null;
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
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  paymentStatus: PaymentStatus;
  pickupType: PickupType;
  itemCount: number;
  readyAmount: number;
  remainingAmount: number;
  collectedAmount: number;
  cancelledAmount: number;
  payableAmount: number;
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

export interface UpdateDueDateRequest {
  effectiveDueDate: string;
  reason: string;
}

export interface UpdateOrderItemRequest {
  garmentCatalogId?: string;
  serviceTypeId?: string;
  quantity?: number;
  colorTags?: string[];
  defectNotes?: string | null;
  itemStatus?: ItemStatus;
  deliveredQuantity?: number;
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
  orderNumber: string;
  customerName: string;
  address: string;
  riderId: string | null;
  riderName: string | null;
  status: DeliveryStatus;
  scheduledAt: string | null;
  completedAt: string | null;
  proofPhotoUrl: string | null;
  notes: string | null;
  items?: OrderItemDTO[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeliveryRequest {
  orderId: string;
  address: string;
  scheduledAt?: string;
}

export interface AssignDriverRequest {
  riderId: string;
  scheduledAt?: string;
}

export interface UpdateDeliveryStatusRequest {
  status: DeliveryStatus;
  notes?: string;
}

export interface DeliveredItemRequest {
  itemId: string;
  quantity: number;
}

export interface CompleteDeliveryRequest {
  proofPhotoUrl?: string;
  notes?: string;
  deliveredItems?: DeliveredItemRequest[];
}

// ─── Dashboard DTOs ─────────────────────────────────────────────────

export interface DashboardPeriod {
  startDate: string;
  endDate: string;
}

export interface DashboardOverview {
  totalOrders: number;
  totalItems: number;
  totalCustomers: number;
}

export interface DashboardOrderMetrics {
  received: number;
  sorting: number;
  processing: number;
  drying: number;
  ironing: number;
  qualityCheck: number;
  packed: number;
  ready: number;
  outForDelivery: number;
  delivered: number;
  cancelled: number;
  overdue: number;
  dueToday: number;
}

export interface DashboardFinancialMetrics {
  totalOrderValue: number;
  amountPaid: number;
  amountDue: number;
  paidOrders: number;
  partialOrders: number;
  pendingOrders: number;
}

export interface DashboardDeliveryMetrics {
  scheduled: number;
  assigned: number;
  inTransit: number;
  completed: number;
  failed: number;
}

export interface DashboardCustomerMetrics {
  total: number;
  newInPeriod: number;
}

export interface DashboardSummaryDTO {
  period: DashboardPeriod;
  overview: DashboardOverview;
  orders: DashboardOrderMetrics;
  financial: DashboardFinancialMetrics;
  delivery: DashboardDeliveryMetrics;
  customers: DashboardCustomerMetrics;
}

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

// ─── Notification DTOs ──────────────────────────────────────────────

export interface NotificationDTO {
  id: string;
  storeId: string;
  orderId: string | null;
  customerId: string | null;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipient: string;
  payload: Record<string, unknown> | null;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
}

export interface CreateNotificationRequest {
  orderId?: string;
  customerId?: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  recipient: string;
  payload?: Record<string, unknown>;
}
