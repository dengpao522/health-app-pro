@echo off
rem ============================================================
rem Health App - PC Preview Launcher
rem Double-click to start local server and open browser.
rem (Keep this file ASCII-only: cmd.exe misreads UTF-8 Chinese.)
rem ============================================================
chcp 65001 > nul
title Health App Preview
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0preview.ps1"
pause
