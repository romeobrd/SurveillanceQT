-- CreateTable
CREATE TABLE "AssetAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "personId" TEXT,
    "zoneId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "AssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetAssignment_assetId_idx" ON "AssetAssignment"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetAssignment_id_organizationId_key" ON "AssetAssignment"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_assetId_organizationId_fkey" FOREIGN KEY ("assetId", "organizationId") REFERENCES "Asset"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_personId_organizationId_fkey" FOREIGN KEY ("personId", "organizationId") REFERENCES "Person"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "AssetAssignment_zoneId_organizationId_fkey" FOREIGN KEY ("zoneId", "organizationId") REFERENCES "Zone"("id", "organizationId") ON DELETE NO ACTION ON UPDATE CASCADE;
