@echo off
echo.
echo  ╔══════════════════════════════════════╗
echo  ║       SPLANNER — Iniciando app       ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

IF NOT EXIST "node_modules\" (
  echo [1/2] Instalando dependencias...
  npm install
  echo.
)

echo [2/2] Iniciando servidor de desenvolvimento...
echo.
echo  Acesse: http://localhost:5173
echo.
npm run dev
pause
