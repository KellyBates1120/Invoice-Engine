// ============================================================
// POST /api/evaluate
// Runs the rules engine for a program/operator/period.
// Handles period straddle detection, rule resolution,
// and fee calculation across all active fee types.
// GET  /api/evaluate/:runId — fetch a completed run
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma, FeeType } from "@prisma/client"
import { resolveRule, detectPeriodStraddle } from "@/lib/rules/resolver"
import { calculateFees } from "@/lib/rules/calculator"
import type {
  EvaluateInput,
  EvaluationResult,
  CalculatedFeeLineItem,
  EvaluationException,
  NormalizedTransaction,
} from "@/types"

export async function POST(req: NextRequest) {
  try {
    const body: EvaluateInput = await req.json()
    const ranBy = req.headers.get("x-user-id") ?? "system"

    // Validate input
    const errors = validateEvalInput(body)
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 })
    }

    const periodStart = new Date(body.periodStart)
    const periodEnd = new Date(body.periodEnd)

    // Verify program and operator exist
    const [program, operator] = await Promise.all([
      prisma.program.findUnique({ where: { id: body.programId } }),
      prisma.operator.findFirst({
        where: { OR: [{ id: body.operatorId }, { externalId: body.operatorId }] },
        select: { id: true, banner: true },
      }),
    ])

    if (!program) return NextResponse.json({ error: "Program not found" }, { status: 404 })
    if (!operator) return NextResponse.json({ error: "Operator not found" }, { status: 404 })

    // Create evaluation run record
    const run = await prisma.evaluationRun.create({
      data: {
        billingPeriodId: body.billingPeriodId ?? (await getOrCreatePeriod(body)),
        programId: body.programId,
        operatorId: body.operatorId,
        status: "RUNNING",
        txnCount: body.transactions.length,
        isTestRun: body.isTestRun ?? false,
        ranBy,
        startedAt: new Date(),
      },
    })

    const allLineItems: CalculatedFeeLineItem[] = []
    const allExceptions: EvaluationException[] = []
    let rulesEvaluated = 0

    // Get all distinct fee types that have rules for this program
    const activeFeeTypes = await prisma.billingRule.findMany({
      where: {
        programId: body.programId,
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: { feeType: true },
      distinct: ["feeType"],
    })

    // Evaluate each fee type
    for (const { feeType } of activeFeeTypes) {
      const result = await evaluateFeeType({
        feeType,
        programId: body.programId,
        operatorId: body.operatorId,
        transactions: body.transactions,
        periodStart,
        periodEnd,
        banner: operator.banner ?? undefined,
      })

      allLineItems.push(...result.lineItems)
      allExceptions.push(...result.exceptions)
      rulesEvaluated += result.rulesEvaluated
    }

    const totalFees = allLineItems.reduce((sum, li) => sum + li.calculatedFee, 0)

    // Persist line items (skip for test runs to keep DB clean)
    if (!body.isTestRun && body.billingPeriodId) {
      await persistLineItems(run.id, body.billingPeriodId, body.operatorId, allLineItems)
    }

    // Persist exceptions
    if (allExceptions.length > 0) {
      await prisma.evaluationException.createMany({
        data: allExceptions.map((e) => ({
          evaluationRunId: run.id,
          exceptionType: e.exceptionType,
          severity: e.severity,
          message: e.message,
          context: (e.context as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        })),
      })
    }

    // Update run status
    await prisma.evaluationRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETE",
        rulesEvaluated,
        lineItemCount: allLineItems.length,
        totalFees,
        exceptionCount: allExceptions.length,
        completedAt: new Date(),
      },
    })

    const result: EvaluationResult = {
      runId: run.id,
      programId: body.programId,
      operatorId: body.operatorId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      lineItems: allLineItems,
      totalFees,
      exceptions: allExceptions,
      txnCount: body.transactions.length,
      rulesEvaluated,
      isTestRun: body.isTestRun ?? false,
      completedAt: new Date().toISOString(),
    }

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/evaluate]", err)
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const runId = new URL(req.url).searchParams.get("runId")
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 })

  const run = await prisma.evaluationRun.findUnique({
    where: { id: runId },
    include: {
      feeLineItems: true,
      exceptions: true,
    },
  })

  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })
  return NextResponse.json({ data: run })
}

// ─────────────────────────────────────────────
// FEE TYPE EVALUATION
// Handles period straddle: splits calculation at
// the effective-date boundary if a rate changes mid-period
// ─────────────────────────────────────────────

async function evaluateFeeType(params: {
  feeType: FeeType
  programId: string
  operatorId: string
  transactions: NormalizedTransaction[]
  periodStart: Date
  periodEnd: Date
  banner?: string
}): Promise<{
  lineItems: CalculatedFeeLineItem[]
  exceptions: EvaluationException[]
  rulesEvaluated: number
}> {
  const lineItems: CalculatedFeeLineItem[] = []
  const exceptions: EvaluationException[] = []

  // Detect period straddle
  const straddleDate = await detectPeriodStraddle({
    programId: params.programId,
    operatorId: params.operatorId,
    feeType: params.feeType,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  })

  // Build segments — split at straddle boundary if detected
  const segments: Array<{ start: Date; end: Date }> = straddleDate
    ? [
        { start: params.periodStart, end: new Date(straddleDate.getTime() - 86400000) },
        { start: straddleDate, end: params.periodEnd },
      ]
    : [{ start: params.periodStart, end: params.periodEnd }]

  if (straddleDate) {
    exceptions.push({
      exceptionType: "PERIOD_STRADDLE",
      severity: "INFO",
      message: `Rate change detected for ${params.feeType} on ${straddleDate.toISOString().split("T")[0]} — billing split at boundary`,
      context: { feeType: params.feeType, straddleDate },
    })
  }

  let rulesEvaluated = 0

  for (const segment of segments) {
    // Filter transactions to this segment's date range
    const segmentTxns = params.transactions.filter((t) => {
      const d = new Date(t.txnDate)
      return d >= segment.start && d <= segment.end
    })

    // Resolve rule for mid-point of segment
    const midpoint = new Date((segment.start.getTime() + segment.end.getTime()) / 2)
    const resolved = await resolveRule({
      programId: params.programId,
      operatorId: params.operatorId,
      feeType: params.feeType,
      date: midpoint,
      banner: params.banner,
    })

    if (!resolved) {
      exceptions.push({
        exceptionType: "NO_RULE_FOUND",
        severity: "WARNING",
        message: `No active rule found for fee type ${params.feeType} on ${midpoint.toISOString().split("T")[0]}`,
        context: { feeType: params.feeType, date: midpoint },
      })
      continue
    }

    rulesEvaluated++

    const { lineItem, exceptions: calcExceptions } = calculateFees({
      rule: resolved.rule,
      resolvedAt: resolved.resolvedAt,
      transactions: segmentTxns,
      lineStart: segment.start,
      lineEnd: segment.end,
      operatorId: params.operatorId,
    })

    if (lineItem) lineItems.push(lineItem)
    exceptions.push(...calcExceptions)
  }

  return { lineItems, exceptions, rulesEvaluated }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

async function persistLineItems(
  runId: string,
  billingPeriodId: string,
  operatorId: string,
  lineItems: CalculatedFeeLineItem[]
) {
  await prisma.feeLineItem.createMany({
    data: lineItems.map((li) => ({
      evaluationRunId: runId,
      billingPeriodId,
      programId: "", // TODO: pass through
      operatorId,
      ruleId: li.ruleId,
      ruleVersion: li.ruleVersion,
      feeType: li.feeType,
      feeBasis: li.feeBasis,
      label: li.label,
      lineStart: new Date(li.lineStart),
      lineEnd: new Date(li.lineEnd),
      qualifyingTxnCount: li.qualifyingTxnCount,
      qualifyingBasisAmt: li.qualifyingBasisAmt,
      rateApplied: li.rateApplied,
      rateType: li.rateType,
      grossFee: li.grossFee,
      capApplied: li.capApplied,
      capAmount: li.capAmount,
      floorApplied: li.floorApplied,
      calculatedFee: li.calculatedFee,
      exclusionsApplied: li.exclusionsApplied,
      evaluationTrace: li.trace as unknown as Prisma.InputJsonValue,
    })),
  })
}

async function getOrCreatePeriod(body: EvaluateInput): Promise<string> {
  const existing = await prisma.billingPeriod.findFirst({
    where: {
      programId: body.programId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
    },
  })
  if (existing) return existing.id

  const period = await prisma.billingPeriod.create({
    data: {
      programId: body.programId,
      operatorId: body.operatorId,
      periodStart: new Date(body.periodStart),
      periodEnd: new Date(body.periodEnd),
      isAdHoc: true,
      openedBy: "system",
    },
  })
  return period.id
}

function validateEvalInput(body: EvaluateInput): string[] {
  const errors: string[] = []
  if (!body.programId) errors.push("programId is required")
  if (!body.operatorId) errors.push("operatorId is required")
  if (!body.periodStart) errors.push("periodStart is required")
  if (!body.periodEnd) errors.push("periodEnd is required")
  if (!Array.isArray(body.transactions)) errors.push("transactions must be an array")
  if (body.periodStart && body.periodEnd && new Date(body.periodEnd) <= new Date(body.periodStart)) {
    errors.push("periodEnd must be after periodStart")
  }
  return errors
}
