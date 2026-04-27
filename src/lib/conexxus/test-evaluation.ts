import { SAMPLE_CONEXXUS_TRANSACTIONS } from "./sample-transactions"
import { normalizeConexusTxn } from "./normalizer"
import { EvaluateInput, EvaluationResult } from "@/types"

const BASE_URL = "http://localhost:3000"
const PROGRAM_ID = "prog-fuel-rewards-001"
const OPERATOR_ID = "op-meridian-001"
const PERIOD_START = "2026-04-01T00:00:00.000Z"
const PERIOD_END = "2026-04-30T23:59:59.999Z"

const SEP = "─".repeat(60)

async function runTestEvaluation() {
  const transactions = SAMPLE_CONEXXUS_TRANSACTIONS.map(normalizeConexusTxn)

  console.log(`Normalized ${transactions.length} Conexxus transactions`)
  console.log()

  const payload: EvaluateInput = {
    programId: PROGRAM_ID,
    operatorId: OPERATOR_ID,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    transactions,
    isTestRun: true,
  }

  console.log(`POST ${BASE_URL}/api/evaluate`)
  console.log(`  Program:      ${PROGRAM_ID}`)
  console.log(`  Operator:     ${OPERATOR_ID}`)
  console.log(`  Period:       April 2026`)
  console.log(`  Transactions: ${transactions.length}`)
  console.log(`  Test run:     true`)
  console.log()

  const res = await fetch(`${BASE_URL}/api/evaluate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error(`Error ${res.status}: ${body}`)
    process.exit(1)
  }

  const { data: result }: { data: EvaluationResult } = await res.json()

  console.log("=".repeat(60))
  console.log("EVALUATION RESULTS")
  console.log("=".repeat(60))
  console.log(`Run ID:          ${result.runId}`)
  console.log(`Transactions:    ${result.txnCount}`)
  console.log(`Rules evaluated: ${result.rulesEvaluated}`)
  console.log(`Total fees:      $${result.totalFees.toFixed(2)}`)
  console.log(`Completed:       ${result.completedAt}`)
  console.log()

  if (result.lineItems.length === 0) {
    console.log("No fee line items returned.")
  } else {
    console.log("FEE LINE ITEMS")
    console.log(SEP)
    for (const item of result.lineItems) {
      console.log(`Label:              ${item.label}`)
      console.log(`  Fee type:         ${item.feeType}  (basis: ${item.feeBasis})`)
      console.log(`  Qualifying txns:  ${item.qualifyingTxnCount}`)
      console.log(`  Basis amount:     ${item.qualifyingBasisAmt.toFixed(4)}`)
      console.log(`  Rate type:        ${item.rateType}`)
      console.log(`  Rate applied:     ${item.rateApplied}`)
      console.log(`  Gross fee:        $${item.grossFee.toFixed(2)}`)
      if (item.capApplied)   console.log(`  Cap applied:      $${item.capAmount?.toFixed(2)}`)
      if (item.floorApplied) console.log(`  Floor applied:    yes`)
      console.log(`  Calculated fee:   $${item.calculatedFee.toFixed(2)}`)
      console.log(SEP)
    }
  }

  if (result.exceptions.length > 0) {
    console.log()
    console.log("EXCEPTIONS")
    console.log(SEP)
    for (const ex of result.exceptions) {
      console.log(`[${ex.severity}] ${ex.exceptionType}: ${ex.message}`)
    }
  }
}

runTestEvaluation().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
