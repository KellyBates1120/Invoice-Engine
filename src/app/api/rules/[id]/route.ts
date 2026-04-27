// ============================================================
// GET /api/rules/[id]  — get rule with version history
// PUT /api/rules/[id]  — update a DRAFT rule
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"
import type { UpdateRuleInput } from "@/types"

type Params = { params: { id: string } }

// ─────────────────────────────────────────────
// GET /api/rules/[id]
// ─────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const rule = await prisma.billingRule.findUnique({
      where: { id: params.id },
      include: {
        program: { select: { id: true, name: true, brandId: true } },
        auditLog: {
          orderBy: { changedAt: "desc" },
          take: 20,
        },
        // Version chain — walk up to root, down to latest
        parentRule: {
          select: { id: true, version: true, status: true, effectiveFrom: true, label: true },
        },
        childRules: {
          select: { id: true, version: true, status: true, effectiveFrom: true, label: true },
          orderBy: { version: "asc" },
        },
      },
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    return NextResponse.json({ data: rule })
  } catch (err) {
    console.error("[GET /api/rules/:id]", err)
    return NextResponse.json({ error: "Failed to fetch rule" }, { status: 500 })
  }
}

// ─────────────────────────────────────────────
// PUT /api/rules/[id]
// Only allowed on DRAFT or NEEDS_REVIEW rules
// ─────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const existing = await prisma.billingRule.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (!["DRAFT", "NEEDS_REVIEW"].includes(existing.status)) {
      return NextResponse.json(
        {
          error: "Cannot edit an active rule",
          detail:
            "Use POST /api/rules/:id/supersede to create a new version of an active rule.",
        },
        { status: 409 }
      )
    }

    const body: UpdateRuleInput = await req.json()
    const updatedBy = req.headers.get("x-user-id") ?? "system"

    // Snapshot previous state for audit
    const previousData = { ...existing } as unknown as Prisma.InputJsonValue

    // Recalculate status if confidence is being updated
    let status = existing.status
    if (body.confidence !== undefined) {
      status = body.confidence < 0.8 ? "NEEDS_REVIEW" : "DRAFT"
    }
    if (body.status) status = body.status

    const updated = await prisma.billingRule.update({
      where: { id: params.id },
      data: {
        ...(body.label && { label: body.label }),
        ...(body.feeBasis && { feeBasis: body.feeBasis }),
        ...(body.rateType && { rateType: body.rateType }),
        ...(body.flatRate !== undefined && { flatRate: body.flatRate }),
        ...(body.pctRate !== undefined && { pctRate: body.pctRate }),
        ...(body.tiers !== undefined && { tiers: body.tiers ?? Prisma.JsonNull }),
        ...(body.flatComponent !== undefined && { flatComponent: body.flatComponent }),
        ...(body.pctComponent !== undefined && { pctComponent: body.pctComponent }),
        ...(body.scopeLevel && { scopeLevel: body.scopeLevel }),
        ...(body.scopeOperatorId !== undefined && { scopeOperatorId: body.scopeOperatorId }),
        ...(body.scopeBanner !== undefined && { scopeBanner: body.scopeBanner }),
        ...(body.scopeMarket !== undefined && { scopeMarket: body.scopeMarket }),
        ...(body.conditions !== undefined && { conditions: body.conditions ?? Prisma.JsonNull }),
        ...(body.caps !== undefined && { caps: body.caps ?? Prisma.JsonNull }),
        ...(body.floors !== undefined && { floors: body.floors ?? Prisma.JsonNull }),
        ...(body.exclusions !== undefined && { exclusions: body.exclusions ?? Prisma.JsonNull }),
        ...(body.effectiveFrom && { effectiveFrom: new Date(body.effectiveFrom) }),
        ...(body.effectiveTo !== undefined && {
          effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        }),
        ...(body.contractRef !== undefined && { contractRef: body.contractRef }),
        ...(body.confidence !== undefined && { confidence: body.confidence }),
        ...(body.reviewNote !== undefined && { reviewNote: body.reviewNote }),
        status,
      },
    })

    await prisma.ruleAuditEvent.create({
      data: {
        ruleId: params.id,
        eventType: "field_edited",
        changedBy: updatedBy,
        previousData,
        newData: updated as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[PUT /api/rules/:id]", err)
    return NextResponse.json({ error: "Failed to update rule" }, { status: 500 })
  }
}
