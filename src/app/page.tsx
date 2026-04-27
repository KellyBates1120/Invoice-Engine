"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Grid from "@mui/material/Grid"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Chip from "@mui/material/Chip"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Stack from "@mui/material/Stack"
import Button from "@mui/material/Button"
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos"
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined"
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined"

const STATS = [
  { label: "Active programs", value: "20", sub: "across 8 brands", color: "#07003D" },
  { label: "Invoices ready", value: "5", sub: "to send this period", color: "#2E7D32" },
  { label: "Need attention", value: "7", sub: "data or review issues", color: "#BA7517" },
  { label: "Open AR", value: "$183,210", sub: "across all programs", color: "#07003D" },
]

const PROGRAMS = [
  { name: "Fuel Rewards", brand: "Brand A", platform: "Paytronix", cycle: "Monthly", status: "INVOICE_READY", ar: "$47,280", flag: null },
  { name: "Driver Perks", brand: "Brand B", platform: "Custom POS", cycle: "Monthly", status: "DATA_NEEDED", ar: "—", flag: "Upload Feb txns" },
  { name: "Synergy Program", brand: "Brand C", platform: "Punchh", cycle: "Monthly", status: "IN_BILLING", ar: "—", flag: null },
  { name: "Fleet Loyalty", brand: "Brand D", platform: "NCR Loyalty", cycle: "Weekly", status: "INVOICE_READY", ar: "$12,150", flag: "Due today" },
  { name: "Connect Rewards", brand: "Brand E", platform: "Proprietary", cycle: "Monthly", status: "NEEDS_REVIEW", ar: "—", flag: "2 fee fields flagged" },
  { name: "Coastal Loyalty", brand: "Brand I", platform: "Paytronix", cycle: "Monthly", status: "EXPIRING", ar: "$15,600", flag: "23 days left" },
]

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  INVOICE_READY: { label: "Invoice ready", color: "#2E7D32", bg: "#E8F5E9" },
  DATA_NEEDED:   { label: "Data needed",   color: "#BA7517", bg: "#FFF8E1" },
  IN_BILLING:    { label: "In billing",    color: "#185FA5", bg: "#E6F1FB" },
  NEEDS_REVIEW:  { label: "Needs review",  color: "#BA7517", bg: "#FFF8E1" },
  EXPIRING:      { label: "Expiring",      color: "#C62828", bg: "#FFEBEE" },
}

export default function DashboardPage() {
  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#07003D", mb: 0.5 }}>
            Operations dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            April 24, 2026 · Billing period in progress
          </Typography>
        </Box>
        <Button variant="contained" size="small" endIcon={<ArrowForwardIosIcon />}>
          Open billing period
        </Button>
      </Stack>

      {/* Stat cards */}
      <Grid container spacing={2} mb={3}>
        {STATS.map((s) => (
          <Grid item xs={12} sm={6} md={3} key={s.label}>
            <Card>
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>{s.label}</Typography>
                <Typography sx={{ fontSize: "1.75rem", fontWeight: 700, color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Programs table */}
      <Card>
        <Box sx={{ px: 2, pt: 2, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="subtitle2" sx={{ color: "#07003D" }}>Programs — needs action first</Typography>
          <Button size="small" endIcon={<ArrowForwardIosIcon />} sx={{ color: "#29B5E8", fontWeight: 600 }}>
            All 20 programs
          </Button>
        </Box>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Program</TableCell>
                <TableCell>Platform</TableCell>
                <TableCell>Cycle</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Next action</TableCell>
                <TableCell align="right">Open AR</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PROGRAMS.map((p) => {
                const sc = STATUS_MAP[p.status]
                const isUrgent = ["NEEDS_REVIEW", "EXPIRING"].includes(p.status)
                return (
                  <TableRow key={p.name}
                    sx={{ cursor: "pointer", "&:hover": { bgcolor: "rgba(41,181,232,0.04)" },
                      ...(isUrgent && { borderLeft: `3px solid ${sc.color}` }) }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: "#07003D" }}>{p.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.brand}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2">{p.platform}</Typography></TableCell>
                    <TableCell><Typography variant="body2">{p.cycle}</Typography></TableCell>
                    <TableCell>
                      <Chip label={sc.label} size="small"
                        sx={{ bgcolor: sc.bg, color: sc.color, fontWeight: 600, fontSize: "0.6875rem", height: 22 }}
                      />
                    </TableCell>
                    <TableCell>
                      {p.flag && (
                        <Typography variant="body2" sx={{ color: sc.color, fontSize: "0.75rem", fontWeight: 500 }}>
                          {p.flag}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" sx={{ fontWeight: p.ar !== "—" ? 600 : 400, color: p.ar !== "—" ? "#07003D" : "text.disabled" }}>
                        {p.ar}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  )
}
