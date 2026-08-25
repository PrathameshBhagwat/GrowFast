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
} from './enums';

// DTOs
export type {
  LoginRequest,
  LoginResponse,
  EmployeeSummary,
  CustomerDTO,
  CreateCustomerRequest,
  OrderSummaryDTO,
  OrderDetailDTO,
  OrderItemDTO,
  CreateOrderRequest,
  CreateOrderItemRequest,
  PaymentDTO,
  RecordPaymentRequest,
  GarmentCatalogDTO,
  UpdateGarmentRequest,
  ServiceTypeDTO,
  OrderPhotoDTO,
  DeliveryRecordDTO,
  ApiResponse,
  PaginatedResponse,
  ApiError,
} from './dto';

// Order Status Contract
export { deriveOrderStatus, ORDER_STATUS_COLORS } from './order-status';
export type { OrderItemStatusInput } from './order-status';
