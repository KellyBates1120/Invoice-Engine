"use client"
import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Stepper from "@mui/material/Stepper"
import Step from "@mui/material/Step"
import StepLabel from "@mui/material/StepLabel"
import Button from "@mui/material/Button"
import Paper from "@mui/material/Paper"
import TextField from "@mui/material/TextField"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Table from "@mui/material/Table"
import TableHead from "@mui/material/TableHead"
import TableBody from "@mui/material/TableBody"
import TableRow from "@mui/material/TableRow"
import TableCell from "@mui/material/TableCell"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import CircularProgress from "@mui/material/CircularProgress"
import Collapse from "@mui/material/Collapse"
import Alert from "@mui/material/Alert"
import Divider from "@mui/material/Divider"
import Stack from "@mui/material/Stack"
import Grid from "@mui/material/Grid"
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import AddIcon from "@mui/icons-material/Add"
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined"
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import type { AIExtractedRule, AIExtractedEntities, AIExtractedOperator, AIExtractedSite } from "@/types"

const STEPS = ["Upload & analyze", "Confirm program", "Review rules", "Create program"]

const DOC_TYPES = ["MSA", "AMENDMENT", "EXHIBIT", "SOW", "RATE_SCHEDULE", "OTHER"]

const BILLING_CYCLES = ["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "AD_HOC", "EVENT_DRIVEN"]

const ANALYZE_MSGS = [
  "Reading contract documents…",
  "Identifying parties and program details…",
  "Extracting fee structures and rates…",
  "Building program structure…",
  "Finalizing extraction…",
]

interface UploadedFile {
  id: string
  file: File
  documentType: string
  effectiveDate: string
  docId?: string
}

interface ReviewRule {
  id: string
  data: AIExtractedRule
  status: "pending" | "approved" | "flagged"
}

interface EditableOperator extends AIExtractedOperator {
  _id: string
  expanded: boolean
}

function fmtFeeType(ft: string) {
  return ft.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtRate(rule: AIExtractedRule): string {
  if (rule.rateType === "FLAT") return `$${(rule.flatRate ?? 0).toFixed(4)}`
  if (rule.rateType === "PERCENTAGE") return `${((rule.pctRate ?? 0) * 100).toFixed(2)}%`
  if (rule.rateType === "TIERED_FLAT") return `Tiered flat (${rule.tiers?.length ?? 0} tiers)`
  if (rule.rateType === "TIERED_PCT") return `Tiered % (${rule.tiers?.length ?? 0} tiers)`
  if (rule.rateType === "FLAT_PLUS_PCT")
    return `$${rule.flatComponent ?? 0} + ${((rule.pctComponent ?? 0) * 100).toFixed(2)}%`
  return "—"
}

export default function ContractOnboardingPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState(0)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState("")
  const [analyzeError, setAnalyzeError] = useState("")

  const [entities, setEntities] = useState<AIExtractedEntities | null>(null)
  const [editEntities, setEditEntities] = useState({
    brandName: "",
    programName: "",
    platformName: "",
    billingCycle: "MONTHLY",
    contractEffectiveFrom: "",
    contractEffectiveTo: "",
    billingTerms: "",
    paymentTermsDays: "",
  })
  const [operators, setOperators] = useState<EditableOperator[]>([])

  const [rules, setRules] = useState<ReviewRule[]>([])
  const [docIds, setDocIds] = useState<string[]>([])

  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [result, setResult] = useState<{ programId: string; ruleIds: string[] } | null>(null)

  // ── File handling ───────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === "application/pdf" || f.name.endsWith(".pdf"))
    const newEntries: UploadedFile[] = pdfs.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      documentType: "MSA",
      effectiveDate: "",
    }))
    setFiles((prev) => [...prev, ...newEntries])
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = Array.from(e.dataTransfer.files)
      addFiles(dropped)
    },
    [addFiles]
  )

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    addFiles(selected)
    e.target.value = ""
  }

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id))

  const updateFile = (id: string, patch: Partial<UploadedFile>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  // ── Step 1: Analyze ─────────────────────────────────────────────────────────

  const analyze = async () => {
    setAnalyzeError("")
    setIsAnalyzing(true)

    let msgIdx = 0
    setAnalyzeMsg(ANALYZE_MSGS[0])
    const ticker = setInterval(() => {
      msgIdx = (msgIdx + 1) % ANALYZE_MSGS.length
      setAnalyzeMsg(ANALYZE_MSGS[msgIdx])
    }, 2200)

    try {
      // Upload each file
      const uploadedIds: string[] = []
      for (const uf of files) {
        const fd = new FormData()
        fd.append("file", uf.file)
        fd.append("documentType", uf.documentType)
        if (uf.effectiveDate) fd.append("effectiveDate", uf.effectiveDate)

        const res = await fetch("/api/contracts/upload", { method: "POST", body: fd })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? "Upload failed")
        uploadedIds.push(json.data.id)
      }

      // Dry-run extraction
      const extractRes = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: uploadedIds, dryRun: true }),
      })
      const extractJson = await extractRes.json()
      if (!extractRes.ok) throw new Error(extractJson.error ?? "Extraction failed")

      const { entities: ext, rules: extRules } = extractJson.data as {
        entities: AIExtractedEntities
        rules: AIExtractedRule[]
      }

      setDocIds(uploadedIds)
      setEntities(ext)
      setEditEntities({
        brandName: ext.brandName ?? "",
        programName: ext.programName ?? "",
        platformName: ext.platformName ?? "",
        billingCycle: ext.billingCycle ?? "MONTHLY",
        contractEffectiveFrom: ext.contractEffectiveFrom ?? "",
        contractEffectiveTo: ext.contractEffectiveTo ?? "",
        billingTerms: ext.billingTerms ?? "",
        paymentTermsDays: ext.paymentTermsDays?.toString() ?? "",
      })
      setOperators(
        (ext.operators ?? []).map((op, i) => ({
          ...op,
          _id: `op-${i}-${Date.now()}`,
          expanded: false,
        }))
      )
      setRules(
        extRules.map((r, i) => ({
          id: `rule-${i}-${Date.now()}`,
          data: r,
          status: "pending",
        }))
      )
      setStep(1)
    } catch (err) {
      setAnalyzeError(String(err))
    } finally {
      clearInterval(ticker)
      setIsAnalyzing(false)
    }
  }

  // ── Operators helpers ───────────────────────────────────────────────────────

  const toggleOperator = (id: string) =>
    setOperators((prev) => prev.map((o) => (o._id === id ? { ...o, expanded: !o.expanded } : o)))

  const updateOperator = (id: string, patch: Partial<EditableOperator>) =>
    setOperators((prev) => prev.map((o) => (o._id === id ? { ...o, ...patch } : o)))

  const addOperator = () =>
    setOperators((prev) => [
      ...prev,
      { _id: `op-new-${Date.now()}`, name: "", banner: "", type: "", billingEmail: "", sites: [], expanded: true },
    ])

  const removeOperator = (id: string) => setOperators((prev) => prev.filter((o) => o._id !== id))

  // ── Rules helpers ───────────────────────────────────────────────────────────

  const setRuleStatus = (id: string, status: ReviewRule["status"]) =>
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))

  const approveHighConfidence = () =>
    setRules((prev) =>
      prev.map((r) => (r.data.confidence >= 0.8 && r.status === "pending" ? { ...r, status: "approved" } : r))
    )

  // ── Step 4: Create ──────────────────────────────────────────────────────────

  const createProgram = async () => {
    setCreateError("")
    setIsCreating(true)
    try {
      const approvedRules = rules.filter((r) => r.status !== "flagged").map((r) => r.data)
      const body = {
        entities: {
          ...editEntities,
          paymentTermsDays: editEntities.paymentTermsDays ? Number(editEntities.paymentTermsDays) : undefined,
          operators: operators.map(({ _id, expanded, ...op }) => op),
        },
        rules: approvedRules,
        documentIds: docIds,
      }

      const res = await fetch("/api/contracts/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Create failed")
      setResult(json.data)
    } catch (err) {
      setCreateError(String(err))
    } finally {
      setIsCreating(false)
    }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const approvedCount = rules.filter((r) => r.status === "approved").length
  const pendingCount = rules.filter((r) => r.status === "pending").length
  const flaggedCount = rules.filter((r) => r.status === "flagged").length
  const highConfCount = rules.filter((r) => r.data.confidence >= 0.8 && r.status === "pending").length

  return (
    <Box sx={{ maxWidth: 960, mx: "auto", px: 3, py: 4 }}>
      <Typography variant="h5" fontWeight={700} mb={0.5}>
        New program onboarding
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={4}>
        Upload your contract documents and let AI extract the program structure and billing rules.
      </Typography>

      <Stepper activeStep={step} sx={{ mb: 5 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* ── STEP 0: Upload ── */}
      {step === 0 && (
        <Box>
          <Paper
            ref={dropRef}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: "2px dashed",
              borderColor: isDragging ? "primary.main" : "rgba(255,255,255,0.15)",
              borderRadius: 2,
              p: 5,
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
              "&:hover": { borderColor: "primary.main" },
              bgcolor: isDragging ? "rgba(41,181,232,0.06)" : "transparent",
            }}
          >
            <UploadFileOutlinedIcon sx={{ fontSize: 40, color: "rgba(255,255,255,0.3)", mb: 1 }} />
            <Typography fontWeight={600} mb={0.5}>
              Drop PDF files here, or click to browse
            </Typography>
            <Typography variant="body2" color="text.secondary">
              MSA, amendments, exhibits, rate schedules — all supported
            </Typography>
            <input ref={fileInputRef} type="file" accept=".pdf" multiple hidden onChange={onFileInput} />
          </Paper>

          {files.length > 0 && (
            <Box mt={3}>
              <Typography variant="body2" fontWeight={600} color="text.secondary" mb={1.5}>
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </Typography>
              <Stack spacing={1.5}>
                {files.map((uf) => (
                  <Paper key={uf.id} variant="outlined" sx={{ p: 2 }}>
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <UploadFileOutlinedIcon sx={{ color: "text.secondary", flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {uf.file.name}
                        <Typography component="span" variant="caption" color="text.secondary" ml={1}>
                          ({(uf.file.size / 1024).toFixed(0)} KB)
                        </Typography>
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel>Type</InputLabel>
                        <Select
                          label="Type"
                          value={uf.documentType}
                          onChange={(e) => updateFile(uf.id, { documentType: e.target.value })}
                        >
                          {DOC_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                        </Select>
                      </FormControl>
                      <TextField
                        size="small"
                        label="Effective date"
                        type="date"
                        value={uf.effectiveDate}
                        onChange={(e) => updateFile(uf.id, { effectiveDate: e.target.value })}
                        InputLabelProps={{ shrink: true }}
                        sx={{ width: 160 }}
                      />
                      <IconButton size="small" onClick={() => removeFile(uf.id)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}

          {analyzeError && <Alert severity="error" sx={{ mt: 2 }}>{analyzeError}</Alert>}

          <Box mt={4} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              size="large"
              disabled={files.length === 0 || isAnalyzing}
              onClick={analyze}
              startIcon={isAnalyzing ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ minWidth: 180 }}
            >
              {isAnalyzing ? analyzeMsg : "Analyze contract"}
            </Button>
          </Box>
        </Box>
      )}

      {/* ── STEP 1: Confirm entities ── */}
      {step === 1 && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} mb={3}>
            Confirm program details
          </Typography>

          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Typography variant="body2" fontWeight={600} color="text.secondary" mb={2} sx={{ textTransform: "uppercase", letterSpacing: "0.6px", fontSize: "0.7rem" }}>
              Brand &amp; Program
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Brand name"
                  size="small"
                  value={editEntities.brandName}
                  onChange={(e) => setEditEntities((p) => ({ ...p, brandName: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Program name"
                  size="small"
                  value={editEntities.programName}
                  onChange={(e) => setEditEntities((p) => ({ ...p, programName: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Platform"
                  size="small"
                  placeholder="e.g. Paytronix, Punchh"
                  value={editEntities.platformName}
                  onChange={(e) => setEditEntities((p) => ({ ...p, platformName: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Billing cycle</InputLabel>
                  <Select
                    label="Billing cycle"
                    value={editEntities.billingCycle}
                    onChange={(e) => setEditEntities((p) => ({ ...p, billingCycle: e.target.value }))}
                  >
                    {BILLING_CYCLES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contract start"
                  size="small"
                  type="date"
                  value={editEntities.contractEffectiveFrom}
                  onChange={(e) => setEditEntities((p) => ({ ...p, contractEffectiveFrom: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Contract end"
                  size="small"
                  type="date"
                  value={editEntities.contractEffectiveTo}
                  onChange={(e) => setEditEntities((p) => ({ ...p, contractEffectiveTo: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={9}>
                <TextField
                  fullWidth
                  label="Payment terms"
                  size="small"
                  placeholder="e.g. Net 30 from invoice date"
                  value={editEntities.billingTerms}
                  onChange={(e) => setEditEntities((p) => ({ ...p, billingTerms: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  label="Terms (days)"
                  size="small"
                  type="number"
                  value={editEntities.paymentTermsDays}
                  onChange={(e) => setEditEntities((p) => ({ ...p, paymentTermsDays: e.target.value }))}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
              <Typography variant="body2" fontWeight={600} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: "0.6px", fontSize: "0.7rem" }}>
                Operators ({operators.length})
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addOperator}>
                Add operator
              </Button>
            </Stack>

            {operators.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                No operators extracted — add manually if needed.
              </Typography>
            )}

            <Stack spacing={1}>
              {operators.map((op) => (
                <Box key={op._id} sx={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.5 }}>
                    <TextField
                      size="small"
                      label="Operator name"
                      value={op.name}
                      onChange={(e) => updateOperator(op._id, { name: e.target.value })}
                      sx={{ flexGrow: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Banner"
                      value={op.banner ?? ""}
                      onChange={(e) => updateOperator(op._id, { banner: e.target.value })}
                      sx={{ width: 140 }}
                    />
                    <TextField
                      size="small"
                      label="Billing email"
                      value={op.billingEmail ?? ""}
                      onChange={(e) => updateOperator(op._id, { billingEmail: e.target.value })}
                      sx={{ width: 200 }}
                    />
                    <Chip
                      label={`${op.sites?.length ?? 0} sites`}
                      size="small"
                      variant="outlined"
                      sx={{ cursor: "pointer" }}
                      onClick={() => toggleOperator(op._id)}
                      deleteIcon={op.expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      onDelete={() => toggleOperator(op._id)}
                    />
                    <IconButton size="small" onClick={() => removeOperator(op._id)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>

                  <Collapse in={op.expanded}>
                    <Box sx={{ px: 2, pb: 1.5, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                      {(op.sites ?? []).length === 0 ? (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                          No sites extracted for this operator.
                        </Typography>
                      ) : (
                        <Table size="small" sx={{ mt: 1 }}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Site name</TableCell>
                              <TableCell>City</TableCell>
                              <TableCell>State</TableCell>
                              <TableCell>DMA</TableCell>
                              <TableCell>Fuel grades</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(op.sites ?? []).map((site: AIExtractedSite, si) => (
                              <TableRow key={si}>
                                <TableCell>{site.name ?? "—"}</TableCell>
                                <TableCell>{site.city ?? "—"}</TableCell>
                                <TableCell>{site.state ?? "—"}</TableCell>
                                <TableCell>{site.dma ?? "—"}</TableCell>
                                <TableCell>{site.fuelGrades?.join(", ") ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </Box>
                  </Collapse>
                </Box>
              ))}
            </Stack>
          </Paper>

          {entities?.reviewNotes?.length ? (
            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2" fontWeight={600} mb={0.5}>AI notes:</Typography>
              {entities.reviewNotes.map((note, i) => <Typography key={i} variant="body2">• {note}</Typography>)}
            </Alert>
          ) : null}

          <Stack direction="row" justifyContent="space-between" mt={2}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button
              variant="contained"
              disabled={!editEntities.brandName || !editEntities.programName}
              onClick={() => setStep(2)}
            >
              Next: Review rules
            </Button>
          </Stack>
        </Box>
      )}

      {/* ── STEP 2: Review rules ── */}
      {step === 2 && (
        <Box>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Review fee rules
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {rules.length} rules extracted · {approvedCount} approved · {pendingCount} pending · {flaggedCount} flagged
              </Typography>
            </Box>
            {highConfCount > 0 && (
              <Button variant="outlined" size="small" startIcon={<CheckCircleOutlinedIcon />} onClick={approveHighConfidence}>
                Approve {highConfCount} high-confidence
              </Button>
            )}
          </Stack>

          <Paper variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Fee type</TableCell>
                  <TableCell>Rate</TableCell>
                  <TableCell>Confidence</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((r) => (
                  <TableRow
                    key={r.id}
                    sx={{
                      bgcolor: r.data.confidence < 0.8 ? "rgba(255,167,38,0.06)" : undefined,
                      opacity: r.status === "flagged" ? 0.5 : 1,
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>{r.data.label}</Typography>
                      {r.data.contractRef && (
                        <Typography variant="caption" color="text.secondary">{r.data.contractRef}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{fmtFeeType(r.data.feeType)}</Typography>
                      <Typography variant="caption" color="text.secondary">{r.data.feeBasis?.replace(/_/g, " ")}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace">{fmtRate(r.data)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`${Math.round(r.data.confidence * 100)}%`}
                        size="small"
                        color={r.data.confidence >= 0.8 ? "success" : r.data.confidence >= 0.6 ? "warning" : "error"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {r.status === "approved" && <Chip label="Approved" size="small" color="success" />}
                      {r.status === "flagged" && <Chip label="Flagged" size="small" color="error" />}
                      {r.status === "pending" && (
                        r.data.needsReview
                          ? <Chip label="Needs review" size="small" color="warning" />
                          : <Chip label="Pending" size="small" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" justifyContent="flex-end" spacing={0.5}>
                        {r.status !== "approved" && (
                          <IconButton size="small" title="Approve" onClick={() => setRuleStatus(r.id, "approved")}>
                            <CheckCircleOutlinedIcon fontSize="small" sx={{ color: "success.main" }} />
                          </IconButton>
                        )}
                        {r.status !== "flagged" && (
                          <IconButton size="small" title="Flag for review" onClick={() => setRuleStatus(r.id, "flagged")}>
                            <FlagOutlinedIcon fontSize="small" sx={{ color: "error.main" }} />
                          </IconButton>
                        )}
                        {r.status !== "pending" && (
                          <IconButton size="small" title="Reset" onClick={() => setRuleStatus(r.id, "pending")}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Stack direction="row" justifyContent="space-between" mt={3}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(3)}>
              Next: Create program
            </Button>
          </Stack>
        </Box>
      )}

      {/* ── STEP 3: Review & create ── */}
      {step === 3 && !result && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} mb={3}>
            Review &amp; create
          </Typography>

          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">Brand</Typography>
                <Typography fontWeight={600}>{editEntities.brandName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">Program</Typography>
                <Typography fontWeight={600}>{editEntities.programName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">Platform</Typography>
                <Typography>{editEntities.platformName || "—"}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">Billing cycle</Typography>
                <Typography>{editEntities.billingCycle}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">Contract period</Typography>
                <Typography>
                  {editEntities.contractEffectiveFrom || "—"} → {editEntities.contractEffectiveTo || "open-ended"}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary" display="block">Payment terms</Typography>
                <Typography>{editEntities.billingTerms || "—"}</Typography>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2.5 }} />

            <Grid container spacing={3}>
              <Grid item xs={4}>
                <Typography variant="h5" fontWeight={700} color="primary">{operators.length}</Typography>
                <Typography variant="body2" color="text.secondary">Operators</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="h5" fontWeight={700} color="primary">
                  {operators.reduce((s, o) => s + (o.sites?.length ?? 0), 0)}
                </Typography>
                <Typography variant="body2" color="text.secondary">Sites</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="h5" fontWeight={700} color="primary">
                  {rules.filter((r) => r.status !== "flagged").length}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Rules to create
                  {flaggedCount > 0 && (
                    <Typography component="span" variant="caption" color="error.main" ml={1}>
                      ({flaggedCount} flagged/excluded)
                    </Typography>
                  )}
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

          <Stack direction="row" justifyContent="space-between">
            <Button onClick={() => setStep(2)} disabled={isCreating}>Back</Button>
            <Button
              variant="contained"
              size="large"
              disabled={isCreating}
              onClick={createProgram}
              startIcon={isCreating ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ minWidth: 180 }}
            >
              {isCreating ? "Creating…" : "Create program"}
            </Button>
          </Stack>
        </Box>
      )}

      {/* ── Success ── */}
      {result && (
        <Box textAlign="center" py={6}>
          <CheckCircleOutlinedIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
          <Typography variant="h5" fontWeight={700} mb={1}>
            Program created
          </Typography>
          <Typography variant="body1" color="text.secondary" mb={4}>
            <strong>{editEntities.programName}</strong> is now in onboarding status with{" "}
            {result.ruleIds.length} billing rules ready for review.
          </Typography>

          <Stack direction="row" spacing={2} justifyContent="center">
            <Button
              variant="contained"
              endIcon={<OpenInNewIcon />}
              onClick={() => router.push(`/programs`)}
            >
              View all programs
            </Button>
            <Button
              variant="outlined"
              endIcon={<OpenInNewIcon />}
              onClick={() => router.push(`/rules?programId=${result.programId}&status=NEEDS_REVIEW`)}
            >
              Review extracted rules
            </Button>
          </Stack>
        </Box>
      )}
    </Box>
  )
}
