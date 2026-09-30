-- CreateEnum
CREATE TYPE "ExecutionStepStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CredentialType" ADD VALUE 'SLACK';
ALTER TYPE "CredentialType" ADD VALUE 'DISCORD';
ALTER TYPE "CredentialType" ADD VALUE 'HTTP_BEARER';

-- AlterEnum
ALTER TYPE "ExecutionStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NodeType" ADD VALUE 'WEBHOOK_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE 'SCHEDULE_TRIGGER';
ALTER TYPE "NodeType" ADD VALUE 'TRANSFORM_JSON';
ALTER TYPE "NodeType" ADD VALUE 'EXTRACT_FIELD';
ALTER TYPE "NodeType" ADD VALUE 'CONDITION';
ALTER TYPE "NodeType" ADD VALUE 'DELAY';

-- AlterTable
ALTER TABLE "Execution" ADD COLUMN     "triggerType" TEXT;

-- CreateTable
CREATE TABLE "execution_step" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "nodeId" TEXT,
    "nodeName" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" "ExecutionStepStatus" NOT NULL DEFAULT 'SUCCESS',
    "order" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "errorStack" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "attempt" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "execution_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoint" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execution_step_executionId_order_idx" ON "execution_step"("executionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoint_nodeId_key" ON "webhook_endpoint"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_endpoint_secret_key" ON "webhook_endpoint"("secret");

-- AddForeignKey
ALTER TABLE "execution_step" ADD CONSTRAINT "execution_step_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "Execution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE CASCADE ON UPDATE CASCADE;
