// ============================================================
// POST /api/extract — submit contract docs for AI extraction
// GET  /api/extract?runId= — poll extraction run status
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"
import type { ExtractInput, AIExtractedRule, AIExtractedEntities } from "@/types"
import fs from "fs/promises"

const COMBINED_SYSTEM_PROMPT = `You are a billing rules extraction engine for a professional services firm that manages C-store loyalty programs.

Your job is to extract ALL of the following from the provided contract document(s):
1. Key program entities (brand, program name, operators, contract terms)
2. Every fee, rate, commission, reimbursement, and billing structure

Return a single JSON object with exactly this top-level shape:
{
  "entities": { ... },
  "rules": [ ... ]
}

── ENTITIES ──────────────────────────────────────────────────────────────────

The "entities" object must have this shape:
{
  "brandName": "Legal name of the client company / brand",
  "programName": "Name of the loyalty program (e.g. 'Casey's Rewards')",
  "platformName": "Loyalty technology platform name or null (e.g. 'Paytronix', 'Punchh')",
  "billingCycle": one of: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "QUARTERLY" | "AD_HOC" | "EVENT_DRIVEN" | null,
  "contractEffectiveFrom": "YYYY-MM-DD or null",
  "contractEffectiveTo": "YYYY-MM-DD or null",
  "billingTerms": "Human-readable description of payment terms e.g. 'Net 30 from invoice date'",
  "paymentTermsDays": number or null,
  "operators": [
    {
      "name": "Operator or retailer legal name",
      "banner": "Store banner name or null (e.g. 'Circle K')",
      "type": "franchisee" | "corporate" | "independent" | null,
      "billingEmail": "billing contact email or null",
      "sites": [
        {
          "externalId": "store/site ID from contract or null",
          "name": "site name or null",
          "address": "street address or null",
          "city": "city or null",
          "state": "2-letter state code or null",
          "dma": "DMA/market name or null",
          "fuelGrades": ["REG", "MID", "PREM", "DSL"] or null
        }
      ]
    }
  ],
  "confidence": 0.0 to 1.0,
  "reviewNotes": ["list any ambiguities or missing information"]
}

── RULES ──────────────────────────────────────────────────────────────────────

The "rules" array contains one object per fee structure:
{
  "feeType": one of the FeeType enum values,
  "feeBasis": one of the FeeBasis enum values,
  "rateType": "FLAT" | "PERCENTAGE" | "TIERED_FLAT" | "TIERED_PCT" | "FLAT_PLUS_PCT",
  "label": "human-readable name for this fee",
  "flatRate": number or null,
  "pctRate": decimal 0-1 or null (e.g. 50% = 0.50),
  "tiers": array of {thresholdFrom, thresholdTo, rate} or null,
  "flatComponent": number or null,
  "pctComponent": decimal 0-1 or null,
  "conditions": { fuelGrades?, offerTypes?, minBasketAmount?, minGallons?, banners?, dmas? } or null,
  "caps": { monthlyCap?, annualCap?, perSiteCap?, perTransactionCap? } or null,
  "floors": { monthlyFloor?, perUnitFloor? } or null,
  "exclusions": { categoryIds?, offerIds?, description? } or null,
  "effectiveFrom": "YYYY-MM-DD" or null,
  "effectiveTo": "YYYY-MM-DD" or null,
  "contractRef": "section/clause reference e.g. §4.2, Exhibit B",
  "sourceText": "verbatim sentence(s) from the contract that define this fee",
  "governingDocument": "filename or document type this came from",
  "confidence": 0.0 to 1.0,
  "needsReview": true if confidence < 0.80 or language is ambiguous,
  "reviewNote": "explanation of ambiguity if needsReview is true"
}

FeeType values: CPG_FUEL_DISCOUNT, MERCH_OFFER_ISSUANCE, POINTS_EARN, COUPON_PUSH,
CPG_FUEL_REDEMPTION, MERCH_REDEMPTION, TICKET_BASKET, POINTS_REDEMPTION, STORED_VALUE,
ACTIVE_SITE_FEE, PER_TRANSACTION_FEE, MEMBER_ENROLLMENT, ACTIVE_MEMBER_FEE,
PROGRAM_MANAGEMENT, TECHNOLOGY_PLATFORM, DATA_ANALYTICS, CAMPAIGN_CONTENT, INTEGRATION_ONBOARDING,
FUEL_MARGIN_LIFT, BASKET_SPEND_LIFT, COMPETITIVE_MARKET_PREMIUM, MARKET_DEVELOPMENT_FUND

FeeBasis values: GALLONS_DISPENSED, GALLONS_PURCHASED, DISCOUNT_VALUE_ISSUED, DISCOUNT_VALUE_REDEEMED,
BASKET_AMOUNT, SPEND_AMOUNT, POINTS_ISSUED, POINTS_REDEEMED, SITE_COUNT, TRANSACTION_COUNT,
MEMBER_COUNT, FLAT_PERIOD, CAMPAIGN_COUNT, ASSET_COUNT

Rules:
- If a rate is stated as a range, use the midpoint and set needsReview: true
- If a rate references a separate schedule not provided, set confidence: 0.3 and needsReview: true
- Do NOT infer or guess rates that are not explicitly stated
- Return ONLY the JSON object — no commentary, no markdown fences`

export async function POST(req: NextRequest) {
  try {
    const body: ExtractInput = await req.json()
    const createdBy = req.headers.get("x-user-id") ?? "system"

    if (!body.documentIds?.length) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 })
    }

    if (!body.dryRun && !body.programId) {
      return NextResponse.json({ error: "programId is required when dryRun is false" }, { status: 400 })
    }

    const documents = await prisma.contractDocument.findMany({
      where: { id: { in: body.documentIds } },
    })

    if (documents.length === 0) {
      return NextResponse.json({ error: "No documents found" }, { status: 404 })
    }

    // Only create ExtractionRun for non-dry runs
    const run = body.dryRun ? null : await prisma.extractionRun.create({
      data: {
        programId: body.programId!,
        status: "PROCESSING",
        documentIds: body.documentIds,
        modelUsed: "claude-sonnet-4-20250514",
        createdBy,
        startedAt: new Date(),
        documents: { connect: documents.map((d) => ({ id: d.id })) },
      },
    })

    // Build content blocks for Claude
    const documentContent: Array<{ type: string; text?: string; source?: object }> = []

    for (const doc of documents) {
      try {
        const fileBuffer = await fs.readFile(doc.storagePath)
        const base64 = fileBuffer.toString("base64")

        documentContent.push({
          type: "text",
          text: `Document: ${doc.fileName} (Type: ${doc.documentType}, Effective: ${doc.effectiveDate?.toISOString().split("T")[0] ?? "unknown"})`,
        })

        if (doc.fileName.toLowerCase().endsWith(".pdf")) {
          documentContent.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          })
        } else {
          documentContent.push({ type: "text", text: fileBuffer.toString("utf-8") })
        }
      } catch {
        documentContent.push({
          type: "text",
          text: `[Could not read document: ${doc.fileName}]`,
        })
      }
    }

    documentContent.push({
      type: "text",
      text: "Extract the program entities and all billing rules from the above documents. Return a single JSON object with 'entities' and 'rules' keys.",
    })

    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: COMBINED_SYSTEM_PROMPT,
        messages: [{ role: "user", content: documentContent }],
      }),
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      if (run) {
        await prisma.extractionRun.update({
          where: { id: run.id },
          data: { status: "FAILED", errorMessage: `Claude API error ${apiResponse.status}`, completedAt: new Date() },
        })
      }
      throw new Error(`Claude API error ${apiResponse.status}: ${errText}`)
    }

    const apiData = await apiResponse.json()
    const rawText = apiData.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")

    let parsed: { entities: AIExtractedEntities; rules: AIExtractedRule[] }
    try {
      const clean = rawText.replace(/```json|```/g, "").trim()
      parsed = JSON.parse(clean)
      if (!parsed.entities || !Array.isArray(parsed.rules)) throw new Error("Missing entities or rules")
    } catch {
      if (run) {
        await prisma.extractionRun.update({
          where: { id: run.id },
          data: { status: "FAILED", errorMessage: "Failed to parse AI response", completedAt: new Date() },
        })
      }
      return NextResponse.json({ error: "AI returned unparseable response" }, { status: 500 })
    }

    const { entities, rules: extractedRules } = parsed
    const needsReviewCount = extractedRules.filter((r) => r.needsReview).length

    // In dryRun mode, return extracted data without persisting
    if (body.dryRun) {
      return NextResponse.json({
        data: {
          entities,
          rules: extractedRules,
          rulesFound: extractedRules.length,
          rulesNeedReview: needsReviewCount,
        },
      })
    }

    // Persist rules for normal extraction flow
    const createdRules = await Promise.all(
      extractedRules.map((r) =>
        prisma.billingRule.create({
          data: {
            programId: body.programId!,
            label: r.label,
            feeType: r.feeType,
            feeBasis: r.feeBasis,
            rateType: r.rateType,
            flatRate: r.flatRate,
            pctRate: r.pctRate,
            tiers: r.tiers ? (r.tiers as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            flatComponent: r.flatComponent,
            pctComponent: r.pctComponent,
            conditions: r.conditions ? (r.conditions as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            caps: r.caps ? (r.caps as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            floors: r.floors ? (r.floors as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            exclusions: r.exclusions ? (r.exclusions as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : new Date(),
            effectiveTo: r.effectiveTo ? new Date(r.effectiveTo) : null,
            contractRef: r.contractRef,
            sourceText: r.sourceText,
            reviewNote: r.reviewNote,
            confidence: r.confidence,
            source: "AI_PARSED",
            status: r.needsReview ? "NEEDS_REVIEW" : "DRAFT",
            createdBy: "ai_extractor",
          },
        })
      )
    )

    await prisma.extractionRun.update({
      where: { id: run!.id },
      data: {
        status: "COMPLETE",
        rulesFound: extractedRules.length,
        rulesNeedReview: needsReviewCount,
        promptTokens: apiData.usage?.input_tokens,
        completionTokens: apiData.usage?.output_tokens,
        completedAt: new Date(),
      },
    })

    return NextResponse.json(
      {
        data: {
          runId: run!.id,
          status: "COMPLETE",
          rulesFound: extractedRules.length,
          rulesNeedReview: needsReviewCount,
          ruleIds: createdRules.map((r) => r.id),
          rules: extractedRules,
          entities,
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/extract]", err)
    return NextResponse.json({ error: "Extraction failed", detail: String(err) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const runId = new URL(req.url).searchParams.get("runId")
  if (!runId) return NextResponse.json({ error: "runId required" }, { status: 400 })

  const run = await prisma.extractionRun.findUnique({ where: { id: runId } })
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 })

  const rules = await prisma.billingRule.findMany({
    where: { programId: run.programId, source: "AI_PARSED", createdBy: "ai_extractor" },
    orderBy: { createdAt: "desc" },
    take: run.rulesFound,
  })

  return NextResponse.json({ data: { run, rules } })
}
