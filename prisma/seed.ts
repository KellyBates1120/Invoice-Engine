// ============================================================
// Seed: Creates test data for local dev
// Usage: npm run db:seed
// ============================================================

import { PrismaClient, Prisma, FeeType, FeeBasis, RateType, RuleSource } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding loyalty billing database...")

  // ── Brand ──────────────────────────────────────
  const brand = await prisma.brand.upsert({
    where: { externalId: "brand-fuel-corp-001" },
    update: {},
    create: {
      name: "Fuel Corp Americas",
      externalId: "brand-fuel-corp-001",
    },
  })

  // ── Program ─────────────────────────────────────
  const program = await prisma.program.upsert({
    where: { id: "prog-fuel-rewards-001" },
    update: {},
    create: {
      id: "prog-fuel-rewards-001",
      name: "Fuel Rewards",
      brandId: brand.id,
      status: "ACTIVE",
      billingCycle: "MONTHLY",
      platformName: "Paytronix",
    },
  })

  // ── Operator ────────────────────────────────────
  const operator = await prisma.operator.upsert({
    where: { externalId: "op-meridian-001" },
    update: {},
    create: {
      name: "Meridian Fuel & Convenience",
      externalId: "op-meridian-001",
      banner: "Circle K",
      type: "franchisee",
      billingEmail: "billing@meridianfuel.com",
    },
  })

  // Enroll operator in program
  await prisma.operatorEnrollment.upsert({
    where: { operatorId_programId: { operatorId: operator.id, programId: program.id } },
    update: {},
    create: { operatorId: operator.id, programId: program.id },
  })

  // ── Sites ───────────────────────────────────────
  const sites = await Promise.all([
    prisma.site.upsert({
      where: { id: "site-001" },
      update: {},
      create: {
        id: "site-001",
        externalId: "MER-001",
        operatorId: operator.id,
        name: "Meridian #001 - Dallas",
        city: "Dallas", state: "TX",
        dma: "Dallas-Fort Worth",
        banner: "Circle K",
        fuelGrades: ["REG", "MID", "PREM"],
      },
    }),
    prisma.site.upsert({
      where: { id: "site-002" },
      update: {},
      create: {
        id: "site-002",
        externalId: "MER-002",
        operatorId: operator.id,
        name: "Meridian #002 - Houston",
        city: "Houston", state: "TX",
        dma: "Houston",
        banner: "Circle K",
        fuelGrades: ["REG", "PREM"],
      },
    }),
  ])

  // ── Billing Rules ────────────────────────────────
  // Rule 1: CPG Fuel Discount — tiered by volume
  const cpgRule = await prisma.billingRule.upsert({
    where: { id: "rule-cpg-fuel-001" },
    update: {},
    create: {
      id: "rule-cpg-fuel-001",
      programId: program.id,
      label: "Regular CPG Fuel Discount — Tiered",
      feeType: "CPG_FUEL_DISCOUNT",
      feeBasis: "GALLONS_DISPENSED",
      rateType: "TIERED_FLAT",
      tiers: [
        { thresholdFrom: 0, thresholdTo: 499999, rate: 0.10 },
        { thresholdFrom: 500000, thresholdTo: null, rate: 0.08 },
      ],
      conditions: { fuelGrades: ["REG", "MID"] },
      caps: { monthlyCap: 50000 },
      floors: { monthlyFloor: 500 },
      exclusions: Prisma.JsonNull,
      scopeLevel: "PROGRAM",
      effectiveFrom: new Date("2024-01-01"),
      status: "ACTIVE",
      source: "AI_PARSED",
      confidence: 0.91,
      contractRef: "§4.2, Exhibit B",
      sourceText: 'Operator shall reimburse Provider for fuel discounts at the rate specified in Schedule A, based on actual gallons dispensed per grade.',
      version: 1,
      createdBy: "ai_extractor",
      approvedBy: "analyst@company.com",
      approvedAt: new Date("2024-01-05"),
      activatedAt: new Date("2024-01-05"),
    },
  })

  // Rule 2: Merch discount reimbursement
  await prisma.billingRule.upsert({
    where: { id: "rule-merch-001" },
    update: {},
    create: {
      id: "rule-merch-001",
      programId: program.id,
      label: "Merchandise Discount Reimbursement",
      feeType: "MERCH_OFFER_ISSUANCE",
      feeBasis: "DISCOUNT_VALUE_ISSUED",
      rateType: "PERCENTAGE",
      pctRate: 0.50,
      conditions: Prisma.JsonNull,
      caps: { perTransactionCap: 5.00 },
      exclusions: { description: "Tobacco, Alcohol, Lottery" },
      scopeLevel: "PROGRAM",
      effectiveFrom: new Date("2024-01-01"),
      status: "ACTIVE",
      source: "AI_PARSED",
      confidence: 0.88,
      contractRef: "§5.1",
      version: 1,
      createdBy: "ai_extractor",
      approvedBy: "analyst@company.com",
      approvedAt: new Date("2024-01-05"),
      activatedAt: new Date("2024-01-05"),
    },
  })

  // Rule 3: Platform fee
  await prisma.billingRule.upsert({
    where: { id: "rule-platform-001" },
    update: {},
    create: {
      id: "rule-platform-001",
      programId: program.id,
      label: "Monthly Platform Fee",
      feeType: "TECHNOLOGY_PLATFORM",
      feeBasis: "FLAT_PERIOD",
      rateType: "FLAT_PLUS_PCT",
      flatComponent: 2500.00,
      pctComponent: 0,
      conditions: Prisma.JsonNull,
      caps: Prisma.JsonNull,
      scopeLevel: "PROGRAM",
      effectiveFrom: new Date("2024-01-01"),
      status: "ACTIVE",
      source: "AI_PARSED",
      confidence: 0.95,
      contractRef: "§3, Exhibit A",
      version: 1,
      createdBy: "ai_extractor",
      approvedBy: "analyst@company.com",
      approvedAt: new Date("2024-01-05"),
      activatedAt: new Date("2024-01-05"),
    },
  })

  // Rule 4: Points redemption — NEEDS_REVIEW (low confidence)
  await prisma.billingRule.upsert({
    where: { id: "rule-points-001" },
    update: {},
    create: {
      id: "rule-points-001",
      programId: program.id,
      label: "Points Redemption Cost",
      feeType: "POINTS_REDEMPTION",
      feeBasis: "POINTS_REDEEMED",
      rateType: "FLAT",
      flatRate: 0.0080,
      conditions: Prisma.JsonNull,
      caps: Prisma.JsonNull,
      scopeLevel: "PROGRAM",
      effectiveFrom: new Date("2024-01-01"),
      status: "NEEDS_REVIEW",
      source: "AI_PARSED",
      confidence: 0.72,
      reviewNote: "Contract references 'cost schedule C' which was not provided. Rate of $0.008/pt assumed from market standard — must confirm.",
      contractRef: "§6, Exhibit C",
      version: 1,
      createdBy: "ai_extractor",
    },
  })

  // ── Billing period ───────────────────────────────
  await prisma.billingPeriod.upsert({
    where: { id: "period-apr-2026" },
    update: {},
    create: {
      id: "period-apr-2026",
      programId: program.id,
      periodStart: new Date("2026-04-01"),
      periodEnd: new Date("2026-04-30"),
      status: "COLLECTING",
      openedBy: "system",
    },
  })

  console.log("✅ Seed complete")
  console.log(`   Brand:    ${brand.name}`)
  console.log(`   Program:  ${program.name}`)
  console.log(`   Operator: ${operator.name}`)
  console.log(`   Sites:    ${sites.length}`)
  console.log(`   Rules:    4 (3 active, 1 needs review)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
