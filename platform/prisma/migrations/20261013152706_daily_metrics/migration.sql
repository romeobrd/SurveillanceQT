-- CreateTable
CREATE TABLE "DailyMetric" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "people" INTEGER NOT NULL,
    "workstationsOccupied" INTEGER NOT NULL,
    "workstationsTotal" INTEGER NOT NULL,
    "lowStock" INTEGER NOT NULL,
    "brokenAssets" INTEGER NOT NULL,

    CONSTRAINT "DailyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_id_organizationId_key" ON "DailyMetric"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMetric_organizationId_date_key" ON "DailyMetric"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "DailyMetric" ADD CONSTRAINT "DailyMetric_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
