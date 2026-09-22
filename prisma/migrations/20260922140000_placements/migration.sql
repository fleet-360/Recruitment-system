-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "daysAfterStart" INTEGER NOT NULL,
ADD COLUMN     "sharePercent" DECIMAL(5,2) NOT NULL;

-- AlterTable
ALTER TABLE "LookupValue" ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "endReason" TEXT,
ADD COLUMN     "feeType" "FeeType",
ADD COLUMN     "feeValue" DECIMAL(12,2);

-- CreateIndex
CREATE UNIQUE INDEX "LookupValue_listKey_systemKey_key" ON "LookupValue"("listKey", "systemKey");

