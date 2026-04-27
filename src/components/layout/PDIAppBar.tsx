"use client"
import AppBar from "@mui/material/AppBar"
import Toolbar from "@mui/material/Toolbar"
import IconButton from "@mui/material/IconButton"
import Typography from "@mui/material/Typography"
import Box from "@mui/material/Box"
import Avatar from "@mui/material/Avatar"
import Tooltip from "@mui/material/Tooltip"
import MenuIcon from "@mui/icons-material/Menu"
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined"

interface PDIAppBarProps { onMenuClick: () => void }

export default function PDIAppBar({ onMenuClick }: PDIAppBarProps) {
  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        {/* Hamburger */}
        <IconButton edge="start" onClick={onMenuClick} sx={{ mr: 1, color: "#323E48" }}>
          <MenuIcon />
        </IconButton>

        {/* PDI Logo mark */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 2 }}>
          {/* PDI logo — two-tone square */}
          <Box sx={{ width: 28, height: 28, display: "flex", overflow: "hidden", borderRadius: "2px", flexShrink: 0 }}>
            <Box sx={{ width: "33%", bgcolor: "#07003D" }} />
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <Box sx={{ flex: 1, bgcolor: "#29B5E8" }} />
              <Box sx={{ flex: 1, bgcolor: "#07003D" }} />
            </Box>
          </Box>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, color: "#07003D", letterSpacing: "-0.5px" }}>
            PDI
          </Typography>
        </Box>

        {/* App name */}
        <Typography variant="h6" noWrap sx={{ color: "#323E48", fontWeight: 600 }}>
          Loyalty Billing
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* Right side actions */}
        <Tooltip title="Notifications">
          <IconButton sx={{ color: "rgba(50,62,72,0.6)", mr: 1 }}>
            <NotificationsOutlinedIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Account">
          <Avatar
            sx={{ width: 32, height: 32, bgcolor: "#29B5E8", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
          >
            KB
          </Avatar>
        </Tooltip>
      </Toolbar>
    </AppBar>
  )
}
