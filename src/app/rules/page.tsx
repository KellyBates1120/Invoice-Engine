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
import AddIcon from "@mui/icons-material/Add"
import SearchIcon from "@mui/icons-material/Search"
import EditOutlinedIcon from "@mui/icons-material/EditOutlined"
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined"
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined"
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import ScheduleIcon from "@mui/icons-material/Schedule"
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline"
import InputAdornment from "@mui/material/InputAdornment"

// Status chip config
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  ACTIVE:       { label: "Active",       color: "#2E7D32", bg: "#E8F5E9", icon: <CheckCircleOutlineIcon sx={{ fontSize: 12 }} /> },
  DRAFT:        { label: "Draft",        color: "#616161", bg: "#F5F5F5", icon: <EditOutlinedIcon sx={{ fontSize: 12 }} /> },
  PENDING:      { label: "Pending",      color: "#185FA5", bg: "#E6F1FB", icon: <ScheduleIcon sx={{ fontSize: 12 }} /> },
  NEEDS_REVIEW: { label: "Needs review", color: "#BA7517", bg: "#FFF8E1", icon: <WarningAmberOutlinedIcon sx={{ fontSize: 12 }} /> },
  SUPERSEDED:   { label: "Superseded",   color: "#9E9E9E", bg: "#F5F5F5", icon: <PauseCircleOutlineIcon sx={{ fontSize: 12 }} /> },
}

// Fee type display names
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
  if (rule.rateType === "TIERED_FLAT" && rule.tiers?.length) {
    return `${rule.tiers[0].rate * 100}¢ tiered`
  }
  if (rule.rateType === "PERCENTAGE" && rule.pctRate) {
    return `${(parseFloat(rule.pctRate) * 100).toFixed(0)}%`
  }
  if (rule.rateType === "FLAT" && rule.flatRate) {
    return `$${parseFloat(rule.flatRate).toFixed(4)}/unit`
  }
  if (rule.rateType === "FLAT_PLUS_PCT" && rule.flatComponent) {
    return `$${parseFloat(rule.flatComponent).toLocaleString()} flat`
  }
  return "—"
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

export default function RulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [feeFilter, setFeeFilter] = useState("ALL")

  const PROGRAM_ID = "prog-fuel-rewards-001"

  useEffect(() => {
    fetch(`/api/rules?programId=${PROGRAM_ID}`)
      .then((r) => r.json())
      .then((res) => { setRules(res.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = rules.filter((r) => {
    const matchSearch = r.label.toLowerCase().includes(search.toLowerCase()) || r.feeType.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === "ALL" || r.status === statusFilter
    const matchFee = feeFilter === "ALL" || r.feeType === feeFilter
    return matchSearch && matchStatus && matchFee
  })

  const needsReview = rules.filter((r) => r.status === "NEEDS_REVIEW").length

  return (
    <Box>
      {/* Page header */}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#07003D", mb: 0.5 }}>
            Billing rules
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fuel Rewards — Paytronix · {rules.length} rules configured
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" sx={{ borderColor: "#29B5E8", color: "#29B5E8" }}>
            Extract from contract
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />}>
            Add rule
          </Button>
        </Stack>
      </Stack>

      {/* Review alert */}
      {needsReview > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}
          action={<Button size="small" color="warning" sx={{ fontWeight: 600 }}>Review now</Button>}
        >
          {needsReview} rule{needsReview > 1 ? "s" : ""} extracted by AI need{needsReview === 1 ? "s" : ""} analyst review before activation.
        </Alert>
      )}

      {/* Filters */}
      <Stack direction="row" spacing={1.5} mb={2} alignItems="center">
        <TextField size="small" placeholder="Search rules..." value={search} onChange={(e) => setSearch(e.target.value)}
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

      {/* Rules table */}
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
              {loading
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
  )
}
