# API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

All protected endpoints require `Authorization: Bearer <JWT>` header.

---

## Auth Module

### POST /api/auth/login

Authenticate employee with ID and PIN.

**Request:**

```json
{ "employeeId": "emp-counter-001", "pin": "333333" }
```

**Response (200):**

```json
{
  "accessToken": "eyJ...",
  "employee": {
    "id": "emp-counter-001",
    "name": "Swapnil Shinde",
    "role": "COUNTER",
    "storeId": "store-kp-001",
    "storeName": "Koregaon Park Branch"
  }
}
```

### GET /api/auth/me

Get current authenticated employee. **Requires JWT.**

### GET /api/auth/admin-test

Test admin access. **Requires OWNER or MANAGER role.**

---

## Health Module

### GET /api/health

Health check endpoint (no auth required).

---

## Planned Modules (Not Yet Implemented)

### Customer Module

| Method | Endpoint                  | Roles    | Description                            |
| ------ | ------------------------- | -------- | -------------------------------------- |
| GET    | /api/customers            | ALL      | List customers (paginated, searchable) |
| GET    | /api/customers/:id        | ALL      | Get customer details                   |
| POST   | /api/customers            | COUNTER+ | Create customer                        |
| PATCH  | /api/customers/:id        | COUNTER+ | Update customer                        |
| GET    | /api/customers/:id/orders | ALL      | Customer order history                 |

### Order Module

| Method | Endpoint                 | Roles    | Description                       |
| ------ | ------------------------ | -------- | --------------------------------- |
| GET    | /api/orders              | ALL      | List orders (filtered, paginated) |
| GET    | /api/orders/:id          | ALL      | Get order details with items      |
| POST   | /api/orders              | COUNTER+ | Create new order                  |
| PATCH  | /api/orders/:id/status   | MANAGER+ | Update order status               |
| PATCH  | /api/orders/:id/due-date | MANAGER+ | Override due date                 |

### Catalog Module

| Method | Endpoint          | Roles | Description          |
| ------ | ----------------- | ----- | -------------------- |
| GET    | /api/garments     | ALL   | List garment catalog |
| GET    | /api/services     | ALL   | List service types   |
| PATCH  | /api/garments/:id | OWNER | Update garment       |
| PATCH  | /api/services/:id | OWNER | Update service       |

### Payment Module

| Method | Endpoint                 | Roles    | Description         |
| ------ | ------------------------ | -------- | ------------------- |
| POST   | /api/payments            | COUNTER+ | Record payment      |
| GET    | /api/orders/:id/payments | ALL      | List order payments |

### Photo Module

| Method | Endpoint               | Roles    | Description       |
| ------ | ---------------------- | -------- | ----------------- |
| POST   | /api/photos/upload     | COUNTER+ | Upload photo      |
| GET    | /api/orders/:id/photos | ALL      | List order photos |

### Delivery Module

| Method | Endpoint                  | Roles     | Description            |
| ------ | ------------------------- | --------- | ---------------------- |
| GET    | /api/deliveries           | DELIVERY+ | List delivery tasks    |
| PATCH  | /api/deliveries/:id       | DELIVERY+ | Update delivery status |
| POST   | /api/deliveries/:id/proof | DELIVERY  | Upload delivery proof  |

### Dashboard Module

| Method | Endpoint               | Roles    | Description       |
| ------ | ---------------------- | -------- | ----------------- |
| GET    | /api/dashboard/summary | MANAGER+ | KPI summary       |
| GET    | /api/dashboard/revenue | OWNER    | Revenue analytics |
