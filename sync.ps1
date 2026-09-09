param(
    [string]$CommitMsg = ""
)

$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "   GAS (clasp) & GitHub Sync Tool                   " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# 1. Dependency Check
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Git is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command clasp -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] @google/clasp is not installed." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path ".clasp.json")) {
    Write-Host "[ERROR] .clasp.json not found in current directory." -ForegroundColor Red
    exit 1
}

# 2. Security Check (改用純字串過濾，徹底排除引號衝突)
Write-Host ""
Write-Host "[1/4] Running security check..." -ForegroundColor Yellow

$secretFound = $false

# 檢查是否有明文 Gemini API Key (AIzaSy...)
$apiKeyCheck = git grep -E "AIzaSy[a-zA-Z0-9_-]{33}" -- ":(exclude)sync.ps1" ":(exclude)sync.sh" 2>$null
if ($apiKeyCheck) {
    Write-Host "[ALERT] Gemini API Key detected in code!" -ForegroundColor Red
    $secretFound = $true
}

# 檢查 1_Config.js 中是否留存長度大於 40 的明文 Token（避開引號解析錯誤）
$tokenCheck = git grep -E "LINE_ACCESS_TOKEN.*=.*[A-Za-z0-9+/]{40,}" -- ":(exclude)sync.ps1" ":(exclude)sync.sh" 2>$null
if ($tokenCheck) {
    Write-Host "[ALERT] Plaintext LINE Access Token detected in code!" -ForegroundColor Red
    $secretFound = $true
}

# 檢查是否有未解衝突標籤
$conflictCheck = git grep -F "<<<<<<< HEAD" -- ":(exclude)sync.ps1" ":(exclude)sync.sh" 2>$null
if ($conflictCheck) {
    Write-Host "[ERROR] Unresolved Git merge conflicts detected!" -ForegroundColor Red
    exit 1
}

if ($secretFound) {
    Write-Host "[BLOCKED] Move secrets to Script Properties before pushing." -ForegroundColor Red
    exit 1
}
Write-Host "[PASS] No plaintext secrets detected." -ForegroundColor Green

# 3. Deploy to GAS
Write-Host ""
Write-Host "[2/4] Pushing code to Google Apps Script..." -ForegroundColor Yellow
clasp push
Write-Host "[PASS] GAS deployment succeeded." -ForegroundColor Green

# 4. Prepare Git Commit
Write-Host ""
Write-Host "[3/4] Checking Git status..." -ForegroundColor Yellow

$gitStatus = git status --porcelain
if (-not $gitStatus) {
    Write-Host "[INFO] Nothing to commit. Working tree clean." -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Cyan
    Write-Host "Done: GAS is up to date." -ForegroundColor Green
    exit 0
}

git status --short

if ([string]::IsNullOrWhiteSpace($CommitMsg)) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm")
    $defaultMsg = "chore: sync " + $timestamp
    $inputMsg = Read-Host "Enter commit message (Press Enter to use [$defaultMsg])"
    if ([string]::IsNullOrWhiteSpace($inputMsg)) {
        $CommitMsg = $defaultMsg
    } else {
        $CommitMsg = $inputMsg
    }
}

# 5. Git Commit & Push
Write-Host ""
Write-Host "[4/4] Pushing to GitHub..." -ForegroundColor Yellow
git add .
git commit -m "$CommitMsg"

$currentBranch = (git branch --show-current).Trim()
git push origin $currentBranch

Write-Host ""
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Done: GAS and GitHub synchronized successfully!" -ForegroundColor Green
Write-Host "Branch: $currentBranch | Message: $CommitMsg" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan