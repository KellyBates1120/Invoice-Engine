// ============================================================
// POST /api/rules/[id]/supersede
// Creates a new version of an ACTIVE rule with an updated
// effective date. The original rule is marked SUPERSEDED
// when the new version becomes active.
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"
import type { SupersedeRuleInput } from "@/types"

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const rule = await prisma.billingRule.findUnique({
      where: { id: params.id },
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (!["ACTIVE", "PENDING"].includes(rule.status)) {
      return NextResponse.json(
        {
          error: `Cannot supersede a rule with status ${rule.status}`,
          detail: "Only ACTIVE or PENDING rules can be superseded.",
        },
        { status: 409 }
      )
    }

    const body: SupersedeRuleInput = await req.json()
    const createdBy = req.headers.get("x-user-id") ?? "system"

    if (!body.effectiveFrom) {
      return NextResponse.json(
        { error: "effectiveFrom is required for supersede" },
        { status: 400 }
      )
    }

    const newEffectiveFrom = new Date(body.effectiveFrom)

    if (newEffectiveFrom <= rule.effectiveFrom) {
      return NextResponse.json(
        {
          error: "New effectiveFrom must be after the current rule's effectiveFrom",
          current: rule.effectiveFrom,
        },
        { status: 400 }
      )
    }

    // Create new version — copy existing rule, apply changes
    const newRule = await prisma.billingRule.create({
      data: {
        programId: rule.programId,
        label: body.changes?.label ?? rule.label,
        feeType: rule.feeType,
        feeBasis: body.changes?.feeBasis ?? rule.feeBasis,
        rateType: body.changes?.rateType ?? rule.rateType,
        flatRate: body.changes?.flatRate !== undefined ? body.changes.flatRate : rule.flatRate,
        pctRate: body.changes?.pctRate !== undefined ? body.changes.pctRate : rule.pctRate,
        tiers: body.changes?.tiers !== undefined
          ? (body.changes.tiers ?? Prisma.JsonNull)
          : rule.tiers,
        flatComponent: body.changes?.flatComponent !== undefined
          ? body.changes.flatComponent
          : rule.flatComponent,
        pctComponent: body.changes?.pctComponent !== undefined
          ? body.changes.pctComponent
          : rule.pctComponent,
        scopeLevel: rule.scopeLevel,
        scopeOperatorId: rule.scopeOperatorId,
        scopeBanner: rule.scopeBanner,
        scopeMarket: rule.scopeMarket,
        conditions: body.changes?.conditions !== undefined
          ? (body.changes.conditions ?? Prisma.JsonNull)
          : rule.conditions,
        caps: body.changes?.caps !== undefined
          ? (body.changes.caps ?? Prisma.JsonNull)
          : rule.caps,
        floors: body.changes?.floors !== undefined
          ? (body.changes.floors ?? Prisma.JsonNull)
          : rule.floors,
        exclusions: body.changes?.exclusions !== undefined
          ? (body.changes.exclusions ?? Prisma.JsonNull)
          : rule.exclusions,
        effectiveFrom: newEffectiveFrom,
        effectiveTo: body.changes?.effectiveTo
          ? new Date(body.changes.effectiveTo)
          : rule.effectiveTo,
        contractRef: body.contractRef ?? rule.contractRef,
        source: "AMENDMENT",
        status: "DRAFT",
        version: rule.version + 1,
        parentRuleId: rule.id,
        createdBy,
      },
    })

    // Update original rule's effectiveTo to the day before new rule starts
    const dayBefore = new Date(newEffectiveFrom)
    dayBefore.setDate(dayBefore.getDate() - 1)

    await prisma.billingRule.update({
      where: { id: rule.id },
      data: { effectiveTo: dayBefore },
    })

    await prisma.ruleAuditEvent.create({
      data: {
        ruleId: rule.id,
        eventType: "superseded",
        changedBy: createdBy,
        previousData: { status: rule.status, effectiveTo: null } as Prisma.InputJsonValue,
        newData: { effectiveTo: dayBefore, childRuleId: newRule.id } as Prisma.InputJsonValue,
        note: body.note,
      },
    })

    await prisma.ruleAuditEvent.create({
      data: {
        ruleId: newRule.id,
        eventType: "created",
        changedBy: createdBy,
        newData: { parentRuleId: rule.id, version: newRule.version } as Prisma.InputJsonValue,
        note: `New version from supersede of rule ${rule.id}`,
      },
    })

    return NextResponse.json(
      {
        data: newRule,
        meta: {
          previousRuleId: rule.id,
          previousEffectiveTo: dayBefore,
          newVersion: newRule.version,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/rules/:id/supersede]", err)
    return NextResponse.json({ error: "Failed to supersede rule" }, { status: 500 })
  }
}
