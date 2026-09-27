-- DropIndex
DROP INDEX "Lead_candidateId_key";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "email" TEXT;

-- CreateIndex
CREATE INDEX "Lead_candidateId_idx" ON "Lead"("candidateId");

