-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "entityId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_createdAt_idx" ON "AccessLog"("createdAt");

