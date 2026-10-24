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
  AdjustmentType,
  AdjustmentStatus,
  ExpressDeliveryOption,
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
  PhysicalGarmentDTO,
  CreateOrderRequest,
  CreateOrderItemRequest,
  CreateOrderPieceRequest,
  UpdateOrderItemRequest,
  OrderPickupRequest,
  UpdateDueDateRequest,
  PaymentDTO,
  RecordPaymentRequest,
  PaymentSummaryDTO,
  FinancialAdjustmentDTO,
  CreateAdjustmentRequest,
  CancelGarmentRequest,
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
  DashboardReadyOrder,
  DashboardRecentOrder,
  DashboardActivity,
  MetricComparison,
  DashboardComparisonDTO,
  DashboardTrendPoint,
  DashboardTrendsDTO,
  DashboardServiceBreakdown,
  DashboardCategoryBreakdown,
  DashboardActionOrder,
  DashboardActionQueuesDTO,
  ApiResponse,
  PaginatedResponse,
  ApiError,
  NotificationDTO,
  CreateNotificationRequest,
  DailyOrderReportRowDTO,
  DailyOrdersReportSummaryDTO,
  DailyOrdersReportResponseDTO,
  DailyOrdersReportQueryDTO,
} from './dto';

// Order Status Contract
export { deriveOrderStatus, ORDER_STATUS_COLORS } from './order-status';
export type { OrderItemStatusInput, OrderStatusDerivationContext } from './order-status';

// Photo Rules Contract
export { isPhotoRequiredForOrder } from './photo-rules';
export type { PhotoRequirementContext } from './photo-rules';

// Pricing Contract
export {
  calculateOrderTotals,
  calculateFulfillmentBreakdown,
  getExpressMultiplier,
  roundCurrency,
} from './pricing';
export type { PricingItemInput, PricingTotals, FulfillmentBreakdown } from './pricing';
export {
  filterServicesForCategory,
  filterCategoriesForService,
  formatCatalogServiceName,
  isShoeCategory,
  isHouseholdCategory,
  isOtherCategory,
  isSteamIronService,
  isStarchingService,
  isDryCleanService,
  isWeightBasedCategory,
  STARCHING_ALLOWED_CATEGORIES,
  resolveCatalogSelectionOnCategoryChange,
  resolveServiceOnServiceChange,
  resolveCatalogSelectionOnServiceChange,
  resolveCatalogSelectionOnServiceSelect,
  WORKFLOW_OPTIONS,
  isServiceAllowedInWorkflow,
  isCategoryAllowedInWorkflow,
  isItemCompatibleWithWorkflow,
  resolveCatalogSelectionOnWorkflowChange,
  isEntryModeAllowedInWorkflow,
  GARMENT_COLLECTION_NOTICE,
  STAIN_REMOVAL_NOTICE,
  getDayOfWeekInTimezone,
  adjustDueDateForThursday,
  DEFAULT_TOP_UP_SERVICES,
} from './catalog';
export type {
  OrderWorkflowType,
  OrderEntryMode,
  WorkflowOption,
  TopUpServiceItem,
  CatalogSelectionResult,
} from './catalog';

// Tag Template & Designer Contract (Phase T4 & Owner Design Tags)
export {
  DEFAULT_TAG_DESIGN,
  REFERENCE_TAG_DESIGN,
  sanitizeTagDesign,
  SUPPORTED_TAG_FONTS,
  SUPPORTED_TAG_PRINTERS,
  SUPPORTED_TAG_DIMENSIONS,
} from './tag-template';
export type {
  TagFieldKey,
  TagTextAlign,
  TagFieldConfig,
  TagContainerPadding,
  TagDesignConfig,
  TagTemplateDTO,
  UpdateTagDesignRequest,
  SupportedTagFont,
  TagDesignAuditEntry,
} from './tag-template';
