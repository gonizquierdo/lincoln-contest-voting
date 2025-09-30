-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DeviceBinding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pollId" INTEGER NOT NULL,
    "dbt" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "deviceHash" TEXT,
    "webauthnId" TEXT,
    "votedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_DeviceBinding" ("createdAt", "dbt", "deviceHash", "id", "pollId", "updatedAt", "votedAt", "webauthnId") SELECT "createdAt", "dbt", "deviceHash", "id", "pollId", "updatedAt", "votedAt", "webauthnId" FROM "DeviceBinding";
DROP TABLE "DeviceBinding";
ALTER TABLE "new_DeviceBinding" RENAME TO "DeviceBinding";
CREATE UNIQUE INDEX "DeviceBinding_dbt_key" ON "DeviceBinding"("dbt");
CREATE INDEX "DeviceBinding_pollId_idx" ON "DeviceBinding"("pollId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
