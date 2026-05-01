// ============================================================
// GET /api/rules/audit
// Returns RuleAuditEvent records, filterable by programId or ruleId
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const programId = searchParams.get("programId") ?? undefined
    const ruleId = searchParams.get("ruleId") ?? undefined
    const eventType = searchParams.get("eventType") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") ?? "50"))

    const where: Prisma.RuleAuditEventWhereInput = {}
    if (ruleId) where.ruleId = ruleId
    if (programId) where.rule = { programId }
    if (eventType) where.eventType = eventType

    const [events, total] = await Promise.all([
      prisma.ruleAuditEvent.findMany({
        where,
        include: {
          rule: {
            select: { id: true, label: true, feeType: true, status: true, programId: true },
          },
        },
        orderBy: { changedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.ruleAuditEvent.count({ where }),
    ])

    return NextResponse.json({
      data: events,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    })
  } catch (err) {
    console.error("[GET /api/rules/audit]", err)
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 })
  }
}
