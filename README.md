# Loyalty Billing Platform — POC

Rules engine + fee model builder for C-store loyalty program billing.  
**Stack:** Next.js 14 · TypeScript · PostgreSQL · Prisma · Claude API

---

## Quick start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally
- Anthropic API key (for `/api/extract`)

### 1. Clone and install
```bash
git clone <your-repo>
cd loyalty-billing
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and ANTHROPIC_API_KEY
```

### 3. Set up the database
```bash
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations (creates tables)
npm run db:seed       # Seed with test data
```

### 4. Start dev server
```bash
npm run dev
# → http://localhost:3000
```

### 5. Explore the data
```bash
npm run db:studio     # Opens Prisma Studio at http://localhost:5555
```

---

## Project structure

```
src/
├── app/
│   └── api/
│       ├── rules/            GET list, POST create
│       │   └── [id]/
│       │       ├── route.ts         GET detail, PUT update
│       │       ├── activate/        POST activate
│       │       ├── supersede/       POST create new version
│       │       └── clone/           POST copy to another program
│       ├── evaluate/         POST run rules engine, GET run status
│       ├── extract/          POST AI contract extraction
│       └── periods/          GET/POST billing periods
├── lib/
│   ├── db/prisma.ts          Prisma client singleton
│   └── rules/
│       ├── resolver.ts       Scope hierarchy resolution
│       └── calculator.ts     Fee calculation engine
└── types/index.ts            All TypeScript types
prisma/
├── schema.prisma             Full data model
└── seed.ts                   Dev seed data
```

---

## API reference

### Rules

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rules` | List rules. Query: `programId`, `feeType`, `status`, `operatorId`, `asOf` |
| `POST` | `/api/rules` | Create a draft rule |
| `GET` | `/api/rules/:id` | Get rule + version history + audit log |
| `PUT` | `/api/rules/:id` | Update a DRAFT or NEEDS_REVIEW rule |
| `POST` | `/api/rules/:id/activate` | Lock and activate a rule |
| `POST` | `/api/rules/:id/supersede` | Create new version of an ACTIVE rule |
| `POST` | `/api/rules/:id/clone` | Copy rule to another program as draft |

### Evaluation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/evaluate` | Run rules engine against a transaction set |
| `GET` | `/api/evaluate?runId=` | Get evaluation run status + results |

**Evaluate payload:**
```json
{
  "programId": "prog-fuel-rewards-001",
  "operatorId": "op-meridian-001",
  "periodStart": "2026-04-01T00:00:00Z",
  "periodEnd": "2026-04-30T23:59:59Z",
  "isTestRun": true,
  "transactions": [
    {
      "id": "txn-001",
      "siteId": "site-001",
      "txnDate": "2026-04-15T10:30:00Z",
      "txnType": "fuel",
      "loyaltyFlag": true,
      "gallonQty": 12.5,
      "fuelGrade": "REG"
    }
  ]
}
```

### AI Extraction

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/extract` | Submit contract documents for AI rule extraction |
| `GET` | `/api/extract?runId=` | Poll extraction run status |

### Billing Periods

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/periods` | List periods. Query: `programId`, `status` |
| `POST` | `/api/periods` | Open a new billing period |

---

## Rule scope resolution

When evaluating a fee type for an operator, the engine walks this hierarchy
and returns the **most specific** matching rule:

```
OPERATOR  (operator-specific override)
    ↓ fallback
BANNER    (all operators under a banner, e.g. "Circle K")
    ↓ fallback
MARKET    (all sites in a DMA)
    ↓ fallback
PROGRAM   (default for all operators in the program)
```

---

## Period straddle handling

If a rule's effective date falls within a billing period, the engine
automatically splits the calculation:

```
Period: Apr 1 → Apr 30
Rate change: Apr 15 (amendment effective)

→ Line item 1: Apr 1–14  @ old rate
→ Line item 2: Apr 15–30 @ new rate
→ Exception: PERIOD_STRADDLE (INFO)
```

---

## Next steps (Phase 2)

- [ ] Platform schema mapping UI (`/api/schemas`, `/api/imports`)
- [ ] Linksquares webhook integration (`/api/integrations/linksquares/webhook`)
- [ ] Rule configuration UI (Next.js pages)
- [ ] AI extraction review UI
- [ ] Invoice generation from approved fee line items

---

## Validation via seed data

After seeding, test the evaluation engine:

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "programId": "prog-fuel-rewards-001",
    "operatorId": "op-meridian-001",
    "periodStart": "2026-04-01T00:00:00Z",
    "periodEnd": "2026-04-30T23:59:59Z",
    "isTestRun": true,
    "transactions": [
      { "id": "t1", "siteId": "site-001", "txnDate": "2026-04-10T09:00:00Z",
        "txnType": "fuel", "loyaltyFlag": true, "gallonQty": 450000, "fuelGrade": "REG" },
      { "id": "t2", "siteId": "site-001", "txnDate": "2026-04-20T14:00:00Z",
        "txnType": "merch", "loyaltyFlag": true, "discountAmount": 3.50, "discountType": "merch_offer" }
    ]
  }'
```

Expected: CPG Fuel line item at `$0.10/gal × 450,000 = $45,000` (under $50K cap),  
Merch line item at `50% × $3.50 = $1.75`.
