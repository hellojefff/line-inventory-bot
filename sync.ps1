param(
    [string]$CommitMsg = "",
    [switch]$SkipGas            # 加上此參數可跳過部署至 GAS
)

# 遇到錯誤時中斷執行
$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   GAS (clasp) & GitHub 同步工具                    " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# ==============================================================================
# 步驟 1：依賴工具與環境檢查
# ==============================================================================
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[錯誤] 未安裝 Git 或未加入系統 PATH 環境變數。" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
    Write-Host '[錯誤] 未安裝 @google/clasp，請執行 npm install -g @google/clasp。' -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".clasp.json")) {
    Write-Host "[錯誤] 當前目錄找不到 .clasp.json，請確認位於專案根目錄。" -ForegroundColor Red
    exit 1
}

# ==============================================================================
# 步驟 2：資安防護與機敏資訊檢查
# ==============================================================================
Write-Host ""
Write-Host "[1/4] 正在執行資安與敏感金鑰掃描..." -ForegroundColor Yellow

$secretFound = $false

# 檢查程式碼中是否含有明文的 Gemini API Key
$apiKeyCheck = git grep -E "AIzaSy[a-zA-Z0-9_-]{33}" -- ":(exclude)sync.ps1" ":(exclude)sync.sh" 2>$null
if ($apiKeyCheck) {
    Write-Host "[警告] 程式碼中偵測到明文的 Gemini API Key！" -ForegroundColor Red
    $secretFound = $true
}

# 檢查是否留存長度大於 40 碼的明文 LINE Access Token
$tokenCheck = git grep -E "LINE_ACCESS_TOKEN.*=.*[A-Za-z0-9+/]{40,}" -- ":(exclude)sync.ps1" ":(exclude)sync.sh" 2>$null
if ($tokenCheck) {
    Write-Host "[警告] 程式碼中偵測到明文的 LINE Access Token！" -ForegroundColor Red
    $secretFound = $true
}

# 檢查未解決的 Git 衝突標籤（透過字串拼接避免觸發管線重新導向語法錯誤）
$conflictPattern = [string]::Concat("<", "<", "<", "<", "<", "<", "<", " HEAD")
$conflictCheck = git grep -F $conflictPattern -- ":(exclude)sync.ps1" ":(exclude)sync.sh" 2>$null
if ($conflictCheck) {
    Write-Host "[錯誤] 偵測到未解決的 Git 合併衝突標記！" -ForegroundColor Red
    exit 1
}

if ($secretFound) {
    Write-Host "[已阻斷] 請將金鑰移至 GAS 專案設定的 Script Properties 後再行推送。" -ForegroundColor Red
    exit 1
}
Write-Host "[通過] 安全檢查通過，未發現明文金鑰。" -ForegroundColor Green

# ==============================================================================
# 步驟 3：部署至 Google Apps Script (由 -SkipGas 控制)
# ==============================================================================
Write-Host ""
if ($SkipGas) {
    Write-Host "[2/4] 已指定 -SkipGas，跳過推送到 Google Apps Script。" -ForegroundColor Cyan
} else {
    Write-Host "[2/4] 正在將程式碼推播至 Google Apps Script..." -ForegroundColor Yellow
    clasp push
    Write-Host "[通過] GAS 部署完成。" -ForegroundColor Green
}

# ==============================================================================
# 步驟 4：檢查 Git 變更狀態與準備 Commit 訊息
# ==============================================================================
Write-Host ""
Write-Host "[3/4] 正在檢查 Git 本地變更狀態..." -ForegroundColor Yellow

$gitStatus = git status --porcelain
if (-not $gitStatus) {
    Write-Host "[資訊] 沒有需要提交的變更，工作目錄是乾淨的。" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "完成：專案已是最新狀態。" -ForegroundColor Green
    exit 0
}

git status --short

if ([string]::IsNullOrWhiteSpace($CommitMsg)) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
    $defaultMsg = "chore: sync " + $timestamp
    $inputMsg = Read-Host "請輸入 Commit 訊息 (直接按 Enter 將採用預設 [$defaultMsg])"
    if ([string]::IsNullOrWhiteSpace($inputMsg)) {
        $CommitMsg = $defaultMsg
    } else {
        $CommitMsg = $inputMsg
    }
}

# ==============================================================================
# 步驟 5：提交並推送到 GitHub
# ==============================================================================
Write-Host ""
Write-Host "[4/4] 正在推送至 GitHub 遠端儲存庫..." -ForegroundColor Yellow
git add .
git commit -m "$CommitMsg"

$currentBranch = (git branch --show-current).Trim()
git push origin $currentBranch

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "完成：GitHub 已同步成功！" -ForegroundColor Green
Write-Host "分支: $currentBranch | 提交訊息: $CommitMsg" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan