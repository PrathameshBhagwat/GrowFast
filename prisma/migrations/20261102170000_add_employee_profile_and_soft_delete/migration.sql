-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "photo_url" TEXT,
ADD COLUMN     "passport_photo_url" TEXT,
ADD COLUMN     "aadhaar_front_url" TEXT,
ADD COLUMN     "aadhaar_back_url" TEXT,
ADD COLUMN     "current_address" TEXT,
ADD COLUMN     "permanent_address" TEXT,
ADD COLUMN     "same_as_current_address" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_deleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "employees_is_deleted_idx" ON "employees"("is_deleted");
