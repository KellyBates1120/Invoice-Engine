"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Stack from "@mui/material/Stack"
import Stepper from "@mui/material/Stepper"
import Step from "@mui/material/Step"
import StepLabel from "@mui/material/StepLabel"
import CircularProgress from "@mui/material/CircularProgress"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Chip from "@mui/material/Chip"
import Alert from "@mui/material/Alert"
import IconButton from "@mui/material/IconButton"
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined"
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined"
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined"
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined"

// ─── Types ───────────────────────────────────────
interface Program { id: string; name: string; status: string }

interface FileEntry {
  file: File
  documentType: "MSA" | "AMENDMENT" | "EXHIBIT" | "SOW" | "RATE_SCHEDULE"
  effectiveDate: string
}

interface ExtractedRule {
  feeType: string
  rateType: string
  label: string
  flatRate?: number
  pctRate?: number
  flatComponent?: number
  pctComponent?: number
  tiers?: unknown[]
  confidence: number
  needsReview: boolean
  reviewNote?: string
  contractRef?: string
}

interface ExtractionResult {
  runId: string
  rulesFound: number
  rulesNeedReview: number
  rules: ExtractedRule[]
  ruleIds: string[]
}

// ─── Constants ───────────────────────────────────
const STEPS = ["Select program", "Upload documents", "Extract", "Review results"]

const DOC_TYPES = ["MSA", "AMENDMENT", "EXHIBIT", "SOW", "RATE_SCHEDULE"] as const

const PROGRESS_MESSAGES = [
  "Reading contract documents...",
  "Identifying fee structures...",
  "Analyzing rate schedules...",
  "Building rule drafts...",
  "Validating extracted data...",
  "Finalizing results...",
]

const FEE_TYPE_LABELS: Record<string, string> = {
  CPG_FUEL_DISCOUNT: "CPG fuel discount",
  MERCH_OFFER_ISSUANCE: "Merch discount",
  POINTS_EARN: "Points earn",
  COUPON_PUSH: "Coupon push",
  CPG_FUEL_REDEMPTION: "CPG fuel redemption",
  MERCH_REDEMPTION: "Merch redemption",
  TICKET_BASKET: "Ticket / basket",
  POINTS_REDEMPTION: "Points redemption",
  ACTIVE_SITE_FEE: "Active site fee",
  PER_TRANSACTION_FEE: "Per-transaction fee",
  MEMBER_ENROLLMENT: "Member enrollment",
  ACTIVE_MEMBER_FEE: "Active member fee",
  PROGRAM_MANAGEMENT: "Program management",
  TECHNOLOGY_PLATFORM: "Technology platform",
  DATA_ANALYTICS: "Data & analytics",
  CAMPAIGN_CONTENT: "Campaign / content",
  INTEGRATION_ONBOARDING: "Integration & onboarding",
  FUEL_MARGIN_LIFT: "Fuel margin lift",
  BASKET_SPEND_LIFT: "Basket spend lift",
  COMPETITIVE_MARKET_PREMIUM: "Competitive market premium",
  MARKET_DEVELOPMENT_FUND: "Market development fund",
}

// ─── Helpers ─────────────────────────────────────
function formatRate(rule: ExtractedRule): string {
  if (rule.rateType === "FLAT" && rule.flatRate != null) return `$${rule.flatRate}`
  if (rule.rateType === "PERCENTAGE" && rule.pctRate != null)
    return `${(rule.pctRate * 100).toFixed(2)}%`
  if (rule.rateType === "FLAT_PLUS_PCT") {
    const f = rule.flatComponent != null ? `$${rule.flatComponent.toLocaleString()}` : ""
    const p = rule.pctComponent != null ? ` + ${(rule.pctComponent * 100).toFixed(2)}%` : ""
    return `${f}${p}`
  }
  if (rule.tiers && (rule.tiers as unknown[]).length > 0) return "Tiered"
  return "—"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function confidenceColor(c: number): string {
  if (c >= 0.9) return "#2E7D32"
  if (c >= 0.8) return "#185FA5"
  return "#BA7517"
}

// ─── Page ─────────────────────────────────────────
export default function ContractUploadPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [programs, setPrograms] = useState<Program[]>([])
  const [programId, setProgramId] = useState("")
  const [files, setFiles] = useState<FileEntry[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [progressMsg, setProgressMsg] = useState(PROGRESS_MESSAGES[0])
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch("/api/programs")
      .then((r) => r.json())
      .then((d) => setPrograms(d.data ?? []))
      .catch(() => {})
  }, [])

  const addFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    )
    setFiles((prev) => [
      ...prev,
      ...pdfs.map((f) => ({ file: f, documentType: "MSA" as const, effectiveDate: "" })),
    ])
  }, [])

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const updateFile = (idx: number, patch: Partial<FileEntry>) =>
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))

  const handleExtract = async () => {
    setStep(2)
    setError(null)
    let msgIdx = 0
    intervalRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROGRESS_MESSAGES.length
      setProgressMsg(PROGRESS_MESSAGES[msgIdx])
    }, 2500)

    try {
      // Upload each file and collect document IDs
      const docIds: string[] = []
      for (const entry of files) {
        const form = new FormData()
        form.append("file", entry.file)
        form.append("programId", programId)
        form.append("documentType", entry.documentType)
        if (entry.effectiveDate) form.append("effectiveDate", entry.effectiveDate)
        const res = await fetch("/api/contracts/upload", { method: "POST", body: form })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Upload failed")
        docIds.push(data.data.id)
      }

      // Run extraction
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programId, documentIds: docIds }),
      })
      const extractData = await extractRes.json()
      if (!extractRes.ok) throw new Error(extractData.error ?? "Extraction failed")

      setResult(extractData.data)
      setStep(3)
    } catch (err) {
      setError(String(err))
      setStep(1)
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }

  const selectedProgram = programs.find((p) => p.id === programId)

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: "#07003D", mb: 0.5 }}>
        Extract contract rules
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload contract PDFs and let AI identify billing rules automatically.
      </Typography>

      {/* Stepper */}
      <Stepper activeStep={step} sx={{ mb: 4, maxWidth: 680 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel
              sx={{
                "& .MuiStepLabel-label": {
                  fontFamily: "'Hind Siliguri', sans-serif",
                  fontSize: "0.8125rem",
                },
                "& .MuiStepIcon-root.Mui-active": { color: "#29B5E8" },
                "& .MuiStepIcon-root.Mui-completed": { color: "#29B5E8" },
              }}
            >
              {label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ── Step 0: Select program ── */}
      {step === 0 && (
        <Card sx={{ maxWidth: 480 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              Select program
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Extracted rules will be associated with this program.
            </Typography>
            <TextField
              select
              fullWidth
              size="small"
              label="Program"
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
            >
              {programs.length === 0 && (
                <MenuItem disabled value="">
                  No programs found
                </MenuItem>
              )}
              {programs.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.name}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 3 }}
              disabled={!programId}
              onClick={() => setStep(1)}
              endIcon={<ArrowForwardIosIcon sx={{ fontSize: 13 }} />}
            >
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 1: Upload documents ── */}
      {step === 1 && (
        <Box sx={{ maxWidth: 740 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Drop zone */}
          <Box
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              addFiles(Array.from(e.dataTransfer.files))
            }}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: `2px dashed ${isDragging ? "#29B5E8" : "rgba(104,111,111,0.3)"}`,
              borderRadius: 2,
              py: 6,
              px: 3,
              textAlign: "center",
              cursor: "pointer",
              backgroundColor: isDragging ? "rgba(41,181,232,0.04)" : "transparent",
              transition: "border-color 0.15s, background-color 0.15s",
              mb: 3,
              "&:hover": {
                borderColor: "#29B5E8",
                backgroundColor: "rgba(41,181,232,0.02)",
              },
            }}
          >
            <CloudUploadOutlinedIcon sx={{ fontSize: 44, color: "#29B5E8", mb: 1 }} />
            <Typography variant="body1" sx={{ fontWeight: 600, color: "#07003D" }}>
              Drag & drop PDF files here
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              or click to browse — multiple files supported
            </Typography>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []))
                e.target.value = ""
              }}
            />
          </Box>

          {/* File list */}
          {files.length > 0 && (
            <Stack spacing={1.5} sx={{ mb: 3 }}>
              {files.map((entry, idx) => (
                <Card key={idx} variant="outlined" sx={{ borderRadius: 1 }}>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Stack
                      direction="row"
                      alignItems="flex-start"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                        <InsertDriveFileOutlinedIcon
                          sx={{ color: "#29B5E8", fontSize: 24, flexShrink: 0 }}
                        />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(entry.file.size)}
                          </Typography>
                        </Box>
                      </Stack>
                      <IconButton size="small" onClick={() => removeFile(idx)} sx={{ ml: 1 }}>
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Stack>

                    <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
                      <TextField
                        select
                        size="small"
                        label="Document type"
                        value={entry.documentType}
                        onChange={(e) =>
                          updateFile(idx, {
                            documentType: e.target.value as FileEntry["documentType"],
                          })
                        }
                        sx={{ minWidth: 170 }}
                      >
                        {DOC_TYPES.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t.replace("_", " ")}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        size="small"
                        label="Effective date"
                        type="date"
                        value={entry.effectiveDate}
                        onChange={(e) => updateFile(idx, { effectiveDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ minWidth: 170 }}
                      />
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          <Stack direction="row" spacing={2} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setStep(0)}
            >
              Back
            </Button>
            <Button
              variant="contained"
              disabled={files.length === 0}
              onClick={handleExtract}
            >
              Extract rules
            </Button>
            {selectedProgram && (
              <Typography variant="caption" color="text.secondary">
                Program: {selectedProgram.name}
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {/* ── Step 2: Extracting ── */}
      {step === 2 && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            py: 10,
            maxWidth: 480,
          }}
        >
          <CircularProgress
            size={56}
            thickness={3}
            sx={{ color: "#29B5E8", mb: 3 }}
          />
          <Typography
            variant="body1"
            sx={{ fontWeight: 600, color: "#07003D", mb: 1 }}
          >
            Analyzing contract...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {progressMsg}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 3, textAlign: "center" }}
          >
            This may take 30–60 seconds depending on document length.
          </Typography>
        </Box>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && result && (
        <Box sx={{ maxWidth: 900 }}>
          {/* Summary cards */}
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Card sx={{ minWidth: 160 }}>
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="body2" color="text.secondary">
                  Rules extracted
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#07003D" }}>
                  {result.rulesFound}
                </Typography>
              </CardContent>
            </Card>
            <Card sx={{ minWidth: 160 }}>
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="body2" color="text.secondary">
                  Need review
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: result.rulesNeedReview > 0 ? "#BA7517" : "#2E7D32",
                  }}
                >
                  {result.rulesNeedReview}
                </Typography>
              </CardContent>
            </Card>
          </Stack>

          {/* Results table */}
          <Card sx={{ mb: 3 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Label</TableCell>
                    <TableCell>Fee type</TableCell>
                    <TableCell>Rate</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.rules.map((rule, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 500, maxWidth: 240 }}>
                        {rule.label}
                      </TableCell>
                      <TableCell>
                        {FEE_TYPE_LABELS[rule.feeType] ?? rule.feeType}
                      </TableCell>
                      <TableCell
                        sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}
                      >
                        {formatRate(rule)}
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 600,
                            color: confidenceColor(rule.confidence),
                          }}
                        >
                          {(rule.confidence * 100).toFixed(0)}%
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {rule.needsReview ? (
                          <Chip
                            icon={<WarningAmberOutlinedIcon />}
                            label="Needs review"
                            size="small"
                            sx={{
                              backgroundColor: "#FFF8E1",
                              color: "#BA7517",
                              "& .MuiChip-icon": { color: "#BA7517", fontSize: 14 },
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<CheckCircleOutlinedIcon />}
                            label="Draft"
                            size="small"
                            sx={{
                              backgroundColor: "#F5F5F5",
                              color: "#616161",
                              "& .MuiChip-icon": { color: "#616161", fontSize: 14 },
                            }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              onClick={() => {
                setFiles([])
                setResult(null)
                setStep(1)
              }}
            >
              Upload more documents
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIosIcon sx={{ fontSize: 13 }} />}
              onClick={() =>
                router.push(
                  `/rules?status=DRAFT&source=AI_PARSED&programId=${programId}`
                )
              }
            >
              Review rules
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  )
}
