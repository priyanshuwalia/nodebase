-- CreateIndex
CREATE UNIQUE INDEX "execution_step_executionId_nodeId_key" ON "execution_step"("executionId", "nodeId");

