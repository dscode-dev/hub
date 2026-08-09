/*
  Warnings:

  - You are about to drop the `app_settings` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `minStockQuantityMilli` on the `products` table. All the data in the column will be lost.
  - You are about to drop the column `stockQuantityMilli` on the `products` table. All the data in the column will be lost.
  - Added the required column `nameNormalized` to the `categories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `searchName` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "app_settings";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "allowsFraction" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "units_of_measure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantityMilli" INTEGER NOT NULL,
    "balanceAfterMilli" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_movements_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityMilli" INTEGER NOT NULL DEFAULT 0,
    "lastMovementAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inventory_balances_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_balances_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "scope" TEXT NOT NULL,
    "categoryId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "completedByUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "inventory_counts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_count_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "countId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQuantityMilli" INTEGER NOT NULL,
    "countedQuantityMilli" INTEGER,
    "countedAt" DATETIME,
    CONSTRAINT "inventory_count_items_countId_fkey" FOREIGN KEY ("countId") REFERENCES "inventory_counts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_count_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_categories" ("active", "createdAt", "description", "id", "name", "organizationId", "updatedAt") SELECT "active", "createdAt", "description", "id", "name", "organizationId", "updatedAt" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE INDEX "categories_organizationId_active_idx" ON "categories"("organizationId", "active");
CREATE UNIQUE INDEX "categories_organizationId_nameNormalized_key" ON "categories"("organizationId", "nameNormalized");
CREATE TABLE "new_organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tradeName" TEXT,
    "document" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressZipCode" TEXT,
    "addressStreet" TEXT,
    "addressNumber" TEXT,
    "addressComplement" TEXT,
    "addressDistrict" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressReference" TEXT,
    "logo" TEXT,
    "segments" TEXT NOT NULL DEFAULT '[]',
    "operationGoals" TEXT NOT NULL DEFAULT '[]',
    "onboardingCompletedAt" DATETIME,
    "allowNegativeInventory" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_organizations" ("addressCity", "addressComplement", "addressDistrict", "addressNumber", "addressReference", "addressState", "addressStreet", "addressZipCode", "createdAt", "document", "email", "id", "logo", "name", "onboardingCompletedAt", "operationGoals", "phone", "segments", "tradeName", "updatedAt") SELECT "addressCity", "addressComplement", "addressDistrict", "addressNumber", "addressReference", "addressState", "addressStreet", "addressZipCode", "createdAt", "document", "email", "id", "logo", "name", "onboardingCompletedAt", "operationGoals", "phone", "segments", "tradeName", "updatedAt" FROM "organizations";
DROP TABLE "organizations";
ALTER TABLE "new_organizations" RENAME TO "organizations";
CREATE INDEX "organizations_document_idx" ON "organizations"("document");
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "unitId" TEXT,
    "name" TEXT NOT NULL,
    "searchName" TEXT NOT NULL,
    "sku" TEXT,
    "skuNormalized" TEXT,
    "barcode" TEXT,
    "description" TEXT,
    "costPriceCents" INTEGER,
    "salePriceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trackInventory" BOOLEAN NOT NULL DEFAULT false,
    "minimumStockMilli" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units_of_measure" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_products" ("active", "barcode", "categoryId", "costPriceCents", "createdAt", "description", "id", "name", "organizationId", "salePriceCents", "sku", "trackInventory", "updatedAt") SELECT "active", "barcode", "categoryId", "costPriceCents", "createdAt", "description", "id", "name", "organizationId", "salePriceCents", "sku", "trackInventory", "updatedAt" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
CREATE INDEX "products_organizationId_active_idx" ON "products"("organizationId", "active");
CREATE INDEX "products_organizationId_categoryId_idx" ON "products"("organizationId", "categoryId");
CREATE INDEX "products_organizationId_searchName_idx" ON "products"("organizationId", "searchName");
CREATE INDEX "products_organizationId_barcode_idx" ON "products"("organizationId", "barcode");
CREATE UNIQUE INDEX "products_organizationId_skuNormalized_key" ON "products"("organizationId", "skuNormalized");
CREATE UNIQUE INDEX "products_organizationId_barcode_key" ON "products"("organizationId", "barcode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_organizationId_code_key" ON "units_of_measure"("organizationId", "code");

-- CreateIndex
CREATE INDEX "inventory_movements_organizationId_productId_createdAt_idx" ON "inventory_movements"("organizationId", "productId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_organizationId_createdAt_idx" ON "inventory_movements"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_movements_organizationId_type_idx" ON "inventory_movements"("organizationId", "type");

-- CreateIndex
CREATE INDEX "inventory_movements_referenceType_referenceId_idx" ON "inventory_movements"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_productId_key" ON "inventory_balances"("productId");

-- CreateIndex
CREATE INDEX "inventory_balances_organizationId_quantityMilli_idx" ON "inventory_balances"("organizationId", "quantityMilli");

-- CreateIndex
CREATE INDEX "inventory_counts_organizationId_status_createdAt_idx" ON "inventory_counts"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "inventory_count_items_countId_idx" ON "inventory_count_items"("countId");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_items_countId_productId_key" ON "inventory_count_items"("countId", "productId");
