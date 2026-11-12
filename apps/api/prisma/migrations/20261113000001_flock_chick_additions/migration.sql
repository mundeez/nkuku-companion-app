-- CreateEnum
CREATE TYPE "ChickAdditionReason" AS ENUM ('hatchery_extra', 'purchase', 'correction');

-- CreateTable
CREATE TABLE "flock_chick_additions" (
    "id" UUID NOT NULL,
    "flock_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "addition_date" DATE NOT NULL,
    "count" INTEGER NOT NULL,
    "reason" "ChickAdditionReason" NOT NULL,
    "unit_price_zmw" NUMERIC(14,2),
    "notes" VARCHAR(500),
    "financial_record_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "flock_chick_additions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flock_chick_additions_flock_id_idx" ON "flock_chick_additions"("flock_id");

-- CreateIndex
CREATE INDEX "flock_chick_additions_organization_id_idx" ON "flock_chick_additions"("organization_id");

-- AddForeignKey
ALTER TABLE "flock_chick_additions" ADD CONSTRAINT "flock_chick_additions_flock_id_fkey" FOREIGN KEY ("flock_id") REFERENCES "broiler_flocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
