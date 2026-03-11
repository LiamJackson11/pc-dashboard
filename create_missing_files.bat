@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  PC Dashboard - Create Missing Frontend Files
::  Run this from the pc-dashboard\ root folder.
:: ============================================================

set "ROOT=%~dp0"
set "FRONTEND=%ROOT%frontend"
set "SRC=%FRONTEND%\src"

echo.
echo  Creating missing frontend files in:
echo  %FRONTEND%
echo.

:: Make sure frontend folder exists
if not exist "%FRONTEND%" mkdir "%FRONTEND%"
if not exist "%SRC%" mkdir "%SRC%"
if not exist "%SRC%\components" mkdir "%SRC%\components"
if not exist "%SRC%\hooks" mkdir "%SRC%\hooks"
if not exist "%SRC%\store" mkdir "%SRC%\store"


:: ─────────────────────────────────────────────
:: package.json
:: ─────────────────────────────────────────────
echo Writing package.json...
(
echo {
echo   "name": "pc-dashboard-frontend",
echo   "version": "1.0.0",
echo   "private": true,
echo   "type": "module",
echo   "scripts": {
echo     "dev": "vite",
echo     "build": "vite build",
echo     "preview": "vite preview"
echo   },
echo   "dependencies": {
echo     "framer-motion": "^11.2.10",
echo     "lucide-react": "^0.383.0",
echo     "react": "^18.3.1",
echo     "react-dom": "^18.3.1",
echo     "recharts": "^2.12.7",
echo     "zustand": "^4.5.4"
echo   },
echo   "devDependencies": {
echo     "@types/react": "^18.3.3",
echo     "@types/react-dom": "^18.3.0",
echo     "@vitejs/plugin-react": "^4.3.1",
echo     "autoprefixer": "^10.4.19",
echo     "postcss": "^8.4.38",
echo     "tailwindcss": "^3.4.4",
echo     "vite": "^5.3.1"
echo   }
echo }
) > "%FRONTEND%\package.json"


:: ─────────────────────────────────────────────
:: vite.config.js
:: ─────────────────────────────────────────────
echo Writing vite.config.js...
(
echo import { defineConfig } from "vite";
echo import react from "@vitejs/plugin-react";
echo.
echo export default defineConfig^({
echo   plugins: [react^(^)],
echo   server: {
echo     port: 3000,
echo     proxy: {
echo       "/api": {
echo         target: "http://localhost:8000",
echo         changeOrigin: true,
echo       },
echo       "/ws": {
echo         target: "ws://localhost:8000",
echo         ws: true,
echo         changeOrigin: true,
echo       },
echo     },
echo   },
echo   build: {
echo     outDir: "dist",
echo     sourcemap: false,
echo     chunkSizeWarningLimit: 1000,
echo   },
echo }^);
) > "%FRONTEND%\vite.config.js"


:: ─────────────────────────────────────────────
:: tailwind.config.js
:: ─────────────────────────────────────────────
echo Writing tailwind.config.js...
(
echo /** @type {import^('tailwindcss'^).Config} */
echo export default {
echo   content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
echo   theme: {
echo     extend: {
echo       fontFamily: {
echo         display: ['"Space Grotesk"', 'sans-serif'],
echo         mono: ['"JetBrains Mono"', 'monospace'],
echo         body: ['"DM Sans"', 'sans-serif'],
echo       },
echo       colors: {
echo         glass: {
echo           bg: "rgba(255,255,255,0.04^)",
echo           border: "rgba(255,255,255,0.08^)",
echo           hover: "rgba(255,255,255,0.07^)",
echo         },
echo         accent: {
echo           cyan: "#00d4ff",
echo           green: "#00ff88",
echo           amber: "#ffb300",
echo           red: "#ff4757",
echo           purple: "#a855f7",
echo         },
echo         dark: {
echo           950: "#020408",
echo           900: "#050d14",
echo           800: "#081420",
echo           700: "#0d1f30",
echo           600: "#122a40",
echo         },
echo       },
echo       animation: {
echo         "pulse-glow": "pulse-glow 2s ease-in-out infinite",
echo         "scan-line": "scan-line 3s linear infinite",
echo         "float": "float 6s ease-in-out infinite",
echo         "shimmer": "shimmer 2s linear infinite",
echo       },
echo       keyframes: {
echo         "pulse-glow": {
echo           "0%, 100%%": { opacity: 1 },
echo           "50%%": { opacity: 0.6 },
echo         },
echo         "scan-line": {
echo           "0%%": { transform: "translateY(-100%%^)" },
echo           "100%%": { transform: "translateY(100vh^)" },
echo         },
echo         "float": {
echo           "0%%, 100%%": { transform: "translateY(0px^)" },
echo           "50%%": { transform: "translateY(-8px^)" },
echo         },
echo         "shimmer": {
echo           "0%%": { backgroundPosition: "-200%% 0" },
echo           "100%%": { backgroundPosition: "200%% 0" },
echo         },
echo       },
echo     },
echo   },
echo   plugins: [],
echo };
) > "%FRONTEND%\tailwind.config.js"


:: ─────────────────────────────────────────────
:: postcss.config.js
:: ─────────────────────────────────────────────
echo Writing postcss.config.js...
(
echo export default {
echo   plugins: {
echo     tailwindcss: {},
echo     autoprefixer: {},
echo   },
echo };
) > "%FRONTEND%\postcss.config.js"


:: ─────────────────────────────────────────────
:: index.html
:: ─────────────────────────────────────────────
echo Writing index.html...
(
echo ^<!DOCTYPE html^>
echo ^<html lang="en"^>
echo   ^<head^>
echo     ^<meta charset="UTF-8" /^>
echo     ^<meta name="viewport" content="width=device-width, initial-scale=1.0" /^>
echo     ^<title^>PC Dashboard^</title^>
echo     ^<link rel="preconnect" href="https://fonts.googleapis.com" /^>
echo     ^<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /^>
echo     ^<link
echo       href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700^&family=JetBrains+Mono:wght@300;400;500;700^&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300^&display=swap"
echo       rel="stylesheet"
echo     /^>
echo     ^<style^>
echo       html { background: #020408; }
echo     ^</style^>
echo   ^</head^>
echo   ^<body^>
echo     ^<div id="root"^>^</div^>
echo     ^<script type="module" src="/src/main.jsx"^>^</script^>
echo   ^</body^>
echo ^</html^>
) > "%FRONTEND%\index.html"


:: ─────────────────────────────────────────────
:: Done
:: ─────────────────────────────────────────────
echo.
echo  ==========================================
echo   All missing files created successfully!
echo.
echo   Created:
echo     frontend\package.json
echo     frontend\vite.config.js
echo     frontend\tailwind.config.js
echo     frontend\postcss.config.js
echo     frontend\index.html
echo.
echo   Now run setup.bat again to continue.
echo  ==========================================
echo.
pause
