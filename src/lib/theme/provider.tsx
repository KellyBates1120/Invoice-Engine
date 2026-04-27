"use client"
import { ThemeProvider } from "@mui/material/styles"
import CssBaseline from "@mui/material/CssBaseline"
import { pdiTheme } from "./pdi-theme"

export default function PDIThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={pdiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
