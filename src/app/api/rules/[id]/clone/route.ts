// POST /api/rules/[id]/clone — copy rule to another program as a draft

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const rule = await prisma.billingRule.findUnique({ where: { id: params.id } })
    if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 })

    const body = await req.json()
    const targetProgramId: string = body.programId ?? rule.programId
    const createdBy = req.headers.get("x-user-id") ?? "system"

    const clone = await prisma.billingRule.create({
      data: {
        programId: targetProgramId,
        label: `${rule.label} (copy)`,
        feeType: rule.feeType,
        feeBasis: rule.feeBasis,
        rateType: rule.rateType,
        flatRate: rule.flatRate,
        pctRate: rule.pctRate,
        tiers: rule.tiers ?? Prisma.JsonNull,
        flatComponent: rule.flatComponent,
        pctComponent: rule.pctComponent,
        scopeLevel: rule.scopeLevel,
        conditions: rule.conditions ?? Prisma.JsonNull,
        caps: rule.caps ?? Prisma.JsonNull,
        floors: rule.floors ?? Prisma.JsonNull,
        exclusions: rule.exclusions ?? Prisma.JsonNull,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : rule.effectiveFrom,
        contractRef: rule.contractRef,
        source: "CLONE",
        status: "DRAFT",
        version: 1,
        createdBy,
      },
    })

    await prisma.ruleAuditEvent.create({
      data: {
        ruleId: clone.id,
        eventType: "created",
        changedBy: createdBy,
        newData: { clonedFrom: rule.id } as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ data: clone }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/rules/:id/clone]", err)
    return NextResponse.json({ error: "Failed to clone rule" }, { status: 500 })
  }
}
