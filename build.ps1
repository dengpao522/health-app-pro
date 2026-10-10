# ============================================================
# 健康饮食助手 - 前端构建流水线
# 作用：desktop-src/ (Vue3+Vite 源码) → 构建 → 同步到 APP 壳工程
# 用法：右键"使用 PowerShell 运行"，或 .\build.ps1
# 流程：
#   1. 首次运行自动 npm install（仅首次，之后走缓存）
#   2. npm run build 产物输出到 desktop-src/web_dist/
#   3. 将 web_dist/assets/* 同步到仓库根 assets/
#   4. 自动更新根 index.html 中带 hash 的 js/css 引用
# ============================================================

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$srcDir   = Join-Path $repoRoot "desktop-src"
$distDir  = Join-Path $srcDir "web_dist"
$assetsDst = Join-Path $repoRoot "assets"
$shellIndex = Join-Path $repoRoot "index.html"

# ---------- 1. 依赖安装（仅首次） ----------
if (-not (Test-Path (Join-Path $srcDir "node_modules"))) {
    Write-Host "=== 首次运行：安装前端依赖（约1-2分钟）===" -ForegroundColor Cyan
    Push-Location $srcDir
    npm install --registry=https://registry.npmmirror.com
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Host "npm install 失败" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }
}

# ---------- 2. 构建 ----------
Write-Host "=== 构建前端（vite build）===" -ForegroundColor Cyan
Push-Location $srcDir
npm run build
Pop-Location
if ($LASTEXITCODE -ne 0) { Write-Host "构建失败" -ForegroundColor Red; Read-Host "按回车退出"; exit 1 }

# ---------- 3. 同步 assets ----------
Write-Host "=== 同步构建产物到 assets/ ===" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $assetsDst -Force | Out-Null
Copy-Item (Join-Path $distDir "assets\*") $assetsDst -Force

# ---------- 4. 更新 index.html 中的 hash 引用 ----------
Write-Host "=== 更新 index.html 资源引用 ===" -ForegroundColor Cyan
$indexHtml = Get-Content $shellIndex -Raw -Encoding UTF8
# 找到新构建的主入口文件名（vite 命名规则：index-<hash>.js / index-<hash>.css）
$newJs  = (Get-ChildItem (Join-Path $distDir "assets") -Filter "index-*.js"  | Select-Object -First 1).Name
$newCss = (Get-ChildItem (Join-Path $distDir "assets") -Filter "index-*.css" | Select-Object -First 1).Name
# 正则替换旧 hash 文件名（仅替换 assets/ 下的 index-* 引用，其他页面按需懒加载不受影响）
$indexHtml = $indexHtml -replace 'assets/index-[A-Za-z0-9_-]+\.js',  "assets/$newJs"
$indexHtml = $indexHtml -replace 'assets/index-[A-Za-z0-9_-]+\.css', "assets/$newCss"
# 以 UTF8 无 BOM 写回（与 DCloud 壳工程保持一致）
[System.IO.File]::WriteAllText($shellIndex, $indexHtml, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`n=== 构建完成 ===" -ForegroundColor Green
Write-Host "主入口: $newJs / $newCss"
Write-Host "后续：HBuilderX 云打包或 .\repack.ps1 生成新 APK"
Read-Host "按回车退出"
