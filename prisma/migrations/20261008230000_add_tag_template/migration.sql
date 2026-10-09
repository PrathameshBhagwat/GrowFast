-- CreateTable
CREATE TABLE "tag_templates" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default 40x40 mm Tag',
    "version" INTEGER NOT NULL DEFAULT 1,
    "layout" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tag_templates_store_id_idx" ON "tag_templates"("store_id");

-- CreateIndex
CREATE INDEX "tag_templates_store_id_is_active_idx" ON "tag_templates"("store_id", "is_active");

-- AddForeignKey
ALTER TABLE "tag_templates" ADD CONSTRAINT "tag_templates_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
