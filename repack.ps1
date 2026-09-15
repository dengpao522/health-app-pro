# 健康饮食助手 —— 一键云打包脚本
# 用法：右键"使用 PowerShell 运行"，或 .\repack.ps1
# 前提：DCloud 云打包免费次数未用完（每日额度），账号已登录 HBuilderX

$ErrorActionPreference = "Stop"
$project = "c:\Users\32341\Desktop\health-app-pro"
$cli = "D:\HBuilderX\cli.exe"
$desktopApk = "C:\Users\32341\Desktop\健康饮食助手.apk"

Write-Host "=== 开始云打包（Android 正式包 / 安心打包）===" -ForegroundColor Cyan

& $cli pack --project $project `
    --platform android `
    --android.packagename com.dengpao522.healthpro `
    --android.androidpacktype 3 `
    --safemode true

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n打包命令返回失败，请检查上方日志（如：免费次数用完 / 账号问题）。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

# 找最新生成的 APK
$apk = Get-ChildItem "$project\unpackage\release\apk\" -Filter "*.apk" |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $apk) {
    Write-Host "未找到 APK 产物，请检查打包日志。" -ForegroundColor Red
    Read-Host "按回车退出"
    exit 1
}

Copy-Item $apk.FullName $desktopApk -Force
Write-Host "`n=== 打包成功 ===" -ForegroundColor Green
Write-Host ("APK: " + $apk.FullName)
Write-Host ("大小: " + [math]::Round($apk.Length / 1MB, 2) + " MB")
Write-Host ("已复制到桌面: " + $desktopApk)
Write-Host "`n后续：把桌面 APK 发给朋友安装，或上传应用市场。"
Read-Host "按回车退出"
