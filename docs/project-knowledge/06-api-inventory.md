# 06 — API Inventory & REST Contract Specification

## 1. Overview & Global API Architecture

- **Base URL**: `http://<host>:3000/api` (Configured with global prefix `'api'` in `main.ts`).
- **Transport**: REST over HTTP/1.1; JSON request/response payloads; `multipart/form-data` for file uploads.
- **Authentication**: Bearer JWT passed via `Authorization: Bearer <token>` header.
- **Tenant Context**: Inferred from verified JWT `req.user.storeId` or explicit `X-Store-Id` header.
- **Global Validation**: NestJS `ValidationPipe` with `{ whitelist: true, transform: true }`.
- **Response Format**: Standardized envelope:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
  On failure:
  ```json
  {
    "statusCode": 400,
    "message": ["validation error messages"],
    "error": "Bad Request"
  }
  ```

---

## 2. API Endpoints by Domain Module

### 2.1 Authentication & Staff Directory (`/api/auth`)

Controller: `apps/backend/src/auth/auth.controller.ts`

| Method | Route              | Description                           | Auth Required | Roles              | Request DTO / Body               | Response Contract                                        | Idempotency | Error Codes   |
| :----- | :----------------- | :------------------------------------ | :------------ | :----------------- | :------------------------------- | :------------------------------------------------------- | :---------- | :------------ |
| `POST` | `/auth/login`      | Authenticate employee with PIN        | No            | Public             | `LoginDto` (`employeeId`, `pin`) | `{ accessToken, employee: { id, name, role, storeId } }` | No          | 400, 401, 429 |
| `GET`  | `/auth/me`         | Fetch active employee session         | Yes           | All roles          | None                             | `{ success: true, data: EmployeeProfile }`               | No          | 401           |
| `GET`  | `/auth/directory`  | Directory of staff for login selector | No            | Public             | Query: `?roles=OWNER,COUNTER`    | `{ success: true, data: EmployeeSummary[] }`             | No          | 500           |
| `GET`  | `/auth/admin-test` | Security test gate                    | Yes           | `OWNER`, `MANAGER` | None                             | `{ success: true, message: string }`                     | No          | 401, 403      |

### 2.2 Employee Management (`/api/employees`)

Controller: `apps/backend/src/employee/employee.controller.ts`

| Method   | Route            | Description                       | Auth Required | Roles              | Request DTO / Body                                   | Response Contract                     | Idempotency | Error Codes |
| :------- | :--------------- | :-------------------------------- | :------------ | :----------------- | :--------------------------------------------------- | :------------------------------------ | :---------- | :---------- |
| `GET`    | `/employees`     | List employees in current store   | Yes           | `OWNER`, `MANAGER` | Query: `?role=COUNTER`                               | `{ success: true, data: Employee[] }` | No          | 401, 403    |
| `GET`    | `/employees/:id` | Fetch employee by ID              | Yes           | `OWNER`, `MANAGER` | URL Param: `id`                                      | `{ success: true, data: Employee }`   | No          | 401, 404    |
| `POST`   | `/employees`     | Register new employee             | Yes           | `OWNER`            | `CreateEmployeeDto` (`name`, `pin`, `role`, `phone`) | `{ success: true, data: Employee }`   | No          | 400, 403    |
| `PATCH`  | `/employees/:id` | Update employee profile or PIN    | Yes           | `OWNER`            | `UpdateEmployeeDto`                                  | `{ success: true, data: Employee }`   | No          | 400, 404    |
| `DELETE` | `/employees/:id` | Soft-delete / deactivate employee | Yes           | `OWNER`            | URL Param: `id`                                      | `{ success: true }`                   | No          | 404         |

### 2.3 Customer Management (`/api/customers`)

Controller: `apps/backend/src/customer/customer.controller.ts`

| Method  | Route                   | Description                        | Auth Required | Roles     | Request DTO / Body                                            | Response Contract                     | Idempotency       | Error Codes |
| :------ | :---------------------- | :--------------------------------- | :------------ | :-------- | :------------------------------------------------------------ | :------------------------------------ | :---------------- | :---------- |
| `POST`  | `/customers`            | Create new customer                | Yes           | All roles | `CreateCustomerDto` (`name`, `phone`, `email`, `preferences`) | `{ success: true, data: Customer }`   | No (phone unique) | 400, 409    |
| `GET`   | `/customers/search`     | Fast customer search               | Yes           | All roles | Query: `?q=9876543210` (phone or name)                        | `{ success: true, data: Customer[] }` | No                | 401         |
| `GET`   | `/customers/:id`        | Fetch customer profile             | Yes           | All roles | URL Param: `id`                                               | `{ success: true, data: Customer }`   | No                | 404         |
| `PATCH` | `/customers/:id`        | Update preferences, phone, address | Yes           | All roles | `UpdateCustomerDto`                                           | `{ success: true, data: Customer }`   | No                | 400, 404    |
| `GET`   | `/customers/:id/orders` | Customer order ledger history      | Yes           | All roles | URL Param: `id`                                               | `{ success: true, data: Order[] }`    | No                | 404         |

### 2.4 Catalog, Services & Pricing (`/api/garments`, `/api/services`, `/api/pricing`)

Controllers: `catalog.controller.ts`, `services.controller.ts`, `pricing.controller.ts`

| Method  | Route                            | Description                     | Auth Required | Roles                         | Request DTO / Body      | Response Contract                                | Idempotency | Error Codes |
| :------ | :------------------------------- | :------------------------------ | :------------ | :---------------------------- | :---------------------- | :----------------------------------------------- | :---------- | :---------- |
| `GET`   | `/garments`                      | List garment catalog            | Yes           | All roles                     | Query: `?category=MEN`  | `{ success: true, data: GarmentCatalog[] }`      | No          | 401         |
| `POST`  | `/garments`                      | Create new garment catalog item | Yes           | `OWNER`, `MANAGER`, `COUNTER` | `CreateGarmentDto`      | `{ success: true, data: GarmentCatalog }`        | No          | 400         |
| `PATCH` | `/garments/:id`                  | Update garment item or section  | Yes           | `OWNER`, `MANAGER`, `COUNTER` | `UpdateGarmentDto`      | `{ success: true, data: GarmentCatalog }`        | No          | 404         |
| `GET`   | `/services`                      | List all service types          | Yes           | All roles                     | None                    | `{ success: true, data: ServiceType[] }`         | No          | 401         |
| `PATCH` | `/services/:id`                  | Update service SLA turnaround   | Yes           | `OWNER`, `MANAGER`            | `UpdateServiceTypeDto`  | `{ success: true, data: ServiceType }`           | No          | 404         |
| `GET`   | `/pricing`                       | Matrix pricing list             | Yes           | All roles                     | None                    | `{ success: true, data: ServiceGarmentPrice[] }` | No          | 401         |
| `POST`  | `/pricing/:garmentId/:serviceId` | Set base price for combo        | Yes           | `OWNER`, `MANAGER`            | `SetPriceDto` (`price`) | `{ success: true, data: ServiceGarmentPrice }`   | Upsert      | 400         |

### 2.5 Order Management & Tracking (`/api/orders`)

Controller: `apps/backend/src/order/order.controller.ts`

| Method  | Route                                                       | Description                                | Auth Required | Roles              | Request DTO / Body                                                                   | Response Contract                           | Idempotency               | Error Codes |
| :------ | :---------------------------------------------------------- | :----------------------------------------- | :------------ | :----------------- | :----------------------------------------------------------------------------------- | :------------------------------------------ | :------------------------ | :---------- |
| `POST`  | `/orders`                                                   | Create order with items & tags             | Yes           | All roles          | `CreateOrderDto` (`customerId`, `items`, `clientDraftId`, `isExpress`, `pickupType`) | `{ success: true, data: Order }`            | **Yes (`clientDraftId`)** | 400, 404    |
| `GET`   | `/orders`                                                   | Filtered list of store orders              | Yes           | All roles          | Query: `?status=RECEIVED&limit=50`                                                   | `{ success: true, data: Order[] }`          | No                        | 401         |
| `GET`   | `/orders/due-today`                                         | Fetch orders SLA-due today                 | Yes           | All roles          | None                                                                                 | `{ success: true, data: Order[] }`          | No                        | 401         |
| `GET`   | `/orders/by-draft/:draftId`                                 | Lookup order by mobile draft UUID          | Yes           | All roles          | URL Param: `draftId`                                                                 | `{ success: true, data: Order }`            | No                        | 404         |
| `GET`   | `/orders/:id`                                               | Full order detail with items, tags, photos | Yes           | All roles          | URL Param: `id`                                                                      | `{ success: true, data: OrderWithDetails }` | No                        | 404         |
| `PATCH` | `/orders/:orderId/items/:itemId`                            | Update line item status                    | Yes           | All roles          | `{ itemStatus: ItemStatus }`                                                         | `{ success: true, data: OrderItem }`        | No                        | 404         |
| `PATCH` | `/orders/:orderId/items/:itemId/garments/:garmentId/ready`  | Mark unit ready                            | Yes           | All roles          | None                                                                                 | `{ success: true, data: PhysicalGarment }`  | No                        | 404         |
| `POST`  | `/orders/:orderId/items/:itemId/garments`                   | Add physical garment unit                  | Yes           | All roles          | `{ unitNumber: number }`                                                             | `{ success: true, data: PhysicalGarment }`  | No                        | 400         |
| `PATCH` | `/orders/:orderId/items/:itemId/garments/:garmentId/cancel` | Cancel garment unit                        | Yes           | All roles          | None                                                                                 | `{ success: true, data: PhysicalGarment }`  | No                        | 404         |
| `PATCH` | `/orders/:id/due-date`                                      | Override order SLA due date                | Yes           | `OWNER`, `MANAGER` | `UpdateDueDateDto` (`dueDate`, `reason`)                                             | `{ success: true, data: Order }`            | No                        | 400         |
| `POST`  | `/orders/:id/notify-partial-ready`                          | Send WhatsApp partial ready ping           | Yes           | All roles          | None                                                                                 | `{ success: true }`                         | No                        | 404         |
| `POST`  | `/orders/:orderId/pickup`                                   | Deliver garments at store counter          | Yes           | All roles          | `PickupDto` (`garmentIds`, `amountPaid`)                                             | `{ success: true, data: Order }`            | No                        | 400         |

### 2.6 Payments & Financial Ledger (`/api/payments`)

Controller: `apps/backend/src/payment/payment.controller.ts`

| Method | Route                   | Description                 | Auth Required | Roles              | Request DTO / Body                                                 | Response Contract                                | Idempotency                | Error Codes |
| :----- | :---------------------- | :-------------------------- | :------------ | :----------------- | :----------------------------------------------------------------- | :----------------------------------------------- | :------------------------- | :---------- |
| `POST` | `/payments`             | Record order payment        | Yes           | All roles          | `CreatePaymentDto` (`orderId`, `amount`, `mode`, `idempotencyKey`) | `{ success: true, data: Payment }`               | **Yes (`idempotencyKey`)** | 400, 404    |
| `GET`  | `/payments`             | List payments for order     | Yes           | All roles          | Query: `?orderId=...`                                              | `{ success: true, data: Payment[] }`             | No                         | 401         |
| `GET`  | `/payments/summary`     | Today's tender mode summary | Yes           | `OWNER`, `MANAGER` | None                                                               | `{ success: true, data: PaymentSummary }`        | No                         | 401         |
| `POST` | `/payments/adjustments` | Issue credit note or refund | Yes           | `OWNER`, `MANAGER` | `CreateAdjustmentDto` (`orderId`, `type`, `amount`, `reason`)      | `{ success: true, data: FinancialAdjustment }`   | No                         | 400         |
| `GET`  | `/payments/adjustments` | List adjustments for order  | Yes           | All roles          | Query: `?orderId=...`                                              | `{ success: true, data: FinancialAdjustment[] }` | No                         | 401         |

### 2.7 Photos & Media Storage (`/api/photos`, `/api/orders/:id/photos`)

Controller: `apps/backend/src/photo/photo.controller.ts`

| Method | Route                     | Description                     | Auth Required | Roles     | Request DTO / Body                   | Response Contract                       | Idempotency | Error Codes |
| :----- | :------------------------ | :------------------------------ | :------------ | :-------- | :----------------------------------- | :-------------------------------------- | :---------- | :---------- |
| `POST` | `/photos/upload`          | Upload order/defect photo       | Yes           | All roles | `multipart/form-data` OR JSON base64 | `{ success: true, data: OrderPhoto }`   | No          | 400, 413    |
| `GET`  | `/orders/:orderId/photos` | List photos for order           | Yes           | All roles | URL Param: `orderId`                 | `{ success: true, data: OrderPhoto[] }` | No          | 404         |
| `GET`  | `/photos/local/*`         | Local storage static image pipe | No            | Public    | Local file path                      | Image binary data                       | No          | 404         |

### 2.8 Logistics & Delivery (`/api/deliveries`)

Controller: `apps/backend/src/delivery/delivery.controller.ts`

| Method  | Route                      | Description                        | Auth Required | Roles               | Request DTO / Body                                        | Response Contract                           | Idempotency | Error Codes |
| :------ | :------------------------- | :--------------------------------- | :------------ | :------------------ | :-------------------------------------------------------- | :------------------------------------------ | :---------- | :---------- |
| `POST`  | `/deliveries`              | Create delivery dispatch record    | Yes           | All roles           | `CreateDeliveryDto` (`orderId`, `address`, `scheduledAt`) | `{ success: true, data: DeliveryRecord }`   | No          | 400         |
| `GET`   | `/deliveries`              | List active deliveries             | Yes           | All roles           | Query: `?status=IN_TRANSIT`                               | `{ success: true, data: DeliveryRecord[] }` | No          | 401         |
| `GET`   | `/deliveries/:id`          | Delivery detail                    | Yes           | All roles           | URL Param: `id`                                           | `{ success: true, data: DeliveryRecord }`   | No          | 404         |
| `PATCH` | `/deliveries/:id/assign`   | Assign rider to delivery           | Yes           | `OWNER`, `MANAGER`  | `{ riderId: string }`                                     | `{ success: true, data: DeliveryRecord }`   | No          | 404         |
| `PATCH` | `/deliveries/:id/status`   | Update dispatch status             | Yes           | `DELIVERY`, `OWNER` | `{ status: DeliveryStatus }`                              | `{ success: true, data: DeliveryRecord }`   | No          | 400         |
| `PATCH` | `/deliveries/:id/complete` | Complete delivery with proof photo | Yes           | `DELIVERY`, `OWNER` | `{ proofPhotoUrl: string, notes?: string }`               | `{ success: true, data: DeliveryRecord }`   | No          | 400         |

### 2.9 Store Configuration & Tag Templates (`/api/store`)

Controller: `apps/backend/src/store/store.controller.ts`

| Method  | Route                     | Description                         | Auth Required | Roles     | Request DTO / Body     | Response Contract                         | Idempotency | Error Codes |
| :------ | :------------------------ | :---------------------------------- | :------------ | :-------- | :--------------------- | :---------------------------------------- | :---------- | :---------- |
| `GET`   | `/store/config`           | Store preferences & surcharges      | Yes           | All roles | None                   | `{ success: true, data: StoreConfig }`    | No          | 401         |
| `GET`   | `/store/top-up-services`  | Dynamic add-on services list        | Yes           | All roles | None                   | `{ success: true, data: TopUpService[] }` | No          | 401         |
| `PATCH` | `/store/config`           | Update express surcharge / topups   | Yes           | `OWNER`   | `UpdateStoreConfigDto` | `{ success: true, data: Store }`          | No          | 400         |
| `GET`   | `/store/tag-design`       | Active 40x40 mm tag template layout | Yes           | All roles | None                   | `{ success: true, data: TagTemplate }`    | No          | 401         |
| `PUT`   | `/store/tag-design`       | Update tag layout JSON              | Yes           | `OWNER`   | `SaveTagDesignDto`     | `{ success: true, data: TagTemplate }`    | No          | 400         |
| `POST`  | `/store/tag-design/reset` | Reset tag template to default       | Yes           | `OWNER`   | None                   | `{ success: true, data: TagTemplate }`    | No          | 401         |

### 2.10 Dashboard & Reporting (`/api/dashboard`, `/api/reports`)

Controllers: `dashboard.controller.ts`, `report.controller.ts`

| Method | Route                   | Description                   | Auth Required | Roles                         | Request DTO / Body        | Response Contract                               | Idempotency | Error Codes |
| :----- | :---------------------- | :---------------------------- | :------------ | :---------------------------- | :------------------------ | :---------------------------------------------- | :---------- | :---------- |
| `GET`  | `/dashboard/summary`    | Real-time operational metrics | Yes           | `OWNER`, `MANAGER`, `COUNTER` | None                      | `{ success: true, data: DashboardSummaryDto }`  | No          | 401         |
| `GET`  | `/reports/daily-orders` | Filterable daily order audit  | Yes           | `OWNER`, `MANAGER`            | Query: `?date=YYYY-MM-DD` | `{ success: true, data: DailyOrdersReportDto }` | No          | 401         |

### 2.11 Notifications & Health (`/api/notifications`, `/api/health`)

Controllers: `notification.controller.ts`, `health.controller.ts`

| Method | Route                | Description                     | Auth Required | Roles              | Request DTO / Body    | Response Contract                         | Idempotency | Error Codes |
| :----- | :------------------- | :------------------------------ | :------------ | :----------------- | :-------------------- | :---------------------------------------- | :---------- | :---------- |
| `GET`  | `/notifications`     | List customer notification logs | Yes           | `OWNER`, `MANAGER` | Query: `?orderId=...` | `{ success: true, data: Notification[] }` | No          | 401         |
| `GET`  | `/notifications/:id` | Notification detail             | Yes           | `OWNER`, `MANAGER` | URL Param: `id`       | `{ success: true, data: Notification }`   | No          | 404         |
| `GET`  | `/health`            | Liveness and database probe     | No            | Public             | None                  | `{ status: 'ok', timestamp: string }`     | No          | 503         |
