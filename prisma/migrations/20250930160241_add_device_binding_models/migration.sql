-- CreateTable
CREATE TABLE "DeviceBinding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pollId" INTEGER NOT NULL,
    "dbt" TEXT NOT NULL,
    "deviceHash" TEXT,
    "webauthnId" TEXT,
    "votedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FingerprintBlock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pollId" INTEGER NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceBinding_dbt_key" ON "DeviceBinding"("dbt");

-- CreateIndex
CREATE INDEX "DeviceBinding_pollId_idx" ON "DeviceBinding"("pollId");

-- CreateIndex
CREATE UNIQUE INDEX "FingerprintBlock_pollId_deviceHash_key" ON "FingerprintBlock"("pollId", "deviceHash");
