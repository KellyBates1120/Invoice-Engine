// ============================================================
// Rule Resolver
// Walks the scope hierarchy and returns the most specific
// rule for a given (program, operator, feeType, date) context.
//
// Resolution order (highest specificity wins):
//   1. OPERATOR  — operator-specific override
//   2. BANNER    — all operators under a banner
//   3. MARKET    — all sites in a DMA
//   4. PROGRAM   — default for the program
// ============================================================

import { BillingRule, RuleScopeLevel, FeeType } from "@prisma/client"
import { prisma } from "@/lib/db/prisma"
import type { RuleResolutionContext, ResolvedRule } from "@/types"

const SCOPE_PRIORITY: RuleScopeLevel[] = [
  "OPERATOR",
  "BANNER",
  "MARKET",
  "PROGRAM",
]

/**
 * Resolve the most specific active rule for a given context.
 * Returns null if no rule is found (triggers a NO_RULE_FOUND exception).
 */
export async function resolveRule(
  ctx: RuleResolutionContext
): Promise<ResolvedRule | null> {
  // Fetch the operator to get banner info
  const operator = await prisma.operator.findUnique({
    where: { id: ctx.operatorId },
    select: { banner: true },
  })

  const checked: RuleScopeLevel[] = []

  // Walk scope hierarchy from most to least specific
  for (const scopeLevel of SCOPE_PRIORITY) {
    checked.push(scopeLevel)

    const rule = await findRuleAtScope({
      programId: ctx.programId,
      feeType: ctx.feeType,
      date: ctx.date,
      scopeLevel,
      operatorId: ctx.operatorId,
      banner: operator?.banner ?? ctx.banner,
      market: ctx.market,
    })

    if (rule) {
      return {
        rule,
        resolvedAt: scopeLevel,
        fallbackChain: checked.slice(0, -1), // Levels checked before match
      }
    }
  }

  return null
}

interface ScopeLookupParams {
  programId: string
  feeType: FeeType
  date: Date
  scopeLevel: RuleScopeLevel
  operatorId?: string
  banner?: string | null
  market?: string | null
}

async function findRuleAtScope(p: ScopeLookupParams): Promise<BillingRule | null> {
  const baseWhere = {
    programId: p.programId,
    feeType: p.feeType,
    status: "ACTIVE" as const,
    effectiveFrom: { lte: p.date },
    OR: [
      { effectiveTo: null },
      { effectiveTo: { gte: p.date } },
    ],
    scopeLevel: p.scopeLevel,
  }

  switch (p.scopeLevel) {
    case "OPERATOR":
      if (!p.operatorId) return null
      return prisma.billingRule.findFirst({
        where: { ...baseWhere, scopeOperatorId: p.operatorId },
        orderBy: { effectiveFrom: "desc" },
      })

    case "BANNER":
      if (!p.banner) return null
      return prisma.billingRule.findFirst({
        where: { ...baseWhere, scopeBanner: p.banner },
        orderBy: { effectiveFrom: "desc" },
      })

    case "MARKET":
      if (!p.market) return null
      return prisma.billingRule.findFirst({
        where: { ...baseWhere, scopeMarket: p.market },
        orderBy: { effectiveFrom: "desc" },
      })

    case "PROGRAM":
      return prisma.billingRule.findFirst({
        where: baseWhere,
        orderBy: { effectiveFrom: "desc" },
      })
  }
}

/**
 * Resolve all fee types for an operator in a program at a given date.
 * Returns a map of feeType → ResolvedRule (or null if no rule found).
 */
export async function resolveAllRules(params: {
  programId: string
  operatorId: string
  date: Date
  market?: string
}): Promise<Map<FeeType, ResolvedRule>> {
  // Get all active fee types for this program
  const activeFeeTypes = await prisma.billingRule.findMany({
    where: {
      programId: params.programId,
      status: "ACTIVE",
      effectiveFrom: { lte: params.date },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: params.date } }],
    },
    select: { feeType: true },
    distinct: ["feeType"],
  })

  const resolved = new Map<FeeType, ResolvedRule>()

  await Promise.all(
    activeFeeTypes.map(async ({ feeType }) => {
      const result = await resolveRule({
        programId: params.programId,
        operatorId: params.operatorId,
        feeType,
        date: params.date,
        market: params.market,
      })
      if (result) resolved.set(feeType, result)
    })
  )

  return resolved
}

/**
 * Detect if a rule changes between two dates (period straddle check).
 * Returns the boundary date if a change is detected, null otherwise.
 */
export async function detectPeriodStraddle(params: {
  programId: string
  operatorId: string
  feeType: FeeType
  periodStart: Date
  periodEnd: Date
}): Promise<Date | null> {
  // Look for any rule that becomes effective within this period
  const pendingChange = await prisma.billingRule.findFirst({
    where: {
      programId: params.programId,
      feeType: params.feeType,
      status: "ACTIVE",
      effectiveFrom: {
        gt: params.periodStart,
        lte: params.periodEnd,
      },
    },
    orderBy: { effectiveFrom: "asc" },
  })

  return pendingChange?.effectiveFrom ?? null
}
