-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('DRAFT', 'PENDING', 'ACTIVE', 'NEEDS_REVIEW', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RuleSource" AS ENUM ('AI_PARSED', 'MANUAL', 'AMENDMENT', 'CLONE');

-- CreateEnum
CREATE TYPE "RateType" AS ENUM ('FLAT', 'PERCENTAGE', 'TIERED_FLAT', 'TIERED_PCT', 'FLAT_PLUS_PCT');

-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('CPG_FUEL_DISCOUNT', 'MERCH_OFFER_ISSUANCE', 'POINTS_EARN', 'COUPON_PUSH', 'CPG_FUEL_REDEMPTION', 'MERCH_REDEMPTION', 'TICKET_BASKET', 'POINTS_REDEMPTION', 'STORED_VALUE', 'ACTIVE_SITE_FEE', 'PER_TRANSACTION_FEE', 'MEMBER_ENROLLMENT', 'ACTIVE_MEMBER_FEE', 'PROGRAM_MANAGEMENT', 'TECHNOLOGY_PLATFORM', 'DATA_ANALYTICS', 'CAMPAIGN_CONTENT', 'INTEGRATION_ONBOARDING', 'FUEL_MARGIN_LIFT', 'BASKET_SPEND_LIFT', 'COMPETITIVE_MARKET_PREMIUM', 'MARKET_DEVELOPMENT_FUND');

-- CreateEnum
CREATE TYPE "FeeBasis" AS ENUM ('GALLONS_DISPENSED', 'GALLONS_PURCHASED', 'DISCOUNT_VALUE_ISSUED', 'DISCOUNT_VALUE_REDEEMED', 'BASKET_AMOUNT', 'SPEND_AMOUNT', 'POINTS_ISSUED', 'POINTS_REDEEMED', 'SITE_COUNT', 'TRANSACTION_COUNT', 'MEMBER_COUNT', 'FLAT_PERIOD', 'CAMPAIGN_COUNT', 'ASSET_COUNT');

-- CreateEnum
CREATE TYPE "RuleScopeLevel" AS ENUM ('PROGRAM', 'BANNER', 'MARKET', 'OPERATOR');

-- CreateEnum
CREATE TYPE "BillingPeriodStatus" AS ENUM ('OPEN', 'COLLECTING', 'CALCULATING', 'REVIEW', 'APPROVED', 'INVOICED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'AD_HOC', 'EVENT_DRIVEN');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('ACTIVE', 'ONBOARDING', 'SUSPENDED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATING', 'VALID', 'VALID_WITH_WARNINGS', 'FAILED', 'IMPORTED');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('MSA', 'AMENDMENT', 'EXHIBIT', 'SOW', 'RATE_SCHEDULE', 'OTHER');

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "status" "ProgramStatus" NOT NULL DEFAULT 'ONBOARDING',
    "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "platformName" TEXT,
    "linksquaresId" TEXT,
    "linksquaresSyncedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "banner" TEXT,
    "type" TEXT,
    "billingEmail" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorEnrollment" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "OperatorEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "operatorId" TEXT NOT NULL,
    "name" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "dma" TEXT,
    "banner" TEXT,
    "fuelGrades" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingRule" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "feeBasis" "FeeBasis" NOT NULL,
    "rateType" "RateType" NOT NULL,
    "flatRate" DECIMAL(12,6),
    "pctRate" DECIMAL(8,6),
    "tiers" JSONB,
    "flatComponent" DECIMAL(12,2),
    "pctComponent" DECIMAL(8,6),
    "scopeLevel" "RuleScopeLevel" NOT NULL DEFAULT 'PROGRAM',
    "scopeOperatorId" TEXT,
    "scopeBanner" TEXT,
    "scopeMarket" TEXT,
    "conditions" JSONB,
    "caps" JSONB,
    "floors" JSONB,
    "exclusions" JSONB,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "billingCycleAlignment" TEXT,
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "source" "RuleSource" NOT NULL DEFAULT 'MANUAL',
    "contractRef" TEXT,
    "contractDocId" TEXT,
    "confidence" DOUBLE PRECISION,
    "sourceText" TEXT,
    "reviewNote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "parentRuleId" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleAuditEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousData" JSONB,
    "newData" JSONB,
    "note" TEXT,

    CONSTRAINT "RuleAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractDocument" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "storagePath" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "linksquaresId" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "ContractDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractionRun" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "documentIds" TEXT[],
    "rulesFound" INTEGER NOT NULL DEFAULT 0,
    "rulesNeedReview" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSchemaMapping" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "platformName" TEXT NOT NULL,
    "fieldMappings" JSONB NOT NULL,
    "sampleFileName" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSchemaMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataImport" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "billingPeriodId" TEXT,
    "schemaMappingId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "storagePath" TEXT NOT NULL,
    "rowCount" INTEGER,
    "validRowCount" INTEGER,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "validationReport" JSONB,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "externalTxnId" TEXT,
    "siteId" TEXT,
    "operatorId" TEXT,
    "txnDate" TIMESTAMP(3) NOT NULL,
    "txnType" TEXT NOT NULL,
    "loyaltyFlag" BOOLEAN NOT NULL DEFAULT false,
    "gallonQty" DECIMAL(10,4),
    "fuelGrade" TEXT,
    "basketAmount" DECIMAL(10,2),
    "discountAmount" DECIMAL(10,2),
    "discountType" TEXT,
    "offerId" TEXT,
    "memberId" TEXT,
    "pointsEarned" INTEGER,
    "pointsRedeemed" INTEGER,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPeriod" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "operatorId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "BillingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "isAdHoc" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "openedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationRun" (
    "id" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "operatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txnCount" INTEGER,
    "rulesEvaluated" INTEGER,
    "lineItemCount" INTEGER,
    "totalFees" DECIMAL(14,2),
    "exceptionCount" INTEGER,
    "isTestRun" BOOLEAN NOT NULL DEFAULT false,
    "ranBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeLineItem" (
    "id" TEXT NOT NULL,
    "evaluationRunId" TEXT NOT NULL,
    "billingPeriodId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "feeType" "FeeType" NOT NULL,
    "feeBasis" "FeeBasis" NOT NULL,
    "label" TEXT NOT NULL,
    "lineStart" TIMESTAMP(3) NOT NULL,
    "lineEnd" TIMESTAMP(3) NOT NULL,
    "qualifyingTxnCount" INTEGER NOT NULL,
    "qualifyingBasisAmt" DECIMAL(14,4) NOT NULL,
    "rateApplied" DECIMAL(12,6) NOT NULL,
    "rateType" "RateType" NOT NULL,
    "grossFee" DECIMAL(14,2) NOT NULL,
    "capApplied" BOOLEAN NOT NULL DEFAULT false,
    "capAmount" DECIMAL(14,2),
    "floorApplied" BOOLEAN NOT NULL DEFAULT false,
    "calculatedFee" DECIMAL(14,2) NOT NULL,
    "exclusionsApplied" INTEGER NOT NULL DEFAULT 0,
    "evaluationTrace" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationException" (
    "id" TEXT NOT NULL,
    "evaluationRunId" TEXT NOT NULL,
    "exceptionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ContractDocumentToExtractionRun" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_FeeLineItemToTransaction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_externalId_key" ON "Brand"("externalId");

-- CreateIndex
CREATE INDEX "Program_brandId_idx" ON "Program"("brandId");

-- CreateIndex
CREATE INDEX "Program_status_idx" ON "Program"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_externalId_key" ON "Operator"("externalId");

-- CreateIndex
CREATE INDEX "OperatorEnrollment_programId_idx" ON "OperatorEnrollment"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorEnrollment_operatorId_programId_key" ON "OperatorEnrollment"("operatorId", "programId");

-- CreateIndex
CREATE INDEX "Site_operatorId_idx" ON "Site"("operatorId");

-- CreateIndex
CREATE INDEX "Site_dma_idx" ON "Site"("dma");

-- CreateIndex
CREATE INDEX "BillingRule_programId_feeType_status_idx" ON "BillingRule"("programId", "feeType", "status");

-- CreateIndex
CREATE INDEX "BillingRule_programId_scopeLevel_idx" ON "BillingRule"("programId", "scopeLevel");

-- CreateIndex
CREATE INDEX "BillingRule_effectiveFrom_effectiveTo_idx" ON "BillingRule"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "BillingRule_parentRuleId_idx" ON "BillingRule"("parentRuleId");

-- CreateIndex
CREATE INDEX "RuleAuditEvent_ruleId_idx" ON "RuleAuditEvent"("ruleId");

-- CreateIndex
CREATE INDEX "ContractDocument_programId_idx" ON "ContractDocument"("programId");

-- CreateIndex
CREATE INDEX "ExtractionRun_programId_idx" ON "ExtractionRun"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSchemaMapping_programId_key" ON "PlatformSchemaMapping"("programId");

-- CreateIndex
CREATE INDEX "DataImport_programId_billingPeriodId_idx" ON "DataImport"("programId", "billingPeriodId");

-- CreateIndex
CREATE INDEX "Transaction_programId_txnDate_idx" ON "Transaction"("programId", "txnDate");

-- CreateIndex
CREATE INDEX "Transaction_importId_idx" ON "Transaction"("importId");

-- CreateIndex
CREATE INDEX "Transaction_siteId_idx" ON "Transaction"("siteId");

-- CreateIndex
CREATE INDEX "Transaction_operatorId_idx" ON "Transaction"("operatorId");

-- CreateIndex
CREATE INDEX "BillingPeriod_programId_status_idx" ON "BillingPeriod"("programId", "status");

-- CreateIndex
CREATE INDEX "BillingPeriod_periodStart_periodEnd_idx" ON "BillingPeriod"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "EvaluationRun_billingPeriodId_idx" ON "EvaluationRun"("billingPeriodId");

-- CreateIndex
CREATE INDEX "EvaluationRun_programId_idx" ON "EvaluationRun"("programId");

-- CreateIndex
CREATE INDEX "FeeLineItem_billingPeriodId_operatorId_idx" ON "FeeLineItem"("billingPeriodId", "operatorId");

-- CreateIndex
CREATE INDEX "FeeLineItem_ruleId_idx" ON "FeeLineItem"("ruleId");

-- CreateIndex
CREATE INDEX "FeeLineItem_evaluationRunId_idx" ON "FeeLineItem"("evaluationRunId");

-- CreateIndex
CREATE INDEX "EvaluationException_evaluationRunId_idx" ON "EvaluationException"("evaluationRunId");

-- CreateIndex
CREATE UNIQUE INDEX "_ContractDocumentToExtractionRun_AB_unique" ON "_ContractDocumentToExtractionRun"("A", "B");

-- CreateIndex
CREATE INDEX "_ContractDocumentToExtractionRun_B_index" ON "_ContractDocumentToExtractionRun"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_FeeLineItemToTransaction_AB_unique" ON "_FeeLineItemToTransaction"("A", "B");

-- CreateIndex
CREATE INDEX "_FeeLineItemToTransaction_B_index" ON "_FeeLineItemToTransaction"("B");

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorEnrollment" ADD CONSTRAINT "OperatorEnrollment_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorEnrollment" ADD CONSTRAINT "OperatorEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRule" ADD CONSTRAINT "BillingRule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRule" ADD CONSTRAINT "BillingRule_parentRuleId_fkey" FOREIGN KEY ("parentRuleId") REFERENCES "BillingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleAuditEvent" ADD CONSTRAINT "RuleAuditEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "BillingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractDocument" ADD CONSTRAINT "ContractDocument_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSchemaMapping" ADD CONSTRAINT "PlatformSchemaMapping_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataImport" ADD CONSTRAINT "DataImport_schemaMappingId_fkey" FOREIGN KEY ("schemaMappingId") REFERENCES "PlatformSchemaMapping"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "DataImport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPeriod" ADD CONSTRAINT "BillingPeriod_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLineItem" ADD CONSTRAINT "FeeLineItem_evaluationRunId_fkey" FOREIGN KEY ("evaluationRunId") REFERENCES "EvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLineItem" ADD CONSTRAINT "FeeLineItem_billingPeriodId_fkey" FOREIGN KEY ("billingPeriodId") REFERENCES "BillingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeLineItem" ADD CONSTRAINT "FeeLineItem_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "BillingRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationException" ADD CONSTRAINT "EvaluationException_evaluationRunId_fkey" FOREIGN KEY ("evaluationRunId") REFERENCES "EvaluationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractDocumentToExtractionRun" ADD CONSTRAINT "_ContractDocumentToExtractionRun_A_fkey" FOREIGN KEY ("A") REFERENCES "ContractDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContractDocumentToExtractionRun" ADD CONSTRAINT "_ContractDocumentToExtractionRun_B_fkey" FOREIGN KEY ("B") REFERENCES "ExtractionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeeLineItemToTransaction" ADD CONSTRAINT "_FeeLineItemToTransaction_A_fkey" FOREIGN KEY ("A") REFERENCES "FeeLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FeeLineItemToTransaction" ADD CONSTRAINT "_FeeLineItemToTransaction_B_fkey" FOREIGN KEY ("B") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
