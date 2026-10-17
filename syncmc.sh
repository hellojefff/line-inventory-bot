#!/bin/zsh

# 遇到未捕捉的嚴重錯誤時終斷執行
set -e

# 定義終端機顏色輸出
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # 重置顏色

echo "${CYAN}====================================================${NC}"
echo "${CYAN}   Mac Pro (macOS) GAS & GitHub 專案同步工具        ${NC}"
echo "${CYAN}====================================================${NC}"

# ==============================================================================
# 參數解析：支援 -m "訊息" 與 --skip-gas
# ==============================================================================
COMMIT_MSG=""
SKIP_GAS=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -m|--message) COMMIT_MSG="$2"; shift ;;
        -s|--skip-gas) SKIP_GAS=true ;;
        -h|--help)
            echo "用法: ./sync.sh [-m \"Commit 訊息\"] [-s|--skip-gas]"
            exit 0
            ;;
        *) echo "${RED}[警告] 未知參數: $1${NC}" ;;
    esac
    shift
done

# ==============================================================================
# 步驟 1：依賴工具與環境檢查
# ==============================================================================
if ! command -v git &> /dev/null; then
    echo "${RED}[錯誤] 系統未安裝 Git 或未設定 PATH。${NC}"
    exit 1
fi

if ! command -v clasp &> /dev/null; then
    echo "${RED}[錯誤] 未安裝 @google/clasp，請先執行: npm install -g @google/clasp${NC}"
    exit 1
fi

if [ ! -f ".clasp.json" ]; then
    echo "${RED}[錯誤] 當前目錄找不到 .clasp.json，請確認位於專案根目錄。${NC}"
    exit 1
fi

# ==============================================================================
# 步驟 2：資安防護與機敏資訊檢查
# ==============================================================================
echo ""
echo "${YELLOW}[1/4] 正在執行資安與敏感金鑰掃描...${NC}"

SECRET_FOUND=false

# 檢查程式碼中是否含有明文的 Gemini API Key
if git grep -E "AIzaSy[a-zA-Z0-9_-]{33}" -- ":(exclude)sync.*" 2>/dev/null; then
    echo "${RED}[警告] 程式碼中偵測到明文的 Gemini API Key！${NC}"
    SECRET_FOUND=true
fi

# 檢查是否留存明文 LINE Access Token
if git grep -E "LINE_ACCESS_TOKEN.*=.*[A-Za-z0-9+/]{40,}" -- ":(exclude)sync.*" 2>/dev/null; then
    echo "${RED}[警告] 程式碼中偵測到明文的 LINE Access Token！${NC}"
    SECRET_FOUND=true
fi

# 檢查未解決的 Git 衝突標記
CONFLICT_PATTERN="<<<<<<< HEAD"
if git grep -F "$CONFLICT_PATTERN" -- ":(exclude)sync.*" 2>/dev/null; then
    echo "${RED}[錯誤] 偵測到未解決的 Git 合併衝突標記！${NC}"
    exit 1
fi

if [ "$SECRET_FOUND" = true ]; then
    echo "${RED}[已阻斷] 請將金鑰移至 GAS 專案設定的 Script Properties 後再行推送。${NC}"
    exit 1
fi
echo "${GREEN}[通過] 安全檢查通過，未發現明文金鑰。${NC}"

# ==============================================================================
# 步驟 3：部署至 Google Apps Script (由 --skip-gas 控制)
# ==============================================================================
echo ""
if [ "$SKIP_GAS" = true ]; then
    echo "${CYAN}[2/4] 已指定 --skip-gas，跳過推送到 Google Apps Script。${NC}"
else
    echo "${YELLOW}[2/4] 正在將程式碼推播至 Google Apps Script (clasp push)...${NC}"
    clasp push
    echo "${GREEN}[通過] GAS 部署完成。${NC}"
fi

# ==============================================================================
# 步驟 4：檢查 Git 變更狀態與準備 Commit 訊息
# ==============================================================================
echo ""
echo "${YELLOW}[3/4] 正在檢查 Git 本地變更狀態...${NC}"

GIT_STATUS=$(git status --porcelain)
if [ -z "$GIT_STATUS" ]; then
    echo "${GREEN}[資訊] 沒有需要提交的變更，工作目錄是乾淨的。${NC}"
    echo "${CYAN}====================================================${NC}"
    echo "${GREEN}完成：專案已是最新狀態。${NC}"
    exit 0
fi

git status --short

if [ -z "$COMMIT_MSG" ]; then
    TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
    DEFAULT_MSG="chore: sync $TIMESTAMP"
    echo ""
    printf "請輸入 Commit 訊息 (直接按 Enter 將採用預設 [${DEFAULT_MSG}]): "
    read INPUT_MSG
    if [ -z "$INPUT_MSG" ]; then
        COMMIT_MSG="$DEFAULT_MSG"
    else
        COMMIT_MSG="$INPUT_MSG"
    fi
fi

# ==============================================================================
# 步驟 5：提交並推送到 GitHub
# ==============================================================================
echo ""
echo "${YELLOW}[4/4] 正在推送至 GitHub 遠端儲存庫...${NC}"
git add .
git commit -m "$COMMIT_MSG"

CURRENT_BRANCH=$(git branch --show-current | tr -d '[:space:]')
git push origin "$CURRENT_BRANCH"

echo ""
echo "${CYAN}====================================================${NC}"
echo "${GREEN}完成：GitHub 與 GAS 已同步成功！${NC}"
echo "${YELLOW}分支: ${CURRENT_BRANCH} | 提交訊息: ${COMMIT_MSG}${NC}"
echo "${CYAN}====================================================${NC}"