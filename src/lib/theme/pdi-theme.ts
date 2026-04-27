"use client"
import { createTheme } from "@mui/material/styles"

declare module "@mui/material/styles" {
  interface Palette { pdiNavy: Palette["primary"] }
  interface PaletteOptions { pdiNavy?: PaletteOptions["primary"] }
}

export const pdiTheme = createTheme({
  palette: {
    primary: { main: "#29B5E8", dark: "#1A8FBA", light: "#5DCAEE", contrastText: "#ffffff" },
    secondary: { main: "#07003D", dark: "#040028", light: "#2A1F6B", contrastText: "#ffffff" },
    pdiNavy: { main: "#07003D", dark: "#040028", light: "#2A1F6B", contrastText: "#ffffff" },
    text: { primary: "#323E48", secondary: "rgba(50,62,72,0.6)", disabled: "rgba(50,62,72,0.38)" },
    divider: "rgba(104,111,111,0.3)",
    background: { default: "#F4F6F8", paper: "#ffffff" },
    success: { main: "#2E7D32", light: "#E8F5E9" },
    warning: { main: "#BA7517", light: "#FFF8E1" },
    error: { main: "#C62828", light: "#FFEBEE" },
    info: { main: "#29B5E8", light: "#E3F4FC" },
  },
  typography: {
    fontFamily: "'DM Sans', 'Hind Siliguri', sans-serif",
    h6: { fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: "1rem", lineHeight: 1.6, letterSpacing: "0.15px", color: "#323E48" },
    subtitle2: { fontFamily: "'Hind Siliguri', sans-serif", fontWeight: 600, fontSize: "0.875rem", lineHeight: 1.57, letterSpacing: "0.1px" },
    body1: { fontFamily: "'Hind Siliguri', sans-serif", fontWeight: 400, fontSize: "1rem", letterSpacing: "0.15px", color: "#323E48" },
    body2: { fontFamily: "'Hind Siliguri', sans-serif", fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.43, letterSpacing: "0.17px", color: "#323E48" },
    button: { fontFamily: "'DM Sans', sans-serif", fontWeight: 600, letterSpacing: "0.4px", textTransform: "none" },
  },
  shape: { borderRadius: 4 },
  components: {
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundColor: "#ffffff", color: "#323E48", borderBottom: "0.75px solid rgba(104,111,111,0.3)" } },
    },
    MuiToolbar: { styleOverrides: { root: { minHeight: "64px !important", paddingLeft: "24px", paddingRight: "24px" } } },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: "#07003D", color: "#ffffff", width: 260, boxShadow: "0px 0px 2px 0px rgba(7,0,61,0.28)", border: "none" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: "4px", marginLeft: "8px", marginRight: "8px", paddingTop: "4px", paddingBottom: "4px", minHeight: "28px", color: "#ffffff",
          "&.Mui-selected": { backgroundColor: "rgba(41,181,232,0.08)", color: "#29B5E8", "& .MuiListItemIcon-root": { color: "#29B5E8" }, "& .MuiListItemText-primary": { color: "#29B5E8", fontWeight: 600 }, "&:hover": { backgroundColor: "rgba(41,181,232,0.12)" } },
          "&:hover": { backgroundColor: "rgba(255,255,255,0.08)" },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { color: "rgba(255,255,255,0.7)", minWidth: "32px" } } },
    MuiListItemText: { styleOverrides: { primary: { fontFamily: "'Hind Siliguri', sans-serif", fontSize: "0.875rem", letterSpacing: "0.17px" } } },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, borderRadius: "4px" },
        containedPrimary: { backgroundColor: "#29B5E8", "&:hover": { backgroundColor: "#1A8FBA" } },
      },
    },
    MuiCard: { defaultProps: { elevation: 1 }, styleOverrides: { root: { borderRadius: "8px" } } },
    MuiChip: { styleOverrides: { root: { fontFamily: "'Hind Siliguri', sans-serif", fontSize: "0.75rem", fontWeight: 500, height: "24px", borderRadius: "12px" } } },
    MuiTableHead: { styleOverrides: { root: { "& .MuiTableCell-root": { backgroundColor: "#F4F6F8", fontWeight: 600, fontSize: "0.75rem", letterSpacing: "0.1px", borderBottom: "1px solid rgba(104,111,111,0.3)" } } } },
    MuiTableCell: { styleOverrides: { root: { fontFamily: "'Hind Siliguri', sans-serif", fontSize: "0.875rem", borderBottom: "0.75px solid rgba(104,111,111,0.2)", padding: "10px 16px" } } },
    MuiTableRow: { styleOverrides: { root: { "&:hover": { backgroundColor: "rgba(41,181,232,0.04)" } } } },
    MuiOutlinedInput: { styleOverrides: { root: { fontFamily: "'Hind Siliguri', sans-serif", fontSize: "0.875rem", "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#29B5E8" } } } },
    MuiInputLabel: { styleOverrides: { root: { fontFamily: "'Hind Siliguri', sans-serif", fontSize: "0.875rem", "&.Mui-focused": { color: "#29B5E8" } } } },
    MuiTab: { styleOverrides: { root: { textTransform: "none", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, "&.Mui-selected": { color: "#29B5E8" } } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: "#29B5E8" } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: "4px", fontFamily: "'Hind Siliguri', sans-serif", fontSize: "0.875rem" } } },
  },
})
