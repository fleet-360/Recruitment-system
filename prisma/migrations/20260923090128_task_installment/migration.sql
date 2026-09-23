-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "installmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Task_installmentId_key" ON "Task"("installmentId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

