-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "anonymizedAt" TIMESTAMP(3),
ADD COLUMN     "departedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "PrivacyRequest" ADD COLUMN     "details" TEXT NOT NULL DEFAULT '';
