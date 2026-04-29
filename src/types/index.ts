// ============================================================
// Loyalty Billing Platform — Core TypeScript Types
// ============================================================

import {
  BillingRule, FeeType, FeeBasis, RateType, RuleStatus,
  RuleScopeLevel, RuleSource, FeeLineItem, Transaction,
} from "@prisma/client"

// ─────────────────────────────────────────────
// RULE CREATION / UPDATE
// ─────────────────────────────────────────────

export interface TierRow {
  thresholdFrom: number
  thresholdTo: number | null  // null = no upper bound
  rate: number                // flat $ amount or decimal % (0.10 = 10%)
}

export interface RuleConditions {
  fuelGrades?: string[]         // ["REG", "MID", "PREM"]
  offerTypes?: string[]
  memberSegments?: string[]
  siteIds?: string[]
  minBasketAmount?: number
  minGallons?: number
  banners?: string[]
  dmas?: string[]
}

export interface RuleCaps {
  monthlyCap?: number
  annualCap?: number
  perSiteCap?: number
  perTransactionCap?: number
  perVisitCap?: number
  perMemberCap?: number
}

export interface RuleFloors {
  monthlyFloor?: number
  perUnitFloor?: number
}

export interface RuleExclusions {
  categoryIds?: string[]
  offerIds?: string[]
  siteIds?: string[]
  banners?: string[]
  description?: string          // Human note on exclusions
}

export interface CreateRuleInput {
  programId: string
  label: string
  feeType: FeeType
  feeBasis: FeeBasis
  rateType: RateType
  flatRate?: number
  pctRate?: number
  tiers?: TierRow[]
  flatComponent?: number
  pctComponent?: number
  scopeLevel?: RuleScopeLevel
  scopeOperatorId?: string
  scopeBanner?: string
  scopeMarket?: string
  conditions?: RuleConditions
  caps?: RuleCaps
  floors?: RuleFloors
  exclusions?: RuleExclusions
  effectiveFrom: string         // ISO date
  effectiveTo?: string
  billingCycleAlignment?: string
  contractRef?: string
  contractDocId?: string
  // AI fields — set when source = AI_PARSED
  confidence?: number
  sourceText?: string
  reviewNote?: string
  source?: RuleSource
}

export interface UpdateRuleInput extends Partial<CreateRuleInput> {
  status?: RuleStatus
}

export interface SupersedeRuleInput {
  effectiveFrom: string         // New version effective date
  changes: UpdateRuleInput      // What's changing
  contractRef?: string          // Amendment reference
  note?: string
}

// ─────────────────────────────────────────────
// RULE LIST / QUERY
// ─────────────────────────────────────────────

export interface RuleListParams {
  programId?: string
  feeType?: FeeType
  status?: RuleStatus | RuleStatus[]
  scopeLevel?: RuleScopeLevel
  source?: RuleSource
  operatorId?: string           // Returns rules scoped to this operator
  asOf?: string                 // ISO date — returns rules active on this date
  page?: number
  pageSize?: number
}

export interface RuleListResponse {
  rules: BillingRuleWithMeta[]
  total: number
  page: number
  pageSize: number
}

export interface BillingRuleWithMeta extends BillingRule {
  versionCount: number
  latestVersion: boolean
  program: { id: string; name: string }
}

// ─────────────────────────────────────────────
// RULE RESOLUTION
// The resolved rule for a given context
// ─────────────────────────────────────────────

export interface RuleResolutionContext {
  programId: string
  operatorId: string
  feeType: FeeType
  date: Date
  banner?: string
  market?: string
}

export interface ResolvedRule {
  rule: BillingRule
  resolvedAt: RuleScopeLevel    // Which scope level was matched
  fallbackChain: RuleScopeLevel[] // Levels checked before match
}

// ─────────────────────────────────────────────
// EVALUATION
// ─────────────────────────────────────────────

export interface EvaluateInput {
  programId: string
  operatorId: string
  periodStart: string           // ISO datetime
  periodEnd: string
  transactions: NormalizedTransaction[]
  isTestRun?: boolean
  billingPeriodId?: string
}

export interface NormalizedTransaction {
  id?: string                   // External txn ID
  siteId?: string
  operatorId?: string
  txnDate: string               // ISO datetime
  txnType: "fuel" | "merch" | "points" | "basket"
  loyaltyFlag: boolean
  gallonQty?: number
  fuelGrade?: string
  basketAmount?: number
  discountAmount?: number
  discountType?: string
  offerId?: string
  memberId?: string
  pointsEarned?: number
  pointsRedeemed?: number
}

export interface EvaluationTrace {
  ruleId: string
  ruleVersion: number
  ruleLabel: string
  scopeResolved: RuleScopeLevel
  tierHit?: TierRow
  capDetails?: { capType: string; capAmount: number; grossBeforeCap: number }
  floorDetails?: { floorAmount: number; grossBeforeFloor: number }
  exclusionDetails?: { count: number; reason: string }
  txnSample?: string[]          // First 5 txn IDs
}

export interface CalculatedFeeLineItem {
  feeType: FeeType
  feeBasis: FeeBasis
  label: string
  ruleId: string
  ruleVersion: number
  lineStart: string
  lineEnd: string
  qualifyingTxnCount: number
  qualifyingBasisAmt: number
  rateApplied: number
  rateType: RateType
  grossFee: number
  capApplied: boolean
  capAmount?: number
  floorApplied: boolean
  calculatedFee: number
  exclusionsApplied: number
  trace: EvaluationTrace
}

export interface EvaluationException {
  exceptionType:
    | "CAP_BREACH"
    | "ZERO_RESULT"
    | "DATA_GAP"
    | "RATE_CONFLICT"
    | "NO_RULE_FOUND"
    | "PERIOD_STRADDLE"
    | "MISSING_SITE_MASTER"
  severity: "ERROR" | "WARNING" | "INFO"
  message: string
  context?: Record<string, unknown>
}

export interface EvaluationResult {
  runId: string
  programId: string
  operatorId: string
  periodStart: string
  periodEnd: string
  lineItems: CalculatedFeeLineItem[]
  totalFees: number
  exceptions: EvaluationException[]
  txnCount: number
  rulesEvaluated: number
  isTestRun: boolean
  completedAt: string
}

// ─────────────────────────────────────────────
// AI EXTRACTION
// ─────────────────────────────────────────────

export interface ExtractInput {
  programId?: string
  documentIds: string[]
  dryRun?: boolean
}

export interface AIExtractedSite {
  externalId?: string
  name?: string
  address?: string
  city?: string
  state?: string
  dma?: string
  fuelGrades?: string[]
}

export interface AIExtractedOperator {
  name: string
  banner?: string
  type?: string
  billingEmail?: string
  sites?: AIExtractedSite[]
}

export interface AIExtractedEntities {
  brandName: string
  programName: string
  platformName?: string
  billingCycle?: string
  contractEffectiveFrom?: string
  contractEffectiveTo?: string
  billingTerms?: string
  paymentTermsDays?: number
  operators?: AIExtractedOperator[]
  confidence: number
  reviewNotes?: string[]
}

export interface OnboardInput {
  entities: AIExtractedEntities
  rules: AIExtractedRule[]
  documentIds: string[]
  createdBy?: string
}

export interface OnboardResult {
  programId: string
  brandId: string
  operatorIds: string[]
  ruleIds: string[]
}

export interface AIExtractedRule {
  feeType: FeeType
  feeBasis: FeeBasis
  rateType: RateType
  label: string
  flatRate?: number
  pctRate?: number
  tiers?: TierRow[]
  flatComponent?: number
  pctComponent?: number
  conditions?: RuleConditions
  caps?: RuleCaps
  floors?: RuleFloors
  exclusions?: RuleExclusions
  effectiveFrom?: string
  effectiveTo?: string
  contractRef?: string          // Section reference e.g. "§4.2, Exhibit B"
  sourceText: string            // Verbatim clause
  governingDocument?: string    // File name it came from
  confidence: number
  needsReview: boolean
  reviewNote?: string
}

export interface ExtractionResult {
  runId: string
  status: string
  rulesFound: number
  rulesNeedReview: number
  rules: AIExtractedRule[]
}

// ─────────────────────────────────────────────
// PLATFORM SCHEMA MAPPING
// ─────────────────────────────────────────────

export type StandardField =
  | "txnId" | "siteId" | "operatorId" | "txnDate" | "txnType"
  | "loyaltyFlag" | "gallonQty" | "fuelGrade" | "basketAmount"
  | "discountAmount" | "discountType" | "offerId" | "memberId"
  | "pointsEarned" | "pointsRedeemed"

export interface FieldMappingEntry {
  sourceColumn?: string         // Column name in CSV
  transform?: string            // e.g. "value / 1000", "value === 'Y'"
  constant?: string | number | boolean // Fixed value for all rows
}

export type FieldMappings = Record<StandardField, FieldMappingEntry>

// ─────────────────────────────────────────────
// API RESPONSE WRAPPERS
// ─────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface ApiError {
  error: string
  details?: Record<string, unknown>
  code?: string
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─────────────────────────────────────────────
// BILLING PERIOD
// ─────────────────────────────────────────────

export interface CreateBillingPeriodInput {
  programId: string
  operatorId?: string
  periodStart: string
  periodEnd: string
  isAdHoc?: boolean
  notes?: string
}
