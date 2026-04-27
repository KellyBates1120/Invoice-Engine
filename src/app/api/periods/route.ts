// POST /api/periods  — open a billing period
// GET  /api/periods  — list periods
// PUT  /api/periods/[id]/state — advance period state

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { BillingPeriodStatus } from "@prisma/client"
import type { CreateBillingPeriodInput } from "@/types"

const STATE_TRANSITIONS: Record<BillingPeriodStatus, BillingPeriodStatus | null> = {
  OPEN: "COLLECTING",
  COLLECTING: "CALCULATING",
  CALCULATING: "REVIEW",
  REVIEW: "APPROVED",
  APPROVED: "INVOICED",
  INVOICED: "CLOSED",
  CLOSED: null,
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const programId = searchParams.get("programId")
  const status = searchParams.get("status") as BillingPeriodStatus | null

  const periods = await prisma.billingPeriod.findMany({
    where: {
      ...(programId && { programId }),
      ...(status && { status }),
    },
    include: {
      program: { select: { id: true, name: true, platformName: true } },
      _count: { select: { dataImports: true, evaluationRuns: true } },
    },
    orderBy: { periodStart: "desc" },
  })

  return NextResponse.json({ data: periods })
}

export async function POST(req: NextRequest) {
  try {
    const body: CreateBillingPeriodInput = await req.json()
    const openedBy = req.headers.get("x-user-id") ?? "system"

    const program = await prisma.program.findUnique({ where: { id: body.programId } })
    if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 })

    const period = await prisma.billingPeriod.create({
      data: {
        programId: body.programId,
        operatorId: body.operatorId,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        isAdHoc: body.isAdHoc ?? false,
        notes: body.notes,
        openedBy,
        status: "OPEN",
      },
    })

    return NextResponse.json({ data: period }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/periods]", err)
    return NextResponse.json({ error: "Failed to create period" }, { status: 500 })
  }
}
