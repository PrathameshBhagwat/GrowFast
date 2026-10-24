# 09 — Security Architecture & Authorization Specification

## 1. Security Overview & Threat Model

The GrowFast system operates in shared physical environments (retail counters, mobile delivery vans, laundry processing facilities) where multiple operators share terminals or use dedicated mobile hardware.

The security architecture is designed to address key threat vectors:

- **Terminal Shoulder Surfing**: Prevent operators and customers from viewing staff credentials via fast PIN-based authentication.
- **Unauthorized Role Escalation**: Ensure counter staff or delivery drivers cannot view store revenue, alter catalog pricing, or issue unapproved financial refunds.
- **Cross-Store Tenant Bleed**: Strict isolation ensuring operators in Store A cannot read or write orders belonging to Store B.
- **Brute-Force Attacks**: Protection against automated PIN guessing at the counter or over the network.
- **Physical Device Theft**: Secure hardware encryption for stored JWT access tokens on mobile devices.

---

## 2. Authentication Flow & Credentials Architecture

### 2.1 Public Staff Directory (`GET /api/auth/directory`)

To optimize POS ergonomics on touchscreen terminals, staff do not type usernames. Instead:

1. The terminal queries `GET /api/auth/directory?roles=OWNER,COUNTER`.
2. The server returns a sanitized payload containing **only**:
   ```json
   {
     "success": true,
     "data": [{ "id": "emp_123", "name": "John Doe", "role": "COUNTER" }]
   }
   ```
3. **Data Protection**: Sensitive attributes (`pinHash`, `email`, `phone`, `createdAt`) are stripped server-side in Prisma via explicit `select` projection.

### 2.2 PIN Security & Verification (`bcryptjs`)

- Employees authenticate using a 4-to-6 digit numeric PIN.
- PINs are salted and hashed using `bcryptjs` before storage in PostgreSQL (`Employee.pinHash`).
- Plaintext PINs are never persisted to disk, written to logs, or emitted in API responses.
- In `AuthService.login()`:
  ```typescript
  const isPinValid = await bcrypt.compare(pin, employee.pinHash);
  if (!isPinValid) {
    throw new UnauthorizedException('Invalid credentials');
  }
  ```

### 2.3 Rate Limiting & Throttling

To prevent PIN enumeration attacks against the 4-digit search space (10,000 combinations), the login endpoint is protected by `@nestjs/throttler`:

```typescript
@Post('login')
@Throttle({ default: { limit: process.env.NODE_ENV === 'production' ? 5 : 100, ttl: 60000 } })
async login(@Body() body: LoginDto)
```

- In production, any IP attempting more than **5 failed logins within 60 seconds** receives HTTP `429 Too Many Requests`.

---

## 3. Token Generation & Session Management

### 3.1 JWT Token Architecture

Upon successful PIN validation, `AuthService` issues a signed JSON Web Token (JWT) using `@nestjs/jwt`.

- **Algorithm**: HMAC-SHA256.
- **Token Payload**:
  ```json
  {
    "sub": "cuid_employee_id",
    "role": "COUNTER",
    "storeId": "cuid_store_id",
    "name": "Jane Smith",
    "iat": 1729700000,
    "exp": 1729786400
  }
  ```

### 3.2 Secure Token Storage by Platform

| Platform                 | Storage Mechanism                        | Security Level                                                  | File Reference                            |
| :----------------------- | :--------------------------------------- | :-------------------------------------------------------------- | :---------------------------------------- |
| **Web Browser**          | `localStorage` (via React `AuthContext`) | Standard client storage; protected by domain origin isolation   | `apps/web/src/contexts/AuthContext.tsx`   |
| **Mobile App (Android)** | Android Keystore (`expo-secure-store`)   | Hardware-backed encrypted KeyStore / EncryptedSharedPreferences | `apps/mobile/src/storage/secure-store.ts` |
| **Mobile App (iOS)**     | Apple Keychain (`expo-secure-store`)     | Hardware Secure Enclave encrypted keychain                      | `apps/mobile/src/storage/secure-store.ts` |

---

## 4. Authorization & Role-Based Access Control (RBAC)

### 4.1 Backend Authorization Guards (Authoritative)

In compliance with Rule 9 & Rule 10 in `AGENTS.md`:

> _"Backend authorization must always be enforced server-side. Frontend permissions are NOT security."_

Endpoints are secured using two NestJS guards executed in sequence:

1. `JwtAuthGuard`: Decodes and verifies the Bearer JWT signature against the server secret. Attaches the verified employee payload to `req.user`.
2. `RolesGuard`: Inspects the `@Roles(...)` metadata attached to the controller handler and validates that `req.user.role` matches the allowed role set.

```typescript
@Get()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
async findAllEmployees(@Req() req: any)
```

### 4.2 Role Permission Matrix

| Operation / Domain               | `OWNER` |   `MANAGER`    |       `COUNTER`       | `DELIVERY` |
| :------------------------------- | :-----: | :------------: | :-------------------: | :--------: |
| **Staff Directory Picker**       | Public  |     Public     |        Public         |   Public   |
| **Search & Register Customers**  | Allowed |    Allowed     |        Allowed        |  Allowed   |
| **View Customer Order History**  | Allowed |    Allowed     |        Allowed        |  Allowed   |
| **Create & Stage Orders**        | Allowed |    Allowed     |        Allowed        | Disallowed |
| **Update Garment Item Status**   | Allowed |    Allowed     |        Allowed        |  Allowed   |
| **Collect Payments & Tender**    | Allowed |    Allowed     |        Allowed        |  Allowed   |
| **Issue Refunds / Adjustments**  | Allowed |    Allowed     |      Disallowed       | Disallowed |
| **Modify Catalog Pricing**       | Allowed |    Allowed     |      Disallowed       | Disallowed |
| **Thermal Tag Designer**         | Allowed |   Disallowed   |      Disallowed       | Disallowed |
| **Manage Employee Accounts**     | Allowed | Allowed (Read) |      Disallowed       | Disallowed |
| **View Financial Dashboard**     | Allowed |    Allowed     | Allowed (POS Summary) | Disallowed |
| **Dispatch / Complete Delivery** | Allowed |    Allowed     |      Disallowed       |  Allowed   |

---

## 5. Multi-Tenant Store Scoping

GrowFast enforces strict multi-branch isolation at the database query layer:

- **No Client Spoofing**: `storeId` is never trusted from client request body parameters for sensitive mutations.
- **JWT Context Injection**: The backend extracts `storeId = req.user.storeId` directly from the cryptographically verified JWT payload:
  ```typescript
  const storeId = req.user.storeId;
  const orders = await this.prisma.order.findMany({
    where: { storeId }, // Absolute tenant boundary
  });
  ```
- **Composite Uniqueness**: Orders enforce uniqueness scoped to the store:
  ```prisma
  @@unique([storeId, clientDraftId])
  ```
  This prevents a client draft UUID collision in Store A from impacting or corrupting records in Store B.

---

## 6. Known Security Gaps & Hardening Roadmap

1. **Token Revocation (Blacklisting)**: Currently, JWTs are stateless. If an employee is terminated, their token remains technically valid until its expiration time unless `Employee.isActive` is checked on every sensitive request (which `validateJwtPayload` performs for `/auth/me`, but standard routes rely on token signatures).
2. **Short-Lived Access Tokens + Refresh Tokens**: Tokens currently have a long lifespan (24h) to avoid interrupting busy counter staff. Implementing rolling refresh tokens with device binding will enhance mobile POS security.
3. **PIN Complexity Policy**: Currently accepts any 4-digit string. Enforcing non-trivial PINs (disallowing `0000`, `1234`, or matching birthdays) is recommended.
