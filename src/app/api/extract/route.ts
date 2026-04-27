// ============================================================
// POST /api/extract — submit contract docs for AI extraction
// GET  /api/extract?runId= — poll extraction run status
// ============================================================

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { Prisma } from "@prisma/client"
import type { ExtractInput, AIExtractedRule, CreateRuleInput } from "@/types"
import fs from "fs/promises"

const EXTRACTION_SYSTEM_PROMPT = `You are a billing rules extraction engine for a professional services firm that manages C-store loyalty programs.

Your job is to extract every fee, rate, commission, reimbursement, and billing structure from the provided contract document(s).

For each fee structure found, return a JSON object with this exact shape:
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
- If a rate is stated as a range ("0.05 to 0.15"), use the midpoint and set needsReview: true
- If a rate references a separate schedule not provided, set confidence: 0.3 and needsReview: true
- Do NOT infer or guess rates that are not explicitly stated
- For multi-document sets, note which document governs each clause in governingDocument
- Return ONLY a JSON array of rule objects — no commentary, no markdown fences`

export async function POST(req: NextRequest) {
  try {
    const body: ExtractInput = await req.json()
    const createdBy = req.headers.get("x-user-id") ?? "system"

    if (!body.programId) {
      return NextResponse.json({ error: "programId is required" }, { status: 400 })
    }
    if (!body.documentIds?.length) {
      return NextResponse.json({ error: "documentIds required" }, { status: 400 })
    }

    // Fetch documents
    const documents = await prisma.contractDocument.findMany({
      where: { id: { in: body.documentIds } },
    })

    if (documents.length === 0) {
      return NextResponse.json({ error: "No documents found" }, { status: 404 })
    }

    // Create extraction run
    const run = await prisma.extractionRun.create({
      data: {
        programId: body.programId,
        status: "PROCESSING",
        documentIds: body.documentIds,
        modelUsed: "claude-sonnet-4-20250514",
        createdBy,
        startedAt: new Date(),
        documents: { connect: documents.map((d) => ({ id: d.id })) },
      },
    })

    // Build content for Claude — each document as a separate message block
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
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          })
        } else {
          // Plain text fallback
          documentContent.push({
            type: "text",
            text: fileBuffer.toString("utf-8"),
          })
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
      text: "Extract all billing rules from the above documents and return a JSON array.",
    })

    // Call Claude API
    const apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: EXTRACTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: documentContent }],
      }),
    })

    if (!apiResponse.ok) {
      const errText = await apiResponse.text()
      throw new Error(`Claude API error ${apiResponse.status}: ${errText}`)
    }

    const apiData = await apiResponse.json()
    const rawText = apiData.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("")

    // Parse extracted rules
    let extractedRules: AIExtractedRule[] = []
    try {
      const clean = rawText.replace(/```json|```/g, "").trim()
      extractedRules = JSON.parse(clean)
    } catch {
      await prisma.extractionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          errorMessage: "Failed to parse AI response as JSON",
          completedAt: new Date(),
        },
      })
      return NextResponse.json({ error: "AI returned unparseable response" }, { status: 500 })
    }

    const needsReviewCount = extractedRules.filter((r) => r.needsReview).length

    // Save extracted rules as DRAFT BillingRules
    const createdRules = await Promise.all(
      extractedRules.map((r) =>
        prisma.billingRule.create({
          data: {
            programId: body.programId,
            label: r.label,
            feeType: r.feeType,
            feeBasis: r.feeBasis,
            rateType: r.rateType,
            flatRate: r.flatRate,
            pctRate: r.pctRate,
            tiers: r.tiers ?? Prisma.JsonNull,
            flatComponent: r.flatComponent,
            pctComponent: r.pctComponent,
            conditions: r.conditions ?? Prisma.JsonNull,
            caps: r.caps ?? Prisma.JsonNull,
            floors: r.floors ?? Prisma.JsonNull,
            exclusions: r.exclusions ?? Prisma.JsonNull,
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

    // Update run
    await prisma.extractionRun.update({
      where: { id: run.id },
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
          runId: run.id,
          status: "COMPLETE",
          rulesFound: extractedRules.length,
          rulesNeedReview: needsReviewCount,
          ruleIds: createdRules.map((r) => r.id),
          rules: extractedRules,
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
