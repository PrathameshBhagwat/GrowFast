/**
 * @growfast/shared-types
 *
 * Shared TypeScript enums, DTOs, and contracts used by both
 * the backend (NestJS) and frontend (React) applications.
 *
 * IMPORTANT: Do NOT duplicate these types in individual apps.
 * Import from '@growfast/shared-types' instead.
 */

// Enums
export {
  Role,
  OrderStatus,
  ItemStatus,
  PaymentStatus,
  PaymentMode,
  PickupType,
  DeliveryStatus,
  PhotoType,
  SyncStatus,
  GarmentCategory,
  ServiceCategory,
  OrderPriority,
  QCStatus,
  MembershipTier,
  RegistrationSource,
  NotificationEventType,
  NotificationChannel,
  NotificationStatus,
} from './enums';

// DTOs
export type {
  LoginRequest,
  LoginResponse,
  EmployeeSummary,
  EmployeeDTO,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  CustomerDTO,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  OrderSummaryDTO,
  OrderDetailDTO,
  OrderItemDTO,
  CreateOrderRequest,
  CreateOrderItemRequest,
  UpdateOrderItemRequest,
  UpdateDueDateRequest,
  PaymentDTO,
  RecordPaymentRequest,
  PaymentSummaryDTO,
  GarmentCatalogDTO,
  UpdateGarmentRequest,
  ServiceTypeDTO,
  OrderPhotoDTO,
  DeliveryRecordDTO,
  CreateDeliveryRequest,
  AssignDriverRequest,
  UpdateDeliveryStatusRequest,
  CompleteDeliveryRequest,
  DashboardSummaryDTO,
  DashboardPeriod,
  DashboardOverview,
  DashboardOrderMetrics,
  DashboardFinancialMetrics,
  DashboardDeliveryMetrics,
  DashboardCustomerMetrics,
  ApiResponse,
  PaginatedResponse,
  ApiError,
  NotificationDTO,
  CreateNotificationRequest,
} from './dto';

// Order Status Contract
export { deriveOrderStatus, ORDER_STATUS_COLORS } from './order-status';
export type { OrderItemStatusInput, OrderStatusDerivationContext } from './order-status';

// Pricing Contract
export { calculateOrderTotals } from './pricing';
export type { PricingItemInput, PricingTotals } from './pricing';
