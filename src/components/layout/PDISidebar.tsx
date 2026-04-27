"use client"
import { usePathname } from "next/navigation"
import Link from "next/link"
import Drawer from "@mui/material/Drawer"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import ListItemText from "@mui/material/ListItemText"
import Collapse from "@mui/material/Collapse"
import Divider from "@mui/material/Divider"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Toolbar from "@mui/material/Toolbar"
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined"
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined"
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined"
import DomainOutlinedIcon from "@mui/icons-material/DomainOutlined"
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined"
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined"
import { useState } from "react"

const DRAWER_WIDTH = 260

interface NavItem {
  label: string
  icon: React.ReactNode
  href?: string
  children?: { label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: <DashboardOutlinedIcon sx={{ fontSize: 20 }} />, href: "/" },
  {
    label: "Programs",
    icon: <DomainOutlinedIcon sx={{ fontSize: 20 }} />,
    href: "/programs",
  },
  {
    label: "Rules engine",
    icon: <GavelOutlinedIcon sx={{ fontSize: 20 }} />,
    children: [
      { label: "All rules", href: "/rules" },
      { label: "Fee models", href: "/rules/fee-models" },
      { label: "Templates", href: "/rules/templates" },
    ],
  },
  {
    label: "Billing",
    icon: <ReceiptOutlinedIcon sx={{ fontSize: 20 }} />,
    children: [
      { label: "Periods", href: "/periods" },
      { label: "Invoices", href: "/billing/invoices" },
      { label: "Evaluate", href: "/billing/evaluate" },
    ],
  },
  {
    label: "Contracts",
    icon: <FolderOutlinedIcon sx={{ fontSize: 20 }} />,
    children: [
      { label: "All contracts", href: "/contracts" },
      { label: "Extract rules", href: "/contracts/extract" },
    ],
  },
  { label: "AR & Disputes", icon: <WarningAmberOutlinedIcon sx={{ fontSize: 20 }} />, href: "/ar" },
  { label: "Finance backup", icon: <SavingsOutlinedIcon sx={{ fontSize: 20 }} />, href: "/finance" },
]

interface PDISidebarProps {
  open: boolean
  variant?: "permanent" | "persistent" | "temporary"
  onClose?: () => void
}

export default function PDISidebar({ open, variant = "permanent", onClose }: PDISidebarProps) {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState<string[]>(["Rules engine", "Billing"])

  const toggleExpand = (label: string) => {
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/")

  return (
    <Drawer variant={variant} open={open} onClose={onClose}
      sx={{ width: DRAWER_WIDTH, flexShrink: 0, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" } }}
    >
      <Toolbar /> {/* Spacer for AppBar */}

      <Box sx={{ px: 1, pt: 1.5, pb: 1 }}>
        <Typography variant="body2"
          sx={{ color: "rgba(255,255,255,0.4)", fontSize: "0.6875rem", fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", px: 1, pb: 0.5 }}
        >
          Main menu
        </Typography>
      </Box>

      <List dense disablePadding sx={{ px: 0.5 }}>
        {NAV_ITEMS.map((item) => {
          const hasChildren = !!item.children
          const isExpanded = expanded.includes(item.label)
          const itemIsActive = item.href ? isActive(item.href) : false
          const childIsActive = item.children?.some((c) => isActive(c.href)) ?? false

          return (
            <Box key={item.label}>
              <ListItemButton
                component={item.href ? Link : "div"}
                {...(item.href ? { href: item.href } : {})}
                selected={itemIsActive || childIsActive}
                onClick={hasChildren ? () => toggleExpand(item.label) : undefined}
                sx={{ mb: 0.25 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
                {hasChildren && (isExpanded ? <ExpandLessIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} /> : <ExpandMoreIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.5)" }} />)}
              </ListItemButton>

              {hasChildren && (
                <Collapse in={isExpanded} timeout="auto">
                  <List disablePadding>
                    {item.children!.map((child) => (
                      <ListItemButton
                        key={child.href}
                        component={Link}
                        href={child.href}
                        selected={isActive(child.href)}
                        sx={{ pl: 6, mb: 0.25 }}
                      >
                        <ListItemText primary={child.label} primaryTypographyProps={{ fontSize: "0.8125rem" }} />
                      </ListItemButton>
                    ))}
                  </List>
                </Collapse>
              )}
            </Box>
          )
        })}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)", mx: 2, mb: 1 }} />
      <Box sx={{ px: 2, pb: 2 }}>
        <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6875rem" }}>
          PDI Loyalty Billing v0.1
        </Typography>
      </Box>
    </Drawer>
  )
}
