// ============================================================
// GET  /api/rules  — list rules with filters
// POST /api/rules  — create a new rule (draft)
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma, RuleStatus, RuleScopeLevel, RuleSource, FeeType } from "@prisma/client"
import type { CreateRuleInput, RuleListParams } from "@/types"

// ─────────────────────────────────────────────
// GET /api/rules
// ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const params: RuleListParams = {
      programId: searchParams.get("programId") ?? undefined,
      feeType: (searchParams.get("feeType") as FeeType) ?? undefined,
      status: (searchParams.get("status") as RuleStatus) ?? undefined,
      scopeLevel: (searchParams.get("scopeLevel") as RuleScopeLevel) ?? undefined,
      source: (searchParams.get("source") as RuleSource) ?? undefined,
      operatorId: searchParams.get("operatorId") ?? undefined,
      asOf: searchParams.get("asOf") ?? undefined,
      page: parseInt(searchParams.get("page") ?? "1"),
      pageSize: Math.min(parseInt(searchParams.get("pageSize") ?? "50"), 100),
    }

    const where: Prisma.BillingRuleWhereInput = {}

    if (params.programId) where.programId = params.programId
    if (params.feeType) where.feeType = params.feeType
    if (params.scopeLevel) where.scopeLevel = params.scopeLevel
    if (params.source) where.source = params.source

    if (params.status) {
      where.status = Array.isArray(params.status)
        ? { in: params.status }
        : params.status
    }

    // asOf: return rules that were active on a specific date
    if (params.asOf) {
      const date = new Date(params.asOf)
      where.effectiveFrom = { lte: date }
      where.OR = [{ effectiveTo: null }, { effectiveTo: { gte: date } }]
      where.status = { in: ["ACTIVE", "PENDING"] }
    }

    // Operator-scoped: return rules that could apply to this operator
    // (operator-specific + banner rules + market rules + program defaults)
    if (params.operatorId && !params.scopeLevel) {
      const operator = await prisma.operator.findUnique({
        where: { id: params.operatorId },
        select: { banner: true },
      })
      where.OR = [
        { scopeLevel: "PROGRAM" },
        { scopeLevel: "OPERATOR", scopeOperatorId: params.operatorId },
        ...(operator?.banner
          ? [{ scopeLevel: "BANNER" as RuleScopeLevel, scopeBanner: operator.banner }]
          : []),
      ]
    }

    const skip = ((params.page ?? 1) - 1) * (params.pageSize ?? 50)

    const [rules, total] = await Promise.all([
      prisma.billingRule.findMany({
        where,
        include: {
          program: { select: { id: true, name: true } },
          _count: { select: { childRules: true } },
        },
        orderBy: [{ feeType: "asc" }, { effectiveFrom: "desc" }],
        skip,
        take: params.pageSize,
      }),
      prisma.billingRule.count({ where }),
    ])

    return NextResponse.json({
      data: rules.map((r) => ({
        ...r,
        versionCount: r._count.childRules + 1,
        latestVersion: true, // Simplified — full impl checks childRules count
      })),
      meta: {
        total,
        page: params.page,
        pageSize: params.pageSize,
        totalPages: Math.ceil(total / (params.pageSize ?? 50)),
      },
    })
  } catch (err) {
    console.error("[GET /api/rules]", err)
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// POST /api/rules
// ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body: CreateRuleInput = await req.json()

    // TODO: replace with real auth
    const createdBy = req.headers.get("x-user-id") ?? "system"

    // Basic validation
    const validationErrors = validateCreateInput(body)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: validationErrors },
        { status: 400 }
      )
    }

    // Check program exists
    const program = await prisma.program.findUnique({
      where: { id: body.programId },
    })
    if (!program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 })
    }

    // Check for scope conflicts (two active rules for same fee type + scope)
    if (body.scopeLevel === "OPERATOR" && body.scopeOperatorId) {
      const conflict = await prisma.billingRule.findFirst({
        where: {
          programId: body.programId,
          feeType: body.feeType,
          scopeLevel: "OPERATOR",
          scopeOperatorId: body.scopeOperatorId,
          status: { in: ["ACTIVE", "PENDING", "DRAFT"] },
        },
      })
      if (conflict) {
        return NextResponse.json(
          {
            error: "Scope conflict",
            details: `An ${conflict.status.toLowerCase()} operator-scoped rule already exists for ${body.feeType}. Use POST /api/rules/${conflict.id}/supersede to create a new version.`,
            existingRuleId: conflict.id,
          },
          { status: 409 }
        )
      }
    }

    const rule = await prisma.billingRule.create({
      data: {
        programId: body.programId,
        label: body.label,
        feeType: body.feeType,
        feeBasis: body.feeBasis,
        rateType: body.rateType,
        flatRate: body.flatRate,
        pctRate: body.pctRate,
        tiers: body.tiers ?? Prisma.JsonNull,
        flatComponent: body.flatComponent,
        pctComponent: body.pctComponent,
        scopeLevel: body.scopeLevel ?? "PROGRAM",
        scopeOperatorId: body.scopeOperatorId,
        scopeBanner: body.scopeBanner,
        scopeMarket: body.scopeMarket,
        conditions: body.conditions ?? Prisma.JsonNull,
        caps: body.caps ?? Prisma.JsonNull,
        floors: body.floors ?? Prisma.JsonNull,
        exclusions: body.exclusions ?? Prisma.JsonNull,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        billingCycleAlignment: body.billingCycleAlignment,
        contractRef: body.contractRef,
        contractDocId: body.contractDocId,
        confidence: body.confidence,
        sourceText: body.sourceText,
        reviewNote: body.reviewNote,
        source: body.source ?? "MANUAL",
        status: body.confidence && body.confidence < 0.8 ? "NEEDS_REVIEW" : "DRAFT",
        createdBy,
      },
    })

    // Create audit event
    await prisma.ruleAuditEvent.create({
      data: {
        ruleId: rule.id,
        eventType: "created",
        changedBy: createdBy,
        newData: rule as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ data: rule }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/rules]", err)
    return NextResponse.json({ error: "Failed to create rule" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────

function validateCreateInput(body: CreateRuleInput): string[] {
  const errors: string[] = []

  if (!body.programId) errors.push("programId is required")
  if (!body.label?.trim()) errors.push("label is required")
  if (!body.feeType) errors.push("feeType is required")
  if (!body.feeBasis) errors.push("feeBasis is required")
  if (!body.rateType) errors.push("rateType is required")
  if (!body.effectiveFrom) errors.push("effectiveFrom is required")

  if (
    (body.rateType === "FLAT" || body.rateType === "FLAT_PLUS_PCT") &&
    body.flatRate === undefined &&
    !body.tiers?.length
  ) {
    errors.push("flatRate or tiers required for FLAT rate type")
  }

  if (
    (body.rateType === "PERCENTAGE" || body.rateType === "TIERED_PCT") &&
    body.pctRate === undefined &&
    !body.tiers?.length
  ) {
    errors.push("pctRate or tiers required for PERCENTAGE rate type")
  }

  if (body.scopeLevel === "OPERATOR" && !body.scopeOperatorId) {
    errors.push("scopeOperatorId required when scopeLevel is OPERATOR")
  }

  if (body.effectiveTo && new Date(body.effectiveTo) <= new Date(body.effectiveFrom)) {
    errors.push("effectiveTo must be after effectiveFrom")
  }

  return errors
}
