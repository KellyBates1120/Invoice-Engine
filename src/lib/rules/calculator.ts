// ============================================================
// Fee Calculation Engine
// Applies a resolved BillingRule to a filtered set of transactions
// and produces a CalculatedFeeLineItem with a full audit trace.
// ============================================================

import { BillingRule, FeeType, FeeBasis, RateType } from "@prisma/client"
import type {
  NormalizedTransaction,
  CalculatedFeeLineItem,
  EvaluationException,
  TierRow,
  RuleConditions,
  RuleCaps,
  RuleFloors,
  RuleExclusions,
  EvaluationTrace,
} from "@/types"
import { resolveRule, detectPeriodStraddle } from "./resolver"

// ─────────────────────────────────────────────
// PUBLIC: Calculate fees for one fee type + rule
// ─────────────────────────────────────────────

export interface CalculateFeesParams {
  rule: BillingRule
  resolvedAt: string
  transactions: NormalizedTransaction[]
  lineStart: Date
  lineEnd: Date
  operatorId: string
}

export function calculateFees(p: CalculateFeesParams): {
  lineItem: CalculatedFeeLineItem | null
  exceptions: EvaluationException[]
} {
  const exceptions: EvaluationException[] = []

  const conditions = p.rule.conditions as RuleConditions | null
  const caps = p.rule.caps as RuleCaps | null
  const floors = p.rule.floors as RuleFloors | null
  const exclusions = p.rule.exclusions as RuleExclusions | null

  // 1. Filter transactions to qualifying events
  const { qualifying, excluded } = filterTransactions(
    p.transactions,
    p.rule.feeBasis as FeeBasis,
    conditions,
    exclusions
  )

  // 2. Sum the basis amount
  const { basisAmount, txnCount } = sumBasis(qualifying, p.rule.feeBasis as FeeBasis)

  if (txnCount === 0) {
    exceptions.push({
      exceptionType: "ZERO_RESULT",
      severity: "WARNING",
      message: `No qualifying transactions found for fee type ${p.rule.feeType}`,
      context: { ruleId: p.rule.id, feeType: p.rule.feeType },
    })
    return { lineItem: null, exceptions }
  }

  // 3. Apply rate
  const rateType = p.rule.rateType as RateType
  let tierHit: TierRow | undefined
  let grossFee: number

  if (rateType === "FLAT" || rateType === "TIERED_FLAT") {
    const { amount, tier } = applyFlatRate(
      basisAmount,
      p.rule.flatRate ? Number(p.rule.flatRate) : 0,
      p.rule.tiers as TierRow[] | null,
      rateType
    )
    grossFee = amount
    tierHit = tier
  } else if (rateType === "PERCENTAGE" || rateType === "TIERED_PCT") {
    const { amount, tier } = applyPctRate(
      basisAmount,
      p.rule.pctRate ? Number(p.rule.pctRate) : 0,
      p.rule.tiers as TierRow[] | null,
      rateType
    )
    grossFee = amount
    tierHit = tier
  } else if (rateType === "FLAT_PLUS_PCT") {
    const flatPart = p.rule.flatComponent ? Number(p.rule.flatComponent) : 0
    const pctPart = p.rule.pctComponent ? Number(p.rule.pctComponent) : 0
    grossFee = flatPart + basisAmount * pctPart
  } else {
    grossFee = 0
  }

  // 4. Apply caps
  let calculatedFee = grossFee
  let capApplied = false
  let capAmount: number | undefined
  let capDetails: EvaluationTrace["capDetails"]

  if (caps?.monthlyCap && calculatedFee > caps.monthlyCap) {
    capDetails = { capType: "monthly", capAmount: caps.monthlyCap, grossBeforeCap: calculatedFee }
    calculatedFee = caps.monthlyCap
    capApplied = true
    capAmount = caps.monthlyCap
    exceptions.push({
      exceptionType: "CAP_BREACH",
      severity: "INFO",
      message: `Monthly cap of $${caps.monthlyCap} applied to ${p.rule.feeType} — gross was $${grossFee.toFixed(2)}`,
      context: { ruleId: p.rule.id, grossFee, cap: caps.monthlyCap },
    })
  }

  // 5. Apply floors
  let floorApplied = false
  let floorDetails: EvaluationTrace["floorDetails"]

  if (floors?.monthlyFloor && calculatedFee < floors.monthlyFloor) {
    floorDetails = { floorAmount: floors.monthlyFloor, grossBeforeFloor: calculatedFee }
    calculatedFee = floors.monthlyFloor
    floorApplied = true
  }

  // 6. Determine rate applied (for display)
  const rateApplied =
    rateType === "FLAT" || rateType === "FLAT_PLUS_PCT"
      ? p.rule.flatRate ? Number(p.rule.flatRate) : 0
      : tierHit?.rate ?? (p.rule.pctRate ? Number(p.rule.pctRate) : 0)

  const trace: EvaluationTrace = {
    ruleId: p.rule.id,
    ruleVersion: p.rule.version,
    ruleLabel: p.rule.label,
    scopeResolved: p.resolvedAt as any,
    tierHit,
    capDetails,
    floorDetails,
    exclusionDetails: excluded > 0
      ? { count: excluded, reason: "Matched exclusion conditions" }
      : undefined,
    txnSample: qualifying.slice(0, 5).map((t) => t.id ?? "unknown"),
  }

  const lineItem: CalculatedFeeLineItem = {
    feeType: p.rule.feeType as FeeType,
    feeBasis: p.rule.feeBasis as FeeBasis,
    label: p.rule.label,
    ruleId: p.rule.id,
    ruleVersion: p.rule.version,
    lineStart: p.lineStart.toISOString(),
    lineEnd: p.lineEnd.toISOString(),
    qualifyingTxnCount: txnCount,
    qualifyingBasisAmt: basisAmount,
    rateApplied,
    rateType: p.rule.rateType as RateType,
    grossFee,
    capApplied,
    capAmount,
    floorApplied,
    calculatedFee,
    exclusionsApplied: excluded,
    trace,
  }

  return { lineItem, exceptions }
}

// ─────────────────────────────────────────────
// TRANSACTION FILTERING
// ─────────────────────────────────────────────

function filterTransactions(
  transactions: NormalizedTransaction[],
  feeBasis: FeeBasis,
  conditions: RuleConditions | null,
  exclusions: RuleExclusions | null
): { qualifying: NormalizedTransaction[]; excluded: number } {
  let pool = transactions

  // Filter by txn type based on fee basis
  pool = pool.filter((t) => txnMatchesBasis(t, feeBasis))

  // Apply loyalty flag requirement (most fee types require loyalty-tagged txns)
  const needsLoyaltyFlag = !([
    "TRANSACTION_COUNT",
    "ACTIVE_SITE_FEE",
    "FLAT_PERIOD",
  ] as FeeBasis[]).includes(feeBasis)

  if (needsLoyaltyFlag) {
    pool = pool.filter((t) => t.loyaltyFlag)
  }

  // Apply conditions
  if (conditions) {
    if (conditions.fuelGrades?.length) {
      pool = pool.filter(
        (t) => t.fuelGrade && conditions.fuelGrades!.includes(t.fuelGrade)
      )
    }
    if (conditions.offerTypes?.length) {
      pool = pool.filter(
        (t) => t.discountType && conditions.offerTypes!.includes(t.discountType)
      )
    }
    if (conditions.siteIds?.length) {
      pool = pool.filter((t) => t.siteId && conditions.siteIds!.includes(t.siteId))
    }
    if (conditions.minBasketAmount) {
      pool = pool.filter(
        (t) => (t.basketAmount ?? 0) >= conditions.minBasketAmount!
      )
    }
    if (conditions.minGallons) {
      pool = pool.filter((t) => (t.gallonQty ?? 0) >= conditions.minGallons!)
    }
  }

  // Apply exclusions — count excluded before removing
  let excluded = 0

  if (exclusions) {
    const before = pool.length
    if (exclusions.offerIds?.length) {
      pool = pool.filter(
        (t) => !(t.offerId && exclusions.offerIds!.includes(t.offerId))
      )
    }
    if (exclusions.siteIds?.length) {
      pool = pool.filter(
        (t) => !(t.siteId && exclusions.siteIds!.includes(t.siteId))
      )
    }
    excluded = before - pool.length
  }

  return { qualifying: pool, excluded }
}

function txnMatchesBasis(t: NormalizedTransaction, feeBasis: FeeBasis): boolean {
  switch (feeBasis) {
    case "GALLONS_DISPENSED":
    case "GALLONS_PURCHASED":
      return t.txnType === "fuel" && (t.gallonQty ?? 0) > 0
    case "DISCOUNT_VALUE_ISSUED":
    case "DISCOUNT_VALUE_REDEEMED":
      return ["merch", "basket"].includes(t.txnType) && (t.discountAmount ?? 0) > 0
    case "BASKET_AMOUNT":
      return (t.basketAmount ?? 0) > 0
    case "POINTS_ISSUED":
      return (t.pointsEarned ?? 0) > 0
    case "POINTS_REDEEMED":
      return (t.pointsRedeemed ?? 0) > 0
    case "TRANSACTION_COUNT":
      return true
    case "MEMBER_COUNT":
      return !!t.memberId
    case "SPEND_AMOUNT":
      return (t.basketAmount ?? 0) > 0
    default:
      return true
  }
}

// ─────────────────────────────────────────────
// BASIS SUMMATION
// ─────────────────────────────────────────────

function sumBasis(
  transactions: NormalizedTransaction[],
  feeBasis: FeeBasis
): { basisAmount: number; txnCount: number } {
  const txnCount = transactions.length
  if (txnCount === 0) return { basisAmount: 0, txnCount: 0 }

  let basisAmount = 0

  switch (feeBasis) {
    case "GALLONS_DISPENSED":
    case "GALLONS_PURCHASED":
      basisAmount = transactions.reduce((sum, t) => sum + (t.gallonQty ?? 0), 0)
      break
    case "DISCOUNT_VALUE_ISSUED":
    case "DISCOUNT_VALUE_REDEEMED":
      basisAmount = transactions.reduce((sum, t) => sum + (t.discountAmount ?? 0), 0)
      break
    case "BASKET_AMOUNT":
    case "SPEND_AMOUNT":
      basisAmount = transactions.reduce((sum, t) => sum + (t.basketAmount ?? 0), 0)
      break
    case "POINTS_ISSUED":
      basisAmount = transactions.reduce((sum, t) => sum + (t.pointsEarned ?? 0), 0)
      break
    case "POINTS_REDEEMED":
      basisAmount = transactions.reduce((sum, t) => sum + (t.pointsRedeemed ?? 0), 0)
      break
    case "TRANSACTION_COUNT":
    case "MEMBER_COUNT":
      basisAmount = txnCount
      break
    case "FLAT_PERIOD":
      basisAmount = 1  // Rate is applied once
      break
    case "SITE_COUNT": {
      const uniqueSites = new Set(transactions.map((t) => t.siteId).filter(Boolean))
      basisAmount = uniqueSites.size
      break
    }
    case "CAMPAIGN_COUNT":
    case "ASSET_COUNT": {
      const uniqueOffers = new Set(transactions.map((t) => t.offerId).filter(Boolean))
      basisAmount = uniqueOffers.size
      break
    }
    default:
      basisAmount = txnCount
  }

  return { basisAmount, txnCount }
}

// ─────────────────────────────────────────────
// RATE APPLICATION
// ─────────────────────────────────────────────

function applyFlatRate(
  basisAmount: number,
  flatRate: number,
  tiers: TierRow[] | null,
  rateType: RateType
): { amount: number; tier?: TierRow } {
  if (rateType === "TIERED_FLAT" && tiers?.length) {
    const tier = resolveTier(basisAmount, tiers)
    return { amount: basisAmount * tier.rate, tier }
  }
  return { amount: basisAmount * flatRate }
}

function applyPctRate(
  basisAmount: number,
  pctRate: number,
  tiers: TierRow[] | null,
  rateType: RateType
): { amount: number; tier?: TierRow } {
  if (rateType === "TIERED_PCT" && tiers?.length) {
    const tier = resolveTier(basisAmount, tiers)
    return { amount: basisAmount * tier.rate, tier }
  }
  return { amount: basisAmount * pctRate }
}

function resolveTier(amount: number, tiers: TierRow[]): TierRow {
  // Tiers are ordered by thresholdFrom ascending
  const sorted = [...tiers].sort((a, b) => a.thresholdFrom - b.thresholdFrom)
  let matched = sorted[0]
  for (const tier of sorted) {
    if (amount >= tier.thresholdFrom) matched = tier
    else break
  }
  return matched
}
