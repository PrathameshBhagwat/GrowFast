-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "client_draft_id" TEXT,
ADD COLUMN     "draft_payload_hash" TEXT;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "idempotency_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_store_id_client_draft_id_key" ON "orders"("store_id", "client_draft_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");
