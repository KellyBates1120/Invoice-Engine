// ============================================================
// POST /api/contracts/onboard
// Creates Brand, Program, Operators, Sites, BillingRules
// from AI-extracted entities in a single transaction.
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma, BillingCycle } from "@prisma/client"
import type { OnboardInput } from "@/types"

const VALID_BILLING_CYCLES = new Set<string>(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "AD_HOC", "EVENT_DRIVEN"])

export async function POST(req: NextRequest) {
  try {
    const body: OnboardInput = await req.json()
    const createdBy = (req.headers.get("x-user-id") ?? body.createdBy) || "system"

    if (!body.entities?.brandName) {
      return NextResponse.json({ error: "entities.brandName is required" }, { status: 400 })
    }
    if (!body.entities?.programName) {
      return NextResponse.json({ error: "entities.programName is required" }, { status: 400 })
    }

    const billingCycle: BillingCycle = (
      body.entities.billingCycle && VALID_BILLING_CYCLES.has(body.entities.billingCycle)
        ? body.entities.billingCycle
        : "MONTHLY"
    ) as BillingCycle

    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create Brand
      let brand = await tx.brand.findFirst({
        where: { name: { equals: body.entities.brandName, mode: "insensitive" } },
      })
      if (!brand) {
        brand = await tx.brand.create({ data: { name: body.entities.brandName } })
      }

      // 2. Create Program
      const program = await tx.program.create({
        data: {
          name: body.entities.programName,
          brandId: brand.id,
          status: "ONBOARDING",
          billingCycle,
          platformName: body.entities.platformName ?? null,
          notes: body.entities.billingTerms
            ? `Payment terms: ${body.entities.billingTerms}`
            : null,
        },
      })

      // 3. Create Operators, Enrollments, Sites
      const operatorIds: string[] = []

      for (const op of body.entities.operators ?? []) {
        let operator = await tx.operator.findFirst({
          where: { name: { equals: op.name, mode: "insensitive" } },
        })
        if (!operator) {
          operator = await tx.operator.create({
            data: {
              name: op.name,
              banner: op.banner ?? null,
              type: op.type ?? null,
              billingEmail: op.billingEmail ?? null,
            },
          })
        }

        // Create enrollment (skip if already enrolled)
        const existing = await tx.operatorEnrollment.findUnique({
          where: { operatorId_programId: { operatorId: operator.id, programId: program.id } },
        })
        if (!existing) {
          await tx.operatorEnrollment.create({
            data: {
              operatorId: operator.id,
              programId: program.id,
              activeFrom: body.entities.contractEffectiveFrom
                ? new Date(body.entities.contractEffectiveFrom)
                : new Date(),
              activeTo: body.entities.contractEffectiveTo
                ? new Date(body.entities.contractEffectiveTo)
                : null,
            },
          })
        }

        for (const site of op.sites ?? []) {
          await tx.site.create({
            data: {
              operatorId: operator.id,
              externalId: site.externalId ?? null,
              name: site.name ?? null,
              address: site.address ?? null,
              city: site.city ?? null,
              state: site.state ?? null,
              dma: site.dma ?? null,
              fuelGrades: site.fuelGrades ?? [],
            },
          })
        }

        operatorIds.push(operator.id)
      }

      // 4. Create BillingRules
      const ruleIds: string[] = []

      for (const r of body.rules ?? []) {
        const rule = await tx.billingRule.create({
          data: {
            programId: program.id,
            label: r.label,
            feeType: r.feeType,
            feeBasis: r.feeBasis,
            rateType: r.rateType,
            flatRate: r.flatRate ?? null,
            pctRate: r.pctRate ?? null,
            tiers: r.tiers ? (r.tiers as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            flatComponent: r.flatComponent ?? null,
            pctComponent: r.pctComponent ?? null,
            conditions: r.conditions ? (r.conditions as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            caps: r.caps ? (r.caps as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            floors: r.floors ? (r.floors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            exclusions: r.exclusions ? (r.exclusions as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            effectiveFrom: r.effectiveFrom
              ? new Date(r.effectiveFrom)
              : body.entities.contractEffectiveFrom
                ? new Date(body.entities.contractEffectiveFrom)
                : new Date(),
            effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
            contractRef: r.contractRef ?? null,
            sourceText: r.sourceText ?? null,
            reviewNote: r.reviewNote ?? null,
            confidence: r.confidence,
            source: "AI_PARSED",
            status: r.needsReview ? "NEEDS_REVIEW" : "DRAFT",
            createdBy: createdBy,
          },
        })
        ruleIds.push(rule.id)
      }

      // 5. Link uploaded documents to the new program
      if (body.documentIds?.length) {
        await tx.contractDocument.updateMany({
          where: { id: { in: body.documentIds } },
          data: { programId: program.id },
        })
      }

      return { brandId: brand.id, programId: program.id, operatorIds, ruleIds }
    })

    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/contracts/onboard]", err)
    return NextResponse.json({ error: "Onboarding failed", detail: String(err) }, { status: 500 })
  }
}
