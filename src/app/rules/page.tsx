"use client"
import { useState, useEffect } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Chip from "@mui/material/Chip"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import Alert from "@mui/material/Alert"
import Skeleton from "@mui/material/Skeleton"
import Stack from "@mui/material/Stack"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import Collapse from "@mui/material/Collapse"
import InputAdornment from "@mui/material/InputAdornment"
import AddIcon from "@mui/icons-material/Add"
import SearchIcon from "@mui/icons-material/Search"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined"
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined"
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined"
import ScheduleIcon from "@mui/icons-material/Schedule"
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutlined"
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"

// ─────────────────────────────────────────────
// Config / helpers
// ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ACTIVE:       { label: "Active",       color: "#2E7D32", bg: "#E8F5E9", icon: <CheckCircleOutlineIcon sx={{ fontSize: 12 }} /> },
  DRAFT:        { label: "Draft",        color: "#616161", bg: "#F5F5F5", icon: <EditOutlinedIcon sx={{ fontSize: 12 }} /> },
  PENDING:      { label: "Pending",      color: "#185FA5", bg: "#E6F1FB", icon: <ScheduleIcon sx={{ fontSize: 12 }} /> },
  NEEDS_REVIEW: { label: "Needs review", color: "#BA7517", bg: "#FFF8E1", icon: <WarningAmberOutlinedIcon sx={{ fontSize: 12 }} /> },
  SUPERSEDED:   { label: "Superseded",   color: "#9E9E9E", bg: "#F5F5F5", icon: <PauseCircleOutlineIcon sx={{ fontSize: 12 }} /> },
}

const EVENT_CONFIG: Record<string, { label: string; color: "default" | "primary" | "secondary" | "success" | "warning" | "error" | "info" }> = {
  created:     { label: "Created",     color: "primary" },
  activated:   { label: "Activated",   color: "success" },
  field_edited:{ label: "Edited",      color: "warning" },
  superseded:  { label: "Superseded",  color: "default" },
  approved:    { label: "Approved",    color: "success" },
  cloned:      { label: "Cloned",      color: "info" },
}

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
  MARKET_DEVELOPMENT_FUND: "Market dev fund",
}

function formatRate(rule: any): string {
  if (rule.rateType === "TIERED_FLAT" && rule.tiers?.length) return `${rule.tiers[0].rate * 100}¢ tiered`
  if (rule.rateType === "PERCENTAGE" && rule.pctRate) return `${(parseFloat(rule.pctRate) * 100).toFixed(0)}%`
  if (rule.rateType === "FLAT" && rule.flatRate) return `$${parseFloat(rule.flatRate).toFixed(4)}/unit`
  if (rule.rateType === "FLAT_PLUS_PCT" && rule.flatComponent) return `$${parseFloat(rule.flatComponent).toLocaleString()} flat`
  return "—"
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  })
}

function diffFields(prev: any, next: any): string[] {
  if (!prev || !next) return []
  const skip = new Set(["updatedAt", "createdAt"])
  return Object.keys(next).filter(
    (k) => !skip.has(k) && JSON.stringify(prev[k]) !== JSON.stringify(next[k])
  )
}

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, color: "#616161", bg: "#F5F5F5", icon: null }
  return (
    <Chip
      icon={cfg.icon as any}
      label={cfg.label}
      size="small"
      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: "0.6875rem", height: 22, border: "none",
        "& .MuiChip-icon": { color: cfg.color, ml: "6px" } }}
    />
  )
}

// ─────────────────────────────────────────────
// Audit row — expandable
// ─────────────────────────────────────────────

function AuditRow({ event }: { event: any }) {
  const [open, setOpen] = useState(false)
  const cfg = EVENT_CONFIG[event.eventType] ?? { label: event.eventType, color: "default" as const }
  const changedFields = event.eventType === "field_edited"
    ? diffFields(event.previousData, event.newData)
    : []
  const hasDetail = changedFields.length > 0 || event.note

  return (
    <>
      <TableRow
        sx={{ cursor: hasDetail ? "pointer" : "default", "&:hover": { bgcolor: "rgba(41,181,232,0.04)" } }}
        onClick={() => hasDetail && setOpen((o) => !o)}
      >
        <TableCell sx={{ width: 120 }}>
          <Chip label={cfg.label} size="small" color={cfg.color} variant="outlined"
            sx={{ fontWeight: 600, fontSize: "0.6875rem", height: 22 }} />
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={500}>{event.rule?.label ?? "—"}</Typography>
          <Typography variant="caption" color="text.secondary">
            {FEE_TYPE_LABELS[event.rule?.feeType] ?? event.rule?.feeType}
          </Typography>
        </TableCell>
        <TableCell>
          {event.rule?.status && <StatusChip status={event.rule.status} />}
        </TableCell>
        <TableCell>
          <Typography variant="body2" color="text.secondary">{event.changedBy}</Typography>
        </TableCell>
        <TableCell>
          <Typography variant="body2" sx={{ fontSize: "0.8125rem" }}>
            {formatDateTime(event.changedAt)}
          </Typography>
        </TableCell>
        <TableCell sx={{ width: 36 }}>
          {hasDetail && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
              {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          )}
        </TableCell>
      </TableRow>

      {hasDetail && (
        <TableRow>
          <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
            <Collapse in={open}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: "rgba(0,0,0,0.15)", borderRadius: 1, mb: 0.5 }}>
                {event.note && (
                  <Typography variant="body2" color="text.secondary" mb={changedFields.length ? 1 : 0}>
                    {event.note}
                  </Typography>
                )}
                {changedFields.length > 0 && (
                  <Box component="table" sx={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                    <Box component="thead">
                      <Box component="tr">
                        {["Field", "Before", "After"].map((h) => (
                          <Box component="th" key={h} sx={{ textAlign: "left", py: 0.5, pr: 3, color: "text.secondary", fontWeight: 600, fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            {h}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                    <Box component="tbody">
                      {changedFields.slice(0, 10).map((field) => {
                        const prev = event.previousData?.[field]
                        const next = event.newData?.[field]
                        const fmt = (v: any) => v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v)
                        return (
                          <Box component="tr" key={field}>
                            <Box component="td" sx={{ py: 0.25, pr: 3, fontFamily: "monospace", fontSize: "0.75rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                              {field}
                            </Box>
                            <Box component="td" sx={{ py: 0.25, pr: 3, color: "error.main", fontFamily: "monospace", fontSize: "0.75rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {fmt(prev)}
                            </Box>
                            <Box component="td" sx={{ py: 0.25, pr: 3, color: "success.main", fontFamily: "monospace", fontSize: "0.75rem", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {fmt(next)}
                            </Box>
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>
                )}
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────

export default function RulesPage() {
  const [tab, setTab] = useState(0)

  // Rules tab state
  const [rules, setRules] = useState<any[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [feeFilter, setFeeFilter] = useState("ALL")

  // Audit tab state
  const [events, setEvents] = useState<any[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFetched, setAuditFetched] = useState(false)
  const [auditTotal, setAuditTotal] = useState(0)
  const [auditPage, setAuditPage] = useState(1)
  const [eventTypeFilter, setEventTypeFilter] = useState("ALL")

  const PROGRAM_ID = "prog-fuel-rewards-001"
  const PAGE_SIZE = 50

  useEffect(() => {
    fetch(`/api/rules?programId=${PROGRAM_ID}`)
      .then((r) => r.json())
      .then((res) => { setRules(res.data ?? []); setRulesLoading(false) })
      .catch(() => setRulesLoading(false))
  }, [])

  const fetchAudit = (page: number, typeFilter: string) => {
    setAuditLoading(true)
    const params = new URLSearchParams({
      programId: PROGRAM_ID,
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })
    if (typeFilter !== "ALL") params.set("eventType", typeFilter)

    fetch(`/api/rules/audit?${params}`)
      .then((r) => r.json())
      .then((res) => {
        setEvents(res.data ?? [])
        setAuditTotal(res.meta?.total ?? 0)
        setAuditFetched(true)
        setAuditLoading(false)
      })
      .catch(() => setAuditLoading(false))
  }

  const handleTabChange = (_: React.SyntheticEvent, val: number) => {
    setTab(val)
    if (val === 1 && !auditFetched) fetchAudit(1, "ALL")
  }

  const handleAuditFilter = (type: string) => {
    setEventTypeFilter(type)
    setAuditPage(1)
    fetchAudit(1, type)
  }

  const handleAuditPage = (dir: 1 | -1) => {
    const next = auditPage + dir
    setAuditPage(next)
    fetchAudit(next, eventTypeFilter)
  }

  const filtered = rules.filter((r) => {
    const matchSearch = r.label.toLowerCase().includes(search.toLowerCase()) || r.feeType.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter
    const matchFee = feeFilter === "ALL" || r.feeType === feeFilter
    return matchSearch && matchStatus && matchFee
  })

  const needsReview = rules.filter((r) => r.status === "NEEDS_REVIEW").length
  const totalPages = Math.ceil(auditTotal / PAGE_SIZE)

  return (
    <Box>
      {/* Page header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#07003D", mb: 0.5 }}>
            Billing rules
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fuel Rewards — Paytronix · {rules.length} rules configured
          </Typography>
        </Box>
        {tab === 0 && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" sx={{ borderColor: "#29B5E8", color: "#29B5E8" }}>
              Extract from contract
            </Button>
            <Button variant="contained" size="small" startIcon={<AddIcon />}>
              Add rule
            </Button>
          </Stack>
        )}
      </Stack>

      {/* Tabs */}
      <Tabs value={tab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: "divider", mb: 2.5 }}>
        <Tab label="Rules" />
        <Tab label="Audit log" icon={<HistoryOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
      </Tabs>

      {/* ── Rules tab ── */}
      {tab === 0 && (
        <Box>
          {needsReview > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}
              action={<Button size="small" color="warning" sx={{ fontWeight: 600 }}>Review now</Button>}
            >
              {needsReview} rule{needsReview > 1 ? "s" : ""} extracted by AI need{needsReview === 1 ? "s" : ""} analyst review before activation.
            </Alert>
          )}

          <Stack direction="row" spacing={1.5} mb={2} alignItems="center">
            <TextField size="small" placeholder="Search rules…" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: "text.secondary" }} /></InputAdornment> }}
              sx={{ width: 240 }}
            />
            <TextField select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ width: 160 }} label="Status">
              <MenuItem value="ALL">All statuses</MenuItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <MenuItem key={k} value={k}>{v.label}</MenuItem>)}
            </TextField>
            <TextField select size="small" value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)} sx={{ width: 200 }} label="Fee type">
              <MenuItem value="ALL">All fee types</MenuItem>
              {Object.entries(FEE_TYPE_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important" }}>
              {filtered.length} of {rules.length} rules
            </Typography>
          </Stack>

          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Rule</TableCell>
                    <TableCell>Fee type</TableCell>
                    <TableCell>Basis</TableCell>
                    <TableCell>Rate</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Effective from</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Confidence</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rulesLoading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j}><Skeleton width={j === 0 ? 180 : 80} height={20} /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : filtered.map((rule) => (
                        <TableRow key={rule.id}
                          sx={{ "&:hover": { bgcolor: "rgba(41,181,232,0.04)" },
                            ...(rule.status === "NEEDS_REVIEW" && { borderLeft: "3px solid #BA7517" }) }}
                        >
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: "#07003D" }}>{rule.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{rule.contractRef}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">{FEE_TYPE_LABELS[rule.feeType] ?? rule.feeType}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                              {rule.feeBasis?.replace(/_/g, " ").toLowerCase()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>
                              {formatRate(rule)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                              {rule.scopeLevel?.charAt(0) + rule.scopeLevel?.slice(1).toLowerCase()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
                              {new Date(rule.effectiveFrom).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </Typography>
                          </TableCell>
                          <TableCell><StatusChip status={rule.status} /></TableCell>
                          <TableCell>
                            {rule.confidence != null ? (
                              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <Box sx={{ width: 48, height: 4, bgcolor: "#E0E0E0", borderRadius: 2, overflow: "hidden" }}>
                                  <Box sx={{ width: `${rule.confidence * 100}%`, height: "100%",
                                    bgcolor: rule.confidence >= 0.8 ? "#2E7D32" : rule.confidence >= 0.6 ? "#BA7517" : "#C62828", borderRadius: 2 }}
                                  />
                                </Box>
                                <Typography variant="caption" color="text.secondary">{Math.round(rule.confidence * 100)}%</Typography>
                              </Box>
                            ) : <Typography variant="caption" color="text.disabled">—</Typography>}
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0} justifyContent="flex-end">
                              <Tooltip title="View details">
                                <IconButton size="small" sx={{ color: "#29B5E8" }}>
                                  <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={rule.status === "ACTIVE" ? "Create new version" : "Edit rule"}>
                                <IconButton size="small" sx={{ color: "text.secondary" }}>
                                  <EditOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Clone to another program">
                                <IconButton size="small" sx={{ color: "text.secondary" }}>
                                  <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Box>
      )}

      {/* ── Audit log tab ── */}
      {tab === 1 && (
        <Box>
          <Stack direction="row" spacing={1.5} mb={2} alignItems="center">
            <TextField select size="small" value={eventTypeFilter}
              onChange={(e) => handleAuditFilter(e.target.value)}
              sx={{ width: 180 }} label="Event type"
            >
              <MenuItem value="ALL">All events</MenuItem>
              {Object.entries(EVENT_CONFIG).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v.label}</MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" color="text.secondary" sx={{ ml: "auto !important" }}>
              {auditTotal} event{auditTotal !== 1 ? "s" : ""}
            </Typography>
          </Stack>

          <Card>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 120 }}>Event</TableCell>
                    <TableCell>Rule</TableCell>
                    <TableCell sx={{ width: 130 }}>Rule status</TableCell>
                    <TableCell sx={{ width: 140 }}>Changed by</TableCell>
                    <TableCell sx={{ width: 180 }}>Date &amp; time</TableCell>
                    <TableCell sx={{ width: 36 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {auditLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i}>
                          {[120, 220, 100, 120, 160, 36].map((w, j) => (
                            <TableCell key={j}><Skeleton width={w} height={20} /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : !auditFetched
                    ? null
                    : events.length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">No audit events found.</Typography>
                          </TableCell>
                        </TableRow>
                      )
                    : events.map((event) => <AuditRow key={event.id} event={event} />)
                  }
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            {totalPages > 1 && (
              <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1} sx={{ px: 2, py: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
                <Typography variant="body2" color="text.secondary">
                  Page {auditPage} of {totalPages}
                </Typography>
                <Button size="small" disabled={auditPage <= 1} onClick={() => handleAuditPage(-1)}>
                  Previous
                </Button>
                <Button size="small" disabled={auditPage >= totalPages} onClick={() => handleAuditPage(1)}>
                  Next
                </Button>
              </Stack>
            )}
          </Card>
        </Box>
      )}
    </Box>
  )
}
