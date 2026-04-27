// ============================================================
// POST /api/rules/[id]/activate
// Locks a draft rule and sets it to ACTIVE or PENDING
// (PENDING if effectiveFrom is in the future)
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const rule = await prisma.billingRule.findUnique({
      where: { id },
    })

    if (!rule) {
      return NextResponse.json({ error: "Rule not found" }, { status: 404 })
    }

    if (!["DRAFT", "NEEDS_REVIEW"].includes(rule.status)) {
      return NextResponse.json(
        { error: `Cannot activate a rule with status ${rule.status}` },
        { status: 409 }
      )
    }

    // Validate required fields before activation
    const errors = validateForActivation(rule)
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Rule is missing required fields for activation", details: errors },
        { status: 422 }
      )
    }

    const approvedBy = req.headers.get("x-user-id") ?? "system"
    const body = await req.json().catch(() => ({}))
    const note: string | undefined = body.note

    const now = new Date()
    const isFuture = rule.effectiveFrom > now
    const newStatus = isFuture ? "PENDING" : "ACTIVE"

    const updated = await prisma.billingRule.update({
      where: { id: id },
      data: {
        status: newStatus,
        approvedBy,
        approvedAt: now,
        activatedAt: now,
      },
    })

    await prisma.ruleAuditEvent.create({
      data: {
        ruleId: id,
        eventType: "activated",
        changedBy: approvedBy,
        previousData: { status: rule.status } as Prisma.InputJsonValue,
        newData: { status: newStatus } as Prisma.InputJsonValue,
        note: note ?? (isFuture ? `Scheduled active from ${rule.effectiveFrom.toISOString()}` : undefined),
      },
    })

    return NextResponse.json({
      data: updated,
      meta: {
        previousStatus: rule.status,
        newStatus,
        scheduled: isFuture,
        effectiveFrom: rule.effectiveFrom,
      },
    })
  } catch (err) {
    console.error("[POST /api/rules/:id/activate]", err)
    return NextResponse.json({ error: "Failed to activate rule" }, { status: 500 })
  }
}

function validateForActivation(rule: Awaited<ReturnType<typeof prisma.billingRule.findUnique>>): string[] {
  if (!rule) return ["Rule not found"]
  const errors: string[] = []

  if (!rule.feeBasis) errors.push("feeBasis is required")
  if (!rule.rateType) errors.push("rateType is required")
  if (!rule.effectiveFrom) errors.push("effectiveFrom is required")

  const hasRate =
    rule.flatRate != null ||
    rule.pctRate != null ||
    (rule.tiers && (rule.tiers as unknown[]).length > 0)

  if (!hasRate) errors.push("A rate value (flatRate, pctRate, or tiers) is required")

  // Warn if confidence is low — require explicit override
  if (rule.confidence && rule.confidence < 0.8 && rule.status === "NEEDS_REVIEW") {
    errors.push(
      `Rule has low AI confidence (${(rule.confidence * 100).toFixed(0)}%) — all flagged fields must be reviewed before activation`
    )
  }

  return errors
}
