# 覺風物資管理與盤點系統 (Juefeng Inventory Bot & Web App)
## 系統架構與技術規格說明書 (SYSTEM_SPEC.md)

- **版本**：v2.1.0 (Architecture Refactored)
- **維護者**：覺風物資數位化工作小組
- **試算表資料庫 ID**：`13J32Ewv0PVL8o6hEoJUCuK2Ur5pBEnHO90tdG7XxtC8`
- **架構核心**：Google Apps Script (V8)、LINE Messaging API (Flex Message 2.0)、Google Sheets、Google Drive、Gemini Multimodal API

---

## 1. 專案概述 (Project Overview)

覺風物資管理與盤點系統專為佛教寺院/基金會的大量出版品、法物、專業器材及生活消耗品設計，解決過去人工紙本盤點不易、主檔建置繁瑣、物資無照片對照等痛點。

系統具備**「雙軌作業模式」**：
1. **零庫存前置建檔軌（Web App）**：志工利用手機瀏覽器直接拍攝物資封面，經 Gemini AI 自動擷取書名、作者、條碼並建議分類，派發專屬流水號寫入主檔，**不預設綁定庫存與儲位**。
2. **階層式導航盤點軌（LINE Bot）**：經實名雙重認證的志工進入 LINE 對話框，依序透過「據點 ➔ 樓層 ➔ 空間 ➔ 櫃子 ➔ 層格」階層定位，以模糊搜尋比對物資並清點數量，支援即時防呆補救修改。

---

## 2. 系統架構與技術棧 (Tech Stack & Architecture)

```
                       +---------------------------------------+
                       |           志工操作端 (Client)          |
                       +-------------------+-------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
            [LINE 官方帳號]                              [行動裝置瀏覽器]
       (階層導航盤點 / 即時更正)                     (零庫存前置拍照建檔)
                    |                                             |
            LINE Webhook (doPost)                        Web App RPC (doGet)
                    |                                             |
                    +----------------------+----------------------+
                                           |
                                           v
    +-----------------------------------------------------------------------------+
    |                     Google Apps Script (GAS V8 Runtime)                     |
    |                                                                             |
    |  [1_Config.js]       : 命名空間配置 (CONFIG, UI, CMD, STATE)                  |
    |  [2_Main.js]         : Webhook 去重、狀態機 (Strategy Pattern)、Web App RPC   |
    |  [3_Controllers.js]  : 返回導航堆疊 (handleGoBack)、快捷系統指令控制器       |
    |  [4_Database.js]     : withSpreadsheet 悲觀鎖封裝、動態欄位解析、CRUD 操作   |
    |  [5_FlexTemplates.js]: Flex Message 2.0 視覺卡片樣板與 LINE API 轉發         |
    +--------------------------------------+--------------------------------------+
                                           |
          +--------------------------------+--------------------------------+
          |                                |                                |
          v                                v                                v
+-------------------+            +-------------------+            +-------------------+
|   Google Sheets   |            |   Google Drive    |            | Google Gemini API |
|   (關聯資料庫)     |            |  (物資封面圖存儲)   |            | (Flash-Lite /     |
| - SKU_MASTER      |            |                   |            |  3.5 / 3.8 備援)  |
| - LOC_MASTER      |            +-------------------+            +-------------------+
| - SUB_ZONE_DETAIL |
| - USER_MASTER     |
| - STOCKTAKE_LOG   |
| - CURRENT_STOCK   |
| - CATEGORY_MASTER |
+-------------------+
```

---

## 3. 資料庫架構與表格規範 (Database Schema)

資料庫採用 Google Sheets 模擬關聯式資料庫，各工作表規範如下：

### 3.1 `SKU_MASTER` (物資主檔)
儲存物資基本屬性，支援零庫存前置建檔與盤點比對。

| 欄位名稱 | 必填 | 說明與範例 |
| :--- | :---: | :--- |
| **品項編號** | 是 | 主鍵 (PK)。格式為 `大類代碼 + 7位流水號`，例如 `H0000001`、`A0000012` |
| **大類代碼** | 是 | 單一英數字，如 `H`、`A`、`B` |
| **大類名稱** | 是 | 對齊 `CATEGORY_MASTER`，如 `出版品與佛藝書籍` |
| **物品名稱** | 是 | 書名或物資全稱，例如《大智慧到彼岸》 |
| **規格或作者** | 否 | 書籍作者、規格或型號，例如「釋寬謙」、「印順導師」 |
| **單位** | 是 | 預設為「本」，亦可為「套」、「個」、「箱」 |
| **條碼編號** | 否 | ISBN 或 EAN-13 純數字，如 `9789579934335` |
| **封面圖片URL** | 否 | 雲端硬碟檢視連結或 Google CDN 縮圖網址 |
| **建檔來源** | 是 | 例如 `LINE拍照入庫`、`批次匯入` |
| **建立人員** | 是 | 登記人員姓名或 `系統建檔` |
| **建立時間** | 是 | 格式：`YYYY-MM-DD HH:mm:ss` |

### 3.2 `CATEGORY_MASTER` (物資大類代碼表)
定義物資大類及流水號編號前綴。

| 欄位名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| **大類代碼** | 是 | 英文單碼 (PK)，例如 `A`、`B`、`C`、`H` |
| **大類名稱** | 是 | 大類中文說明，例如 `宗教與儀式物品`、`出版品與佛藝書籍` |

### 3.3 `USER_MASTER` (志工人員主檔)
提供實名雙重認證與盤點責任歸屬。

| 欄位名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| **人員編號** | 是 | 志工編號 (PK)，如 `U001` |
| **人員姓名** | 是 | 實名認證姓名 |
| **手機號碼** | 是 | 認證核對比對（支援末 4 碼或 10 碼全碼） |
| **LINE_UID** | 否 | 認證成功後自動回寫之 LINE 使用者識別碼（唯一綁定） |
| **隸屬組織/部門**| 否 | 所屬單位（如：弘法部、行政組） |
| **職稱/身份** | 否 | 志工職稱 |

### 3.4 `LOC_MASTER` (場域與儲位主檔)
定義實體物理空間的三層階層（據點 ➔ 樓層 ➔ 空間）。

| 欄位名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| **場域編碼** | 是 | 空間代碼 (PK)，如 `Z-F1`、`H-B1` |
| **據點** | 是 | 實體建築，例如 `覺風學院`、`寬謙紀念館` |
| **樓層** | 是 | 樓層名稱，例如 `1F`、`2F`、`B1` |
| **場域名稱** | 是 | 空間稱呼，例如 `大殿`、`小教室` |
| **儲位詳細說明**| 否 | 空間別名或說明 |

### 3.5 `SUB_ZONE_DETAIL` (儲位微細配置表)
儲存櫃體與層格配置，以 JSON 格式儲存實體格位結構。

| 欄位名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| **儲位明細編碼**| 是 | 分區識別碼 (PK)，以場域編碼為前綴，如 `Z-F1-A` |
| **儲位分區名稱**| 是 | 分區展示名稱，例如 `A區展示櫃` |
| **實體層格微細配置**| 是 | JSON Array 結構，包含櫃體 (`box_id`, `box_name`) 與分層 (`shelves: [{ cell_code, name }]`) |

*微細配置 JSON 範例：*
```json
[
  {
    "box_id": "B01",
    "box_name": "靠窗高書櫃",
    "shelves": [
      { "cell_code": "Z-F1-A-B01#1", "name": "第 1 層 (最上層)" },
      { "cell_code": "Z-F1-A-B01#2", "name": "第 2 層" }
    ]
  }
]
```

### 3.6 `CURRENT_STOCK` (現有庫存表)
記錄物資在特定格位的當前存量（複合鍵：`儲位格位代碼` + `品項編號`）。

| 欄位名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| **場域編碼** | 是 | 上層空間代碼，如 `Z-F1` |
| **儲位格位代碼**| 是 | 實體格位代碼，如 `Z-F1-A-B01#1` |
| **品項編號** | 是 | 對應 `SKU_MASTER.品項編號` |
| **物品名稱** | 是 | 盤點品名快照 |
| **現有庫存量** | 是 | 整數數值（$\ge 0$） |

### 3.7 `STOCKTAKE_LOG` (盤點紀錄日誌)
不可竄改的異動紀錄流水帳（更正操作採覆蓋最新一筆或修正關聯列）。

| 欄位名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| **流水編號** | 是 | `LOG-001` 等自動生成流水號 |
| **日期時間** | 是 | 盤點時間戳 |
| **人員編號** | 是 | 執行人員編號 (`USER_MASTER.人員編號`) |
| **儲位格位代碼**| 是 | 盤點格位代碼 |
| **品項編號** | 是 | 盤點品項編號 |
| **物品名稱** | 是 | 物品名稱 |
| **實清數量** | 是 | 當次清點數量 |

---

## 4. 系統工作流程與狀態機架構

### 4.1 實名雙重認證流程 (Dual Binding)
志工首次使用 Bot 時觸發強制作業：
1. **輸入姓名**：比對 `USER_MASTER` 的「人員姓名」。
2. **輸入手機末碼/全碼**：驗證該人員的「手機號碼」。
3. **查重與綁定**：
   - 若同名同末碼者多於 1 人，提示輸入 10 碼全碼。
   - 若資料吻合且該帳號未被其他人綁定，回寫 `LINE_UID` 至 `USER_MASTER` 並開通盤點權限。

### 4.2 零庫存前置拍照建檔 (Web App Workflow)
專用於尚未建立主檔的物資：
1. **拍照/上傳**：前端 Canvas 自動將影像壓縮至寬度 800px、JPEG 品質 0.6，轉為 Base64。
2. **後端處理**：
   - 存入指定的 Google Drive 資料夾 (`INBOUND_IMG_FOLDER_ID`)。
   - 呼叫 `callGeminiVisionRecognition`，依序以 `gemini-flash-lite-latest`、`gemini-3.5-flash-lite`、`gemini-3.8-flash` 備援辨識品名、作者、大類。
3. **獨立條碼掃描**：若封面無條碼，可點擊「📷 拍條碼」呼叫 `recognizeBarcodeOnly` 針對封底/版權頁萃取純數字條碼。
4. **確認派號**：志工核對並提交後，呼叫 `appendSkuMasterRecord`，依所屬大類代碼取得當前最大流水號並派號（如 `H0000008`），寫入 `SKU_MASTER`。**完全不更動庫存表與日誌表**。

### 4.3 階層式引導盤點狀態機 (FSM via Strategy Pattern)
盤點對話流程採用策略模式（Object Mapping）拆解：

```
[選擇據點: STATE_CHOOSE_SITE]
       │
       ▼
[選擇樓層: STATE_CHOOSE_FLOOR]
       │
       ▼
[選擇空間: STATE_CHOOSE_LOC]
       │
       ▼
[選擇櫃位: STATE_CHOOSE_ZONE]
       │
       ▼
[選擇櫃子: STATE_CHOOSE_BOX]
       │
       ▼
[選擇層格: STATE_CHOOSE_CELL]
       │
       ▼
[搜尋物品: STATE_INPUT_SKU] ◄──────+ (同格位盤下一件)
       │                           │
       ▼ (單筆命中 / 選擇清單)       │
[輸入數量: STATE_INPUT_QTY]        │
       │                           │
       ▼ (寫入 LOG 與 STOCK)        │
[完成盤點: STATE_POST_STOCKTAKE] ───+
       │
       ├─► ✏️ 即時補救 [STATE_CORRECT_ITEM_NAME] / [STATE_CORRECT_QTY] / 刪除
       ├─► 🚪 盤同櫃其他層格 (STATE_CHOOSE_CELL)
       ├─► 🗄️ 盤同空間其他櫃位 (STATE_CHOOSE_ZONE)
       └─► 🏛️ 更換據點/空間 (STATE_CHOOSE_SITE)
```

### 4.4 返回導航堆疊 (Hierarchical Go-Back)
使用者於各階段點擊「↩️ 返回」按鈕時，由 `handleGoBack` 依序退回上一層級，且保留上一層的選單上下文：
- `STATE_INPUT_SKU` ➔ 返回層格清單 (`STATE_CHOOSE_CELL`)
- `STATE_CHOOSE_CELL` ➔ 返回櫃子清單 (`STATE_CHOOSE_BOX`)
- `STATE_CHOOSE_BOX` ➔ 返回櫃位清單 (`STATE_CHOOSE_ZONE`)
- `STATE_CHOOSE_ZONE` ➔ 返回空間清單 (`STATE_CHOOSE_LOC`)
- `STATE_CHOOSE_LOC` ➔ 返回樓層清單 (`STATE_CHOOSE_FLOOR`)
- `STATE_CHOOSE_FLOOR` ➔ 返回據點清單 (`STATE_CHOOSE_SITE`)

---

## 5. 程式模組與職責劃分

| 檔案名稱 | 核心職責 | 重要函式 / 常數 |
| :--- | :--- | :--- |
| **`1_Config.js`** | 命名空間集中管理、相容層別名導出 | `CONFIG`, `UI`, `CMD`, `STATE` |
| **`2_Main.js`** | Webhook 去重過濾、Web App 進入點、Gemini 視覺模型調用、狀態機策略字典 | `doPost`, `doGet`, `handleLineMessage`, `StateHandlers`, `SessionManager`, `uploadAndAnalyzeImage`, `callGeminiVisionRecognition`, `recognizeBarcodeOnly` |
| **`3_Controllers.js`** | 盤點完成後之快速指令分流、階層返回導航處理 | `isSystemControlCommand`, `handleSystemCommand`, `handleGoBack` |
| **`4_Database.js`** | 悲觀鎖封裝 (`withSpreadsheet`)、動態欄位解析、主檔與日誌讀寫、格位微細配置解析 | `withSpreadsheet`, `getSheetColumnIndexes`, `appendSkuMasterRecord`, `executeUpdateStockWorkflow`, `correctLastItemName`, `correctLastQty`, `deleteLastRecord`, `getAllSites`, `parseBoxesFromZone`, `parseShelvesFromBox`, `processDualBinding`, `findSKU` |
| **`5_FlexTemplates.js`** | LINE Flex Message 2.0 訊息樣板生成與 API 發送（含 Google CDN 高清圖片轉換） | `replyFlexMenuCard`, `replyFlexSearchPromptCard`, `replyFlexConfirmSingleSkuCard`, `replyFlexSkuVerticalList`, `replyFlexPostStocktakeCard`, `replyFlexCorrectionMenu`, `replyCorrectionSuccessWithMonk`, `sendToLine` |
| **`Index.html`** | 前端拍照建檔 Single Page Application | HTML5 相機調用、Canvas 圖片壓縮、非同步 RPC 提交 |
| **`appsscript.json`** | 專案資訊清單與 OAuth 授權範圍宣告 | 包含 Drive、Sheets 與 External Request 權限 |

---

## 6. 系統安全與併發控制機制

1. **LockService 悲觀鎖控制**：
   - 透過 `withSpreadsheet(action, requireLock = true, timeout = 10000)` 統一管理。
   - 在主檔派發流水號、更新庫存量、更正紀錄及寫入日誌時均強制要求 ScriptLock，避免多名志工併發盤點或建檔造成流水號衝突或庫存覆蓋。
2. **LINE Webhook 防重複消費機制**：
   - 攔截 LINE 測試用之無效 ReplyToken (`00000000000000000000000000000000` 與 `ffffffffffffffffffffffffffffffff`)。
   - 攔截 `event.deliveryContext.isRedelivery === true`。
   - 透過 `CacheService.getUserCache()` 將 `event.message.id` 寫入暫存，TTL 設定為 60 秒，徹底杜絕網路重試重複處理。
3. **動態欄位容錯解析 (`getSheetColumnIndexes`)**：
   - 所有資料表讀取改採標題文字動態查表，不再寫死欄位索引數字（例如自動適應「規格或作者」與「規格/作者」、「封面圖片URL」與「圖片網址」），避免試算表欄位微調造成系統錯誤。

---

## 7. Gemini AI 整合規範

1. **多模型容錯切換 (Fallback Mechanism)**：
   - 第一優先：`gemini-flash-lite-latest`（速度極快、成本極低）
   - 第二優先：`gemini-3.5-flash-lite`（穩定性備援）
   - 第三優先：`gemini-3.8-flash`（深度理解備援）
   - 當收到 HTTP 503（伺服器忙碌）或 429（頻率超限）狀態碼時，自動延遲 300ms 並切換下一模型。
2. **結構化 JSON 輸出約束**：
   - 請求設定採用 `responseMimeType: "application/json"`，要求模型輸出合法 JSON 字串，以方便後端解析品名、作者、條碼與分類。

---

## 8. 環境變數配置 (Script Properties)

部署前必須在 Apps Script 的「專案設定」➔「指令碼屬性」填入以下鍵值：

| 屬性名稱 | 必填 | 說明 |
| :--- | :---: | :--- |
| `SPREADSHEET_ID` | 是 | Google 試算表識別碼 |
| `LINE_ACCESS_TOKEN` | 是 | LINE Messaging API Channel Access Token (長效憑證) |
| `GEMINI_API_KEY` | 是 | Google AI Studio 申請之 Gemini API 金鑰 |
| `INBOUND_IMG_FOLDER_ID` | 是 | 存放前置建檔封面相片的 Google 雲端硬碟資料夾 ID |
| `WEB_APP_URL` | 是 | 發布網頁應用程式後的 Executable 網址（供 Flex Message 跳轉） |

---

## 9. 部署與維護指引

1. **程式碼更新**：
   - 透過 `clasp push` 或直接在 Google Apps Script 編輯器貼上覆蓋。
2. **發布新版本**：
   - 每次修改程式碼後，必須點擊「部署」➔「管理部署作業」➔ 編輯目前部署 ➔ 版本選擇「建立新版本」➔ 儲存。
3. **Webhook 設定**：
   - 將 Apps Script 的 Web App 網址貼至 LINE Developers Console 內的 Webhook URL，並開啟「Use webhook」。