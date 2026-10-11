# ============================================================
# 健康饮食助手 - 电脑预览脚本
# 双击运行（或右键"使用 PowerShell 运行"）后，自动打开浏览器预览最新版本
# 无需打包 APK：H5 版与 APK 内页面完全同源，效果一致
# 按 Ctrl+C 或关闭窗口即可停止预览服务
# ============================================================

$ErrorActionPreference = "Stop"
$repoRoot = $PSScriptRoot
$dist = Join-Path $repoRoot "desktop-src\web_dist"
$port = 8100

# 若产物不存在，提示先构建
if (-not (Test-Path (Join-Path $dist "index.html"))) {
    Write-Host "未找到构建产物，先执行构建..." -ForegroundColor Yellow
    Push-Location (Join-Path $repoRoot "desktop-src")
    if (-not (Test-Path "node_modules")) {
        npm install --registry=https://registry.npmmirror.com
    }
    npm run build
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  健康饮食助手 - 电脑预览" -ForegroundColor Cyan
Write-Host "  地址: http://localhost:$port" -ForegroundColor Green
Write-Host "  演示账号: demo / 123456" -ForegroundColor Green
Write-Host "  停止: 关闭本窗口 或 按 Ctrl+C" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 延迟 1 秒后自动打开浏览器
Start-Process "http://localhost:$port/#/home"
python -m http.server $port --directory $dist
