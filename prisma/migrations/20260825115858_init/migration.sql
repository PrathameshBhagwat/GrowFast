-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'MANAGER', 'COUNTER', 'DELIVERY');

-- CreateEnum
CREATE TYPE "MembershipTier" AS ENUM ('NONE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "GarmentCategory" AS ENUM ('MEN', 'WOMEN', 'KIDS', 'HOUSEHOLD', 'SHOES', 'SPECIAL');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('DRY_CLEAN', 'STEAM_PRESS', 'WASH', 'WASH_IRON', 'SHOE_CLEAN', 'LEATHER_CLEAN', 'STAIN_REMOVAL', 'WEIGHT_BASED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'SORTING', 'PROCESSING', 'DRYING', 'IRONING', 'QUALITY_CHECK', 'PACKED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('STORE_PICKUP', 'HOME_DELIVERY');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('STANDARD', 'EXPRESS', 'VIP');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('SYNCED', 'PENDING', 'FAILED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'QUALITY_CHECK', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('FRONT', 'BACK', 'DAMAGE', 'STAIN', 'TAG', 'DELIVERY_PROOF');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'CARD', 'ONLINE', 'STORE_CREDIT');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SCHEDULED', 'ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "pin_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "store_id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "pincode" TEXT,
    "membership" "MembershipTier" NOT NULL DEFAULT 'NONE',
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preferences" JSONB,
    "registration_source" TEXT NOT NULL DEFAULT 'WALK_IN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garment_catalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "GarmentCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garment_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "estimatedDays" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "system_due_date" TIMESTAMP(3) NOT NULL,
    "effective_due_date" TIMESTAMP(3) NOT NULL,
    "due_date_override_reason" TEXT,
    "due_date_overridden_by" TEXT,
    "is_express" BOOLEAN NOT NULL DEFAULT false,
    "service_summary" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "express_surcharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount_due" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "pickup_type" "PickupType" NOT NULL DEFAULT 'STORE_PICKUP',
    "priority" "OrderPriority" NOT NULL DEFAULT 'STANDARD',
    "notes" TEXT,
    "sync_status" "SyncStatus" NOT NULL DEFAULT 'SYNCED',
    "created_by_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "garment_catalog_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "line_total" DOUBLE PRECISION NOT NULL,
    "color_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defect_notes" TEXT,
    "item_status" "ItemStatus" NOT NULL DEFAULT 'RECEIVED',
    "delivered_quantity" INTEGER NOT NULL DEFAULT 0,
    "item_due_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_photos" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "order_item_id" TEXT,
    "type" "PhotoType" NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "reference" TEXT,
    "received_by_id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "rider_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "proof_photo_url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_store_id_idx" ON "employees"("store_id");

-- CreateIndex
CREATE INDEX "employees_role_idx" ON "employees"("role");

-- CreateIndex
CREATE INDEX "employees_isActive_idx" ON "employees"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE INDEX "garment_catalog_category_idx" ON "garment_catalog"("category");

-- CreateIndex
CREATE INDEX "service_types_category_idx" ON "service_types"("category");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_order_date_idx" ON "orders"("order_date");

-- CreateIndex
CREATE INDEX "orders_store_id_idx" ON "orders"("store_id");

-- CreateIndex
CREATE INDEX "orders_created_by_id_idx" ON "orders"("created_by_id");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_item_status_idx" ON "order_items"("item_status");

-- CreateIndex
CREATE INDEX "order_photos_order_id_idx" ON "order_photos"("order_id");

-- CreateIndex
CREATE INDEX "order_photos_order_item_id_idx" ON "order_photos"("order_item_id");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "delivery_records_order_id_idx" ON "delivery_records"("order_id");

-- CreateIndex
CREATE INDEX "delivery_records_rider_id_idx" ON "delivery_records"("rider_id");

-- CreateIndex
CREATE INDEX "delivery_records_status_idx" ON "delivery_records"("status");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_garment_catalog_id_fkey" FOREIGN KEY ("garment_catalog_id") REFERENCES "garment_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
