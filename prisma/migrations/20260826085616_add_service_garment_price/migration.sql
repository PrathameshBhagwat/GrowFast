-- CreateTable
CREATE TABLE "service_garment_prices" (
    "id" TEXT NOT NULL,
    "garment_catalog_id" TEXT NOT NULL,
    "service_type_id" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_garment_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_garment_prices_garment_catalog_id_idx" ON "service_garment_prices"("garment_catalog_id");

-- CreateIndex
CREATE INDEX "service_garment_prices_service_type_id_idx" ON "service_garment_prices"("service_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_garment_prices_garment_catalog_id_service_type_id_key" ON "service_garment_prices"("garment_catalog_id", "service_type_id");

-- AddForeignKey
ALTER TABLE "service_garment_prices" ADD CONSTRAINT "service_garment_prices_garment_catalog_id_fkey" FOREIGN KEY ("garment_catalog_id") REFERENCES "garment_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_garment_prices" ADD CONSTRAINT "service_garment_prices_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
