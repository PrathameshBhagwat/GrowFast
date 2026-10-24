# 03. System Architecture & Data Flow

> **Module:** Architectural Topology, Request Lifecycles & State Transitions  
> **Source Location:** `apps/`, `packages/`, `prisma/`  
> **Status:** Fully Audited & Diagrammed

---

## 1. High-Level Architectural Topology

GrowFast is designed as a distributed, multi-client system centered on a NestJS micro-monolith backend backed by a PostgreSQL relational database.

```mermaid
graph TB
    subgraph Clients["Client Layer"]
        Web["Web Management Portal<br/>(React 19 / Vite 6 / Tailwind)"]
        Mobile["Mobile POS & Rider App<br/>(React Native / Expo SDK 52)"]
    end

    subgraph MobileLocal["Mobile Local Persistence"]
        SQLite["Embedded SQLite<br/>(order_drafts, pending_photos)"]
        SecStore["SecureStore<br/>(Encrypted JWT & Session)"]
    end

    subgraph Gateway["API & Security Boundary"]
        NGINX["Reverse Proxy / Port 3000"]
        CORS["CORS & Rate Limiter<br/>(@nestjs/throttler)"]
        JWTAuth["JwtAuthGuard & RolesGuard"]
    end

    subgraph Backend["NestJS Micro-Monolith (apps/backend)"]
        AuthMod["AuthModule"]
        OrderMod["OrderModule"]
        PayMod["PaymentModule"]
        PhotoMod["PhotoModule"]
        DelivMod["DeliveryModule"]
        NotifMod["NotificationModule"]
        DashMod["DashboardModule"]
    end

    subgraph Shared["Shared Foundation (packages/)"]
        SharedTypes["@growfast/shared-types<br/>(Enums, DTOs, deriveOrderStatus, pricing)"]
    end

    subgraph Storage["Persistence & External Services"]
        Postgres[(PostgreSQL 16 Database)]
        CloudflareR2["Cloudflare R2 Storage<br/>(S3-Compatible Photos)"]
        WhatsApp["WhatsApp Gateway<br/>(Baileys Multi-Device)"]
    end

    Mobile --> SQLite
    Mobile --> SecStore
    Mobile --> CORS
    Web --> CORS

    CORS --> JWTAuth
    JWTAuth --> Backend

    Backend -.-> SharedTypes
    Web -.-> SharedTypes
    Mobile -.-> SharedTypes

    Backend --> Postgres
    PhotoMod --> CloudflareR2
    NotifMod --> WhatsApp
```

---

## 2. Monorepo Package Relationships

```mermaid
graph LR
    subgraph Packages["packages/"]
        ST["@growfast/shared-types<br/>(Zero Dependencies)"]
        UI["@growfast/ui<br/>(React 19, Tailwind)"]
    end

    subgraph Applications["apps/"]
        Backend["apps/backend<br/>(NestJS 10)"]
        Web["apps/web<br/>(React 19)"]
        Mobile["apps/mobile<br/>(React Native 0.76.9 / Expo 52)"]
    end

    ST --> Backend
    ST --> Web
    ST --> Mobile
    ST --> UI
    UI --> Web
```

---

## 3. Authentication & Login Flow

Authentication uses employee identifiers with 4-to-6 digit numeric PINs. PINs are verified via bcryptjs hashes, and upon success, a signed JWT access token is returned.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Counter Staff / Rider
    participant Mobile as Mobile App (login.tsx)
    participant AuthCtx as AuthContext
    participant SecStore as SecureStore
    participant API as AuthController (POST /api/auth/login)
    participant AuthSvc as AuthService
    participant DB as PostgreSQL (employees)

    Staff->>Mobile: Selects Employee & Enters PIN
    Mobile->>AuthCtx: login({ employeeId, pin })
    AuthCtx->>API: HTTP POST /api/auth/login
    API->>AuthSvc: login(employeeId, pin)
    AuthSvc->>DB: findUnique({ where: { id: employeeId } })
    DB-->>AuthSvc: Employee Record (with pinHash, isActive, store)

    alt Employee Not Found or Inactive
        AuthSvc-->>API: Throw UnauthorizedException (401)
        API-->>Mobile: HTTP 401 { message: "Invalid credentials" }
        Mobile->>Staff: Display Error Banner (Preserve selected employee)
    else Invalid PIN
        AuthSvc->>AuthSvc: bcrypt.compare(pin, pinHash)
        AuthSvc-->>API: Throw UnauthorizedException (401)
        API-->>Mobile: HTTP 401 { message: "Invalid credentials" }
        Mobile->>Staff: Display Error Banner
    else Valid Credentials
        AuthSvc->>AuthSvc: jwtService.sign({ sub, role, storeId, name })
        AuthSvc-->>API: { accessToken, employee: { id, name, role, storeId } }
        API-->>AuthCtx: HTTP 201 Created
        AuthCtx->>SecStore: saveAuthToken(accessToken)
        AuthCtx->>SecStore: saveUserSession(employee)
        AuthCtx->>AuthCtx: setIsAuthenticated(true)
        AuthCtx-->>Mobile: Transition to /(tabs)
        Mobile->>Staff: Render POS Orders Dashboard
    end
```

---

## 4. Order Creation & Confirmation Pipeline

Order creation guarantees **100% server-enforced idempotency**. Submitting a duplicate `clientDraftId` with the identical payload returns the previously created order; submitting a mismatched payload under the same draft ID returns HTTP 409 Conflict.

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Counter Staff
    participant Wizard as OrderWizardModal
    participant SQLite as SQLite (order_drafts)
    participant Sync as SyncEngine
    participant OrderCtrl as OrderController (POST /api/orders)
    participant OrderSvc as OrderService
    participant Tx as Prisma $transaction
    participant DB as PostgreSQL

    Staff->>Wizard: Complete Customer, Items & Options
    Wizard->>SQLite: saveDraft({ clientDraftId, payload, status: 'QUEUED' })
    Wizard->>Sync: syncDraft(clientDraftId)

    Sync->>Sync: Acquire In-Memory Lock (clientDraftId)
    Sync->>OrderCtrl: HTTP POST /api/orders (Authorization: Bearer JWT)
    OrderCtrl->>OrderSvc: createOrder(dto, employeeId, storeId)

    OrderSvc->>OrderSvc: Compute SHA-256 draftPayloadHash(dto)
    OrderSvc->>Tx: Begin Atomic Database Transaction

    Tx->>DB: Check existing Order where [storeId, clientDraftId]
    alt Idempotent Replay (Same Hash)
        DB-->>Tx: Existing Order Found
        Tx-->>OrderSvc: Return Existing Order DTO
        OrderSvc-->>Sync: Return Existing Order (Recovered)
    else Duplicate Conflict (Different Hash)
        DB-->>Tx: Existing Order with Different Hash
        Tx-->>OrderSvc: Throw ConflictException (409)
        OrderSvc-->>Sync: Return 409 Conflict
    else Fresh Order Submission
        Tx->>DB: Validate Customer & Store Configuration
        Tx->>DB: Fetch Garment Catalog & Service Prices
        Tx->>Tx: calculateOrderTotals() [Subtotal, Surcharges, GST]
        Tx->>DB: Generate Order Number (ORD-YYYY-XXXXXX)
        Tx->>DB: Insert Order Entity
        Tx->>DB: Insert OrderItems
        Tx->>DB: Insert PhysicalGarments with GF- Tag IDs
        Tx-->>OrderSvc: Commit Transaction
        OrderSvc-->>OrderCtrl: Return OrderDetailDTO
        OrderCtrl-->>Sync: HTTP 201 Created
        Sync->>SQLite: updateDraftSyncStatus(clientDraftId, 'SYNCED', serverOrder)
        Sync->>SQLite: linkPhotosToOrder(clientDraftId, serverOrder.id)
        Sync-->>Wizard: Return Success { orderNumber, orderId }
        Wizard->>Staff: Display Confirmation Screen
    end
```

---

## 5. Offline Draft Synchronization State Machine

```mermaid
stateDiagram-v2
    [*] --> DRAFT: Staff Creates / Edits Draft
    DRAFT --> DRAFT: Auto-Save Step Progress
    DRAFT --> QUEUED: Staff Taps Submit Order

    state OnlineCheck <<choice>>
    QUEUED --> OnlineCheck: Check Device Network

    OnlineCheck --> SYNCING: Online (NetInfo isConnected = true)
    OnlineCheck --> QUEUED: Offline (Wait for NetInfo Event)

    state ServerCommit <<choice>>
    SYNCING --> ServerCommit: Post to /api/orders

    ServerCommit --> SYNCED: 201 Created or Idempotent 200
    ServerCommit --> CONFLICT: 409 Payload Hash Mismatch
    ServerCommit --> FAILED_RETRYABLE: Network Drop / Timeout / 500
    ServerCommit --> FAILED_AUTH: 401 Session Expired

    FAILED_RETRYABLE --> SYNCING: Exponential Backoff Retry
    FAILED_AUTH --> QUEUED: User Re-Authenticates
    CONFLICT --> DRAFT: Staff Resolves Payload Conflict

    SYNCED --> UPLOADING_PHOTOS: Trigger Photo Queue
    UPLOADING_PHOTOS --> COMPLETED: All Photos Uploaded to R2
    COMPLETED --> [*]
```

---

## 6. Photo Capture & Storage Pipeline

Garment intake photos are stored locally on the mobile filesystem before being asynchronously synchronized to Cloudflare R2 / AWS S3:

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Counter Staff
    participant Cam as Mobile Camera / Picker
    participant FS as Local Filesystem (cache/photos)
    participant SQLite as SQLite (pending_photos)
    participant Sync as SyncEngine.syncPhotosForDraft()
    participant PhotoCtrl as PhotoController (POST /api/photos/upload)
    participant PhotoSvc as PhotoStorageService
    participant R2 as Cloudflare R2 Storage
    participant DB as PostgreSQL (order_photos)

    Staff->>Cam: Take Defect Photo (e.g. STAIN on Collar)
    Cam->>FS: Save 1200px JPEG to App Sandbox
    FS-->>Staff: Return localFileUri
    Staff->>SQLite: insertPendingPhoto({ localFileUri, clientDraftId, photoType: 'STAIN' })

    Note over Staff,Sync: Order creation completes and obtains serverOrderId

    Sync->>SQLite: getPhotosForDraft(clientDraftId)
    SQLite-->>Sync: [ { id, localFileUri, photoType, serverOrderId } ]

    loop Each Pending Photo
        Sync->>FS: checkFileExists(localFileUri)
        Sync->>PhotoCtrl: Multipart Upload (orderId, type, file)
        PhotoCtrl->>PhotoSvc: uploadPhoto(fileBuffer, metadata)
        PhotoSvc->>R2: PutObjectCommand (Bucket, Key, JPEG)
        R2-->>PhotoSvc: 200 OK (Public/Signed CDN URL)
        PhotoSvc->>DB: prisma.orderPhoto.create({ orderId, url, type })
        DB-->>PhotoCtrl: OrderPhoto Record
        PhotoCtrl-->>Sync: { id, url }
        Sync->>SQLite: updatePhotoSyncStatus(photoId, 'UPLOADED')
    end
```

---

## 7. Payment Processing & Idempotency Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Staff
    participant Modal as PaymentCollectionModal
    participant Mgr as PaymentManager (executePaymentWithIdempotency)
    participant Lock as In-Flight Locks Set
    participant API as PaymentController (POST /api/payments)
    participant PaySvc as PaymentService
    participant DB as PostgreSQL (payments, orders)

    Customer->>Modal: Enters Payment Amount & Selects Mode (UPI / CASH)
    Modal->>Modal: generatePaymentIdempotencyKey(orderId)
    Modal->>Mgr: executePaymentWithIdempotency({ orderId, amount, mode, idempotencyKey })

    Mgr->>Lock: inFlightKeys.has(idempotencyKey)
    alt Concurrent Duplicate Detected
        Mgr-->>Modal: Reject with duplicate submission warning
    else Lock Acquired
        Mgr->>Lock: inFlightKeys.add(idempotencyKey)
        Mgr->>API: HTTP POST /api/payments
        API->>PaySvc: recordPayment(employeeId, storeId, body)

        PaySvc->>DB: Check payment where idempotencyKey = key
        alt Idempotent Duplicate Request
            DB-->>PaySvc: Return Existing Payment
            PaySvc-->>Mgr: Return Existing Payment Record
        else Fresh Payment
            PaySvc->>DB: Validate Order exists and amount <= amountDue
            PaySvc->>DB: Insert Payment Record
            PaySvc->>DB: Update Order (amountPaid += amount, amountDue -= amount)
            PaySvc->>DB: Update paymentStatus (PENDING / PARTIAL / PAID)
            DB-->>PaySvc: Committed Payment
            PaySvc-->>API: PaymentDTO
            API-->>Mgr: HTTP 201 Created
        end
        Mgr->>Lock: inFlightKeys.delete(idempotencyKey)
        Mgr-->>Modal: Success Response
        Modal->>Customer: Display Updated Balance & Receipt
    end
```

---

## 8. Canonical Order Status Derivation Pipeline

Order status is **never** manually set. It is derived through the deterministic state machine in `@growfast/shared-types`:

```mermaid
graph TD
    Items["Order Items Status Array"] --> CheckEmpty{"items.length == 0?"}
    CheckEmpty -->|Yes| Received["ORDER STATUS: RECEIVED"]
    CheckEmpty -->|No| FilterCancelled["Filter non-cancelled items"]

    FilterCancelled --> CheckAllCancelled{"All items CANCELLED?"}
    CheckAllCancelled -->|Yes| Cancelled["ORDER STATUS: CANCELLED"]
    CheckAllCancelled -->|No| FindLowest["Determine Lowest Item Progress"]

    FindLowest --> CheckDelivered{"Lowest == DELIVERED?"}
    CheckDelivered -->|Yes| Delivered["ORDER STATUS: DELIVERED"]

    CheckDelivered -->|No| CheckTransit{"Active Rider Delivery?"}
    CheckTransit -->|Yes| OutForDelivery["ORDER STATUS: OUT_FOR_DELIVERY"]

    CheckTransit -->|No| CheckReady{"Lowest == READY?"}
    CheckReady -->|Yes| Ready["ORDER STATUS: READY"]

    CheckReady -->|No| CheckProcessing{"Lowest == PROCESSING?"}
    CheckProcessing -->|Yes| Processing["ORDER STATUS: PROCESSING"]

    CheckProcessing -->|No| CheckQC{"Lowest == QUALITY_CHECK?"}
    CheckQC -->|Yes| QC["ORDER STATUS: QUALITY_CHECK"]
    CheckQC -->|No| Received
```
