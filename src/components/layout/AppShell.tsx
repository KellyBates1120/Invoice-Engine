"use client"
import { useState } from "react"
import Box from "@mui/material/Box"
import Toolbar from "@mui/material/Toolbar"
import PDIAppBar from "./PDIAppBar"
import PDISidebar from "./PDISidebar"

const DRAWER_WIDTH = 260

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <PDIAppBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <PDISidebar open={sidebarOpen} variant="permanent" />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: sidebarOpen ? `${DRAWER_WIDTH}px` : 0,
          transition: "margin 0.2s ease",
          minHeight: "100vh",
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Box sx={{ p: 3 }}>{children}</Box>
      </Box>
    </Box>
  )
}
