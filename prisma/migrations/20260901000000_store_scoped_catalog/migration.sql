-- DropIndex
DROP INDEX "service_garment_prices_garment_catalog_id_service_type_id_key";

-- AlterTable
ALTER TABLE "garment_catalog" ADD COLUMN     "section" TEXT,
ADD COLUMN     "store_id" TEXT;

-- AlterTable
ALTER TABLE "service_garment_prices" ADD COLUMN     "store_id" TEXT;

-- AlterTable
ALTER TABLE "service_types" ADD COLUMN     "store_id" TEXT;

-- CreateIndex
CREATE INDEX "garment_catalog_store_id_idx" ON "garment_catalog"("store_id");

-- CreateIndex
CREATE INDEX "service_garment_prices_store_id_idx" ON "service_garment_prices"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_garment_prices_garment_catalog_id_service_type_id_s_key" ON "service_garment_prices"("garment_catalog_id", "service_type_id", "store_id");

-- CreateIndex
CREATE INDEX "service_types_store_id_idx" ON "service_types"("store_id");

-- AddForeignKey
ALTER TABLE "garment_catalog" ADD CONSTRAINT "garment_catalog_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_types" ADD CONSTRAINT "service_types_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_garment_prices" ADD CONSTRAINT "service_garment_prices_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
