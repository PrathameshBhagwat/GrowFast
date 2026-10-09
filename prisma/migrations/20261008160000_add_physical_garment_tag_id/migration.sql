-- AlterTable
ALTER TABLE "physical_garments" ADD COLUMN     "tag_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "physical_garments_tag_id_key" ON "physical_garments"("tag_id");

-- CreateIndex
CREATE INDEX "physical_garments_tag_id_idx" ON "physical_garments"("tag_id");
