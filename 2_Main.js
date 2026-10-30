/**
 * 模組 2：主程式進入點、Web App RPC、LINE 狀態機與極速盤點導航流程 (2_Main.js)
 */

// ==================== 安全變數取值輔助工具 (避免全域宣告衝突) ====================
function getLineAccessToken() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.LINE_ACCESS_TOKEN) return CONFIG.LINE_ACCESS_TOKEN;
  } catch (e) {}
  return PropertiesService.getScriptProperties().getProperty('LINE_ACCESS_TOKEN') || '';
}

function getGeminiApiKey() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.GEMINI_API_KEY) return CONFIG.GEMINI_API_KEY;
  } catch (e) {}
  return PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
}

function getInboundFolderId() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.INBOUND_IMG_FOLDER_ID) return CONFIG.INBOUND_IMG_FOLDER_ID;
  } catch (e) {}
  return PropertiesService.getScriptProperties().getProperty('INBOUND_IMG_FOLDER_ID') || '';
}

function getWebAppUrl() {
  try {
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.WEB_APP_URL) return CONFIG.WEB_APP_URL;
  } catch (e) {}
  return PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || '';
}

// ==================== 1. Web App (doGet) 與 Webhook (doPost) 進入點 ====================
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  const params = (e && e.parameter) ? e.parameter : {};
  
  const cell = params.cell || '';
  let shelf = params.shelf || '';
  let space = params.space || '';
  let box = params.box || '';

  // 1. 提取短碼標籤（如 B3-S1、B2-S3、B5-S3）
  let shortTag = '';
  if (cell && cell.includes('#')) {
    shortTag = cell.split('#')[1].trim();
  }

  // 2. 提取/自動補齊空間名稱（大安覺風 地下1樓 小教室）
  let locName = '';
  if (space) {
    locName = space.split('-')[0].trim();
  }
  if (!locName || (!locName.includes('小教室') && cell.startsWith('DA-004'))) {
    locName = '大安覺風 地下1樓 小教室';
  } else if (!locName && cell.startsWith('DA-009')) {
    locName = '大安覺風 地下1樓 櫃檯展示區';
  }

  // 3. 清理 shelf 字串，移除可能殘留的重複前綴
  let cleanShelf = shelf;
  if (cleanShelf) {
    cleanShelf = cleanShelf
      .replace(/^\[.*?\]\s*/, '')
      .replace(/大安覺風.*?小教室\s*([｜\-|]\s*)?/, '')
      .trim();
  }

  // 4. 組裝「零思考」直覺定位標籤：[B3-S1] 大安覺風 地下1樓 小教室 ｜ 第3櫃-第1層(上)
  let displayTitle = '';
  if (shortTag) {
    displayTitle += `[${shortTag}] `;
  }
  if (locName) {
    displayTitle += `${locName} ｜ `;
  }
  displayTitle += (cleanShelf || '本格位');

  shelf = displayTitle.trim();

  template.mode = params.mode || 'inbound';
  template.cell = cell;
  template.uid = params.uid || '';
  template.userName = params.name || '';
  template.shelf = shelf;
  template.box = box;
  template.space = space;

  const title = template.mode === 'stocktake' ? '覺風格位拍照批次盤點' : '覺風物資前置拍照建檔';

  return template.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) return HtmlService.createHtmlOutput("OK");

  try {
    const postData = JSON.parse(e.postData.contents);
    const events = postData.events;
    
    if (events && events.length > 0) {
      const event = events[0];
      
      if (event.replyToken === "00000000000000000000000000000000" || event.replyToken === "ffffffffffffffffffffffffffffffff") {
        return HtmlService.createHtmlOutput("OK");
      }

      if (event.deliveryContext && event.deliveryContext.isRedelivery === true) {
        return HtmlService.createHtmlOutput("OK");
      }

      if (event.message && event.message.id) {
        const cache = CacheService.getUserCache();
        const msgKey = "PROCESSED_MSG_" + event.message.id;
        if (cache.get(msgKey)) {
          return HtmlService.createHtmlOutput("OK");
        }
        cache.put(msgKey, "1", 60);
      }

      writeDebugLog(e.postData.contents);

      if (event.type === 'message' && event.message) {
        if (event.message.type === 'text') {
          handleLineMessage(event);
        } else if (event.message.type === 'image') {
          handleLineImageMessage(event);
        }
      }
    }
  } catch (error) {
    writeDebugLog("doPost 執行錯誤: " + error.message);
  }
  
  return HtmlService.createHtmlOutput("OK");
}

// ==================== 2. 前端 Web App RPC 介面 ====================
function getCategoryList() {
  try {
    return getCategoryMasterList();
  } catch (e) {
    writeDebugLog("getCategoryList 失敗: " + e.message);
    return [];
  }
}
function getCategoriesForFrontend() {
  return getCategoryList();
}

function searchSkuCandidates(keyword) {
  try {
    const matched = findSKU(keyword);
    const candidates = matched.map(m => {
      const rawCover = (m['封面圖片URL'] || m['圖片網址'] || '').toString().trim();
      const rawInner = (m['內頁圖片URL'] || m['版權頁圖片URL'] || '').toString().trim();
      let thumbUrl = rawCover || rawInner;
      if (thumbUrl.includes("drive.google.com")) {
        const match = thumbUrl.match(/id=([a-zA-Z0-9_-]+)/) || thumbUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) thumbUrl = `https://lh3.googleusercontent.com/d/${match[1]}=w200`;
      }
      return {
        skuId: (m['品項編號'] || m['sku_id'] || '').toString(),
        itemName: (m['物品名稱'] || m['品名'] || '').toString(),
        author: (m['規格或作者'] || m['規格/作者'] || m['作者'] || '').toString(),
        category: (m['大類名稱'] || m['大類'] || '').toString(),
        barcode: (m['條碼編號'] || m['ISBN/條碼'] || '').toString(),
        imageUrl: thumbUrl,
        hasCover: !!rawCover,
        hasInner: !!rawInner,
        coverUrl: rawCover,
        innerUrl: rawInner,
        publisher: (m['出版社'] || '').toString(),
        edition: (m['版次與年份'] || '').toString(),
        price: (m['定價'] || '').toString()
      };
    });
    return { success: true, candidates: candidates };
  } catch (err) {
    return { success: false, message: err.message, candidates: [] };
  }
}

function uploadStocktakeCover(skuId, base64Data, mimeType) {
  try {
    const folderId = getInboundFolderId();
    if (!folderId) throw new Error("未設定 INBOUND_IMG_FOLDER_ID");
    const folder = DriveApp.getFolderById(folderId);
    const timestampStr = Utilities.formatDate(new Date(), "GMT+8", "yyyyMMdd_HHmmss");

    const coverBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType || "image/jpeg", `COVER_${skuId}_${timestampStr}.jpg`);
    const coverFile = folder.createFile(coverBlob);
    const coverUrl = `https://drive.google.com/uc?id=${coverFile.getId()}`;
    const thumbUrl = `https://lh3.googleusercontent.com/d/${coverFile.getId()}=w200`;

    updateSkuMetadataAndImages(skuId, { coverUrl: coverUrl });

    return { success: true, coverUrl: coverUrl, thumbUrl: thumbUrl };
  } catch (err) {
    writeDebugLog("uploadStocktakeCover 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

function uploadAndAnalyzeSingleCipForStocktake(skuId, base64Data, mimeType) {
  try {
    const folderId = getInboundFolderId();
    if (!folderId) throw new Error("未設定 INBOUND_IMG_FOLDER_ID");
    const folder = DriveApp.getFolderById(folderId);
    const timestampStr = Utilities.formatDate(new Date(), "GMT+8", "yyyyMMdd_HHmmss");

    const innerBlob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType || "image/jpeg", `CIP_${skuId}_${timestampStr}.jpg`);
    const innerFile = folder.createFile(innerBlob);
    const innerUrl = `https://drive.google.com/uc?id=${innerFile.getId()}`;

    const prompt = `你是一個專業圖書編目專家。請仔細觀察這張書籍【版權頁 / 內頁 CIP 預行編目資料 / 封底條碼】照片：
1. 提取最標準權威的正題名/書名。
2. 提取著譯者姓名。
3. 提取純數字 ISBN 條碼（去除所有連字號與括號說明）。
4. 提取出版社（出版者或發行機構）。
5. 提取版次與出版年月（例如「2014年3月 二版」）。
6. 提取定價數字（例如「380」）。
若照片完全找不到某個欄位，請填入空字串。
請只回傳標準 JSON：
{"itemName": "完整書名", "author": "作者姓名", "barcode": "純數字ISBN", "publisher": "出版社", "edition": "版次與年份", "price": "定價"}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const apiKey = getGeminiApiKey();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    let meta = { itemName: "", author: "", barcode: "", publisher: "", edition: "", price: "" };
    if (response.getResponseCode() === 200) {
      const resJson = JSON.parse(response.getContentText());
      if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
        let raw = resJson.candidates[0].content.parts[0].text;
        raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        meta = JSON.parse(raw);
      }
    }

    updateSkuMetadataAndImages(skuId, {
      innerUrl: innerUrl,
      publisher: meta.publisher || "",
      edition: meta.edition || "",
      price: meta.price || "",
      barcode: meta.barcode || ""
    });

    return {
      success: true,
      innerUrl: innerUrl,
      publisher: meta.publisher || "",
      edition: meta.edition || "",
      price: meta.price || "",
      recognizedTitle: meta.itemName || "",
      recognizedAuthor: meta.author || ""
    };
  } catch (err) {
    writeDebugLog("uploadAndAnalyzeSingleCipForStocktake 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

function uploadAndAnalyzeDualImages(coverBase64, innerBase64, mimeType) {
  try {
    const folderId = getInboundFolderId();
    if (!folderId) {
      throw new Error("系統未設定 INBOUND_IMG_FOLDER_ID 指令碼屬性");
    }

    const folder = DriveApp.getFolderById(folderId);
    const timestampStr = Utilities.formatDate(new Date(), "GMT+8", "yyyyMMdd_HHmmss");

    let coverUrl = "";
    if (coverBase64) {
      const coverBlob = Utilities.newBlob(Utilities.base64Decode(coverBase64), mimeType || "image/jpeg", `COVER_${timestampStr}.jpg`);
      const coverFile = folder.createFile(coverBlob);
      coverUrl = `https://drive.google.com/uc?id=${coverFile.getId()}`;
    }

    let innerUrl = "";
    if (innerBase64) {
      const innerBlob = Utilities.newBlob(Utilities.base64Decode(innerBase64), mimeType || "image/jpeg", `CIP_${timestampStr}.jpg`);
      const innerFile = folder.createFile(innerBlob);
      innerUrl = `https://drive.google.com/uc?id=${innerFile.getId()}`;
    }

    let aiResult = { itemName: "", author: "", barcode: "", category: "出版品與佛藝書籍", publisher: "", edition: "", price: "" };
    try {
      aiResult = callGeminiDualImageRecognition(coverBase64, innerBase64, mimeType);
    } catch (aiErr) {
      writeDebugLog("Gemini 雙圖辨識例外: " + aiErr.message);
    }

    return {
      success: true,
      imageUrl: coverUrl,
      innerImageUrl: innerUrl,
      recognizedName: aiResult.itemName || "",
      author: aiResult.author || "",
      barcode: aiResult.barcode || "",
      category: aiResult.category || "出版品與佛藝書籍",
      publisher: aiResult.publisher || "",
      edition: aiResult.edition || "",
      price: aiResult.price || ""
    };
  } catch (err) {
    writeDebugLog("uploadAndAnalyzeDualImages 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

function callGeminiDualImageRecognition(coverBase64, innerBase64, mimeType) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return { itemName: "", author: "", barcode: "", category: "出版品與佛藝書籍", publisher: "", edition: "", price: "" };
  }

  const candidateModels = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"];

  const prompt = `你是一個專業圖書編目專家。使用者提供了這本書的影像資料：
${coverBase64 ? '- 第一張影像：書籍【封面】（有題名設計、視覺字體或裝幀外觀）。' : ''}
${innerBase64 ? '- 第二張影像：書籍【版權頁 / 內頁 CIP 國家圖書館預行編目資料】（具有最標準權威的正題名、著譯者、ISBN 編號、出版社、版次與定價）。' : ''}

【提取準則】：
1. 【物品名稱/書名】：優先以【版權頁/CIP】所標記的正式出版品書名為準。
2. 【作者/著者】：優先以版權頁/CIP所載之著者、譯者或註述者姓名為主。
3. 【ISBN或條碼】：請從版權頁的 ISBN 欄位提取純數字條碼（去除所有連字號與括號說明）。
4. 【大類名稱】：推論所屬大類（出版品與佛藝書籍、宗教與儀式物品、專業影音廣播、辦公與生活家電、消耗品與雜項）。
5. 【出版社】：版權頁或CIP所記載之出版者或發行機構名稱。
6. 【版次與年份】：版權頁記載之最新版次與印刷年份。
7. 【定價】：版權頁標示之定價數字。

請務必只回傳標準 JSON 字串：
{"itemName": "完整書名", "author": "作者姓名", "barcode": "純數字ISBN", "category": "大類名稱", "publisher": "出版社名稱", "edition": "版次與年份", "price": "定價"}`;

  const parts = [{ text: prompt }];

  if (coverBase64) parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: coverBase64 } });
  if (innerBase64) parts.push({ inlineData: { mimeType: mimeType || "image/jpeg", data: innerBase64 } });

  const payload = {
    contents: [{ parts: parts }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      if (response.getResponseCode() === 200) {
        const resJson = JSON.parse(response.getContentText());
        if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
          let raw = resJson.candidates[0].content.parts[0].text;
          raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          return JSON.parse(raw);
        }
      } else if (response.getResponseCode() === 503 || response.getResponseCode() === 429) {
        Utilities.sleep(300);
      }
    } catch (err) {}
  }

  return { itemName: "", author: "", barcode: "", category: "出版品與佛藝書籍", publisher: "", edition: "", price: "" };
}

function uploadAndAnalyzeImage(base64Data, mimeType) {
  return uploadAndAnalyzeDualImages(base64Data, null, mimeType);
}

function analyzeStocktakePhoto(base64Data, mimeType) {
  try {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      throw new Error("未設定 GEMINI_API_KEY");
    }

    const recognizedList = callGeminiMultiItemRecognition(base64Data, mimeType);

    const results = recognizedList.map(item => {
      const keyword = item.itemName || "";
      const barcode = item.barcode || "";
      const author = item.author || "";
      const matched = (keyword || barcode || author) ? findSKU(keyword, barcode, author) : [];

      const candidates = matched.map(m => {
        const rawCover = (m['封面圖片URL'] || m['圖片網址'] || '').toString().trim();
        const rawInner = (m['內頁圖片URL'] || m['版權頁圖片URL'] || '').toString().trim();
        let thumbUrl = rawCover || rawInner;
        if (thumbUrl.includes("drive.google.com")) {
          const match = thumbUrl.match(/id=([a-zA-Z0-9_-]+)/) || thumbUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
          if (match && match[1]) {
            thumbUrl = `https://lh3.googleusercontent.com/d/${match[1]}=w200`;
          }
        }

        return {
          skuId: (m['品項編號'] || m['sku_id'] || '').toString(),
          itemName: (m['物品名稱'] || m['品名'] || '').toString(),
          author: (m['規格或作者'] || m['規格/作者'] || m['作者'] || '').toString(),
          category: (m['大類名稱'] || m['大類'] || '').toString(),
          barcode: (m['條碼編號'] || m['ISBN/條碼'] || '').toString(),
          imageUrl: thumbUrl,
          hasCover: !!rawCover,
          hasInner: !!rawInner,
          coverUrl: rawCover,
          innerUrl: rawInner,
          publisher: (m['出版社'] || '').toString(),
          edition: (m['版次與年份'] || '').toString(),
          price: (m['定價'] || '').toString()
        };
      });

      return {
        rawName: keyword,
        rawAuthor: author,
        rawBarcode: barcode,
        candidates: candidates
      };
    });

    return { success: true, items: results };
  } catch (err) {
    writeDebugLog("analyzeStocktakePhoto 錯誤: " + err.message);
    return { success: false, message: err.message, items: [] };
  }
}

function callGeminiMultiItemRecognition(base64Data, mimeType) {
  const apiKey = getGeminiApiKey();
  const candidateModels = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"];

  const prompt = `你是一個專業的圖書與佛寺物資盤點助理。請觀察這張照片，辨識畫面中出現的所有書籍或物品：
1. 找出畫面中所有清楚可見的書籍品名/書名（若有期數，如《覺風期刊 第82期》，請務必完整保留）。
2. 若有標註作者、編著者，請擷取。
3. 若有看見 ISBN 或條碼數字，請擷取純數字。
4. 請務必只回傳合法的 JSON 字串，格式限定為：
{
  "items": [
    {"itemName": "完整書名或品名", "author": "作者姓名", "barcode": "ISBN或條碼數字"}
  ]
}
若畫面中完全沒有物資，請回傳 {"items": []}。請不要輸出任何 Markdown 格式或額外說明文字。`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      if (response.getResponseCode() === 200) {
        const resJson = JSON.parse(response.getContentText());
        if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
          let raw = resJson.candidates[0].content.parts[0].text;
          raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(raw);
          return parsed.items || [];
        }
      }
    } catch (err) {}
  }
  return [];
}

function batchUpdateStock(cellCode, userId, items) {
  try {
    return executeBatchStockWorkflow(userId, cellCode, items);
  } catch (err) {
    writeDebugLog("batchUpdateStock 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

function createSkuMasterItem(data) {
  try {
    const newSku = appendSkuMasterRecord({
      name: data.itemName,
      author: data.author || "",
      category: data.category,
      barcode: data.barcode || "",
      imageUrl: data.imageUrl || "",
      innerImageUrl: data.innerImageUrl || "",
      publisher: data.publisher || "",
      edition: data.edition || "",
      price: data.price || ""
    });

    const statusNote = newSku.isExisting ? "（已存在物資，已更新詳細資料）" : "（新建物資）";
    return { 
      success: true, 
      skuId: newSku.id, 
      message: `成功建立品項：${newSku.id} ${data.itemName} ${statusNote}` 
    };
  } catch (err) {
    writeDebugLog("createSkuMasterItem 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

// ==================== 3. 實體櫃位標籤視覺辨識核心 ====================

function fetchLineImageBlob(messageId) {
  const token = getLineAccessToken();
  if (!token) {
    throw new Error("系統未設定 LINE_ACCESS_TOKEN 指令碼屬性");
  }

  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(`無法取得 LINE 圖片內容 (HTTP ${response.getResponseCode()})`);
  }
  return response.getBlob();
}

function recognizeShelfLabelFromPhoto(base64Data, mimeType) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const prompt = `你是一個精準的佛寺書架與儲位標籤辨識專家。請觀察這張照片，尋找貼在書架層板邊緣或抽屜上的白色手寫貼紙或標籤：
標籤規則：
1. 格式開頭必定為「B」接 1~2 位數字櫃號（例如 B1 到 B24）。
2. 連字號「-」後方為層架「S」或抽屜「D」接數字（例如 B3-S1、B3-S2、B5-S3、B6-S3、B7-S1、B22-D1、B24-S2）。
3. ⚠️ 關鍵筆跡校正：手寫英文字母「S」常被誤認成數字「5」（例如「B3-51」實際上是「B3-S1」、「B5-53」是「B5-S3」）。請務必依規則校正為「S」。

若畫面中有此標籤貼紙，請只回傳標準 JSON：
{"found": true, "code": "B3-S1"}
若完全找不到貼紙，請回傳：
{"found": false, "code": ""}`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`;
  try {
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const resJson = JSON.parse(response.getContentText());
      if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
        let raw = resJson.candidates[0].content.parts[0].text;
        raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(raw);
        if (parsed.found && parsed.code) {
          const match = parsed.code.match(/B(\d{1,2})[-_/\s]?([SD5])(\d{1,2})/i);
          if (match) {
            const boxNum = match[1];
            const type = (match[2].toUpperCase() === '5' || match[2].toUpperCase() === 'S') ? 'S' : match[2].toUpperCase();
            const shelfNum = match[3];
            return `B${boxNum}-${type}${shelfNum}`;
          }
          return parsed.code.toUpperCase();
        }
      }
    }
  } catch (err) {
    writeDebugLog("recognizeShelfLabelFromPhoto 錯誤: " + err.message);
  }
  return null;
}

function findShelfByLabel(shortCode, preferredLocOrZoneId) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    const zoneIdIdx = colMap['儲位明細編碼'];
    const zoneNameIdx = colMap['儲位分區名稱'];
    const jsonIdx = colMap['實體層格微細配置'];

    if (preferredLocOrZoneId) {
      for (let i = 1; i < data.length; i++) {
        const currentZoneId = data[i][zoneIdIdx] ? data[i][zoneIdIdx].toString().trim() : "";
        if (currentZoneId && (currentZoneId.startsWith(preferredLocOrZoneId) || currentZoneId === preferredLocOrZoneId)) {
          const matched = checkJsonForShelf(data[i][jsonIdx], shortCode, currentZoneId, data[i][zoneNameIdx]);
          if (matched) return matched;
        }
      }
    }

    for (let i = 1; i < data.length; i++) {
      const zoneId = data[i][zoneIdIdx] ? data[i][zoneIdIdx].toString().trim() : "";
      const zoneName = data[i][zoneNameIdx] ? data[i][zoneNameIdx].toString().trim() : "";
      const jsonStr = data[i][jsonIdx];
      const matched = checkJsonForShelf(jsonStr, shortCode, zoneId, zoneName);
      if (matched) return matched;
    }

    return null;
  }, false);
}

function checkJsonForShelf(jsonStr, shortCode, zoneId, zoneName) {
  if (!jsonStr) return null;
  try {
    const boxes = JSON.parse(jsonStr);
    const cleanShort = shortCode.toUpperCase().replace(/\s+/g, "");
    for (const box of boxes) {
      if (!box.shelves) continue;
      for (const shelf of box.shelves) {
        const cell = (shelf.cell_code || "").toUpperCase().replace(/\s+/g, "");
        if (cell.endsWith('#' + cleanShort) || 
            cell.endsWith('-' + cleanShort) ||
            cell === cleanShort) {
          return {
            cellCode: shelf.cell_code,
            shelfName: shelf.name,
            boxName: box.box_name || box.box_id,
            zoneId: zoneId,
            zoneName: zoneName || "儲位分區",
            defaultItem: shelf.default_item || ""
          };
        }
      }
    }
  } catch (e) {}
  return null;
}

function handleLineImageMessage(event) {
  const replyToken = event.replyToken;
  const lineUid = event.source.userId;
  const messageId = event.message.id;

  const currentVolunteer = getVolunteerByLineUid(lineUid);
  if (!currentVolunteer) {
    replyTextMessage(replyToken, "🙏 您好！請先完成志工身份綁定，再進行盤點作業。");
    return;
  }

  const myUserId = currentVolunteer['人員編號'];
  const myName = currentVolunteer['人員姓名'];
  const cachedSession = SessionManager.get(lineUid) || {};

  try {
    const blob = fetchLineImageBlob(messageId);
    const base64Data = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType();

    const recognizedCode = recognizeShelfLabelFromPhoto(base64Data, mimeType);
    if (!recognizedCode) {
      replyTextMessage(replyToken, "⚠️ 未能在照片中看清櫃位標籤貼紙（例如 B3-S1 或 B5-S3）。\n\n💡 請靠近一點、對焦清楚層板邊緣的白底手寫貼紙重新拍照！");
      return;
    }

    const targetShelf = findShelfByLabel(recognizedCode, cachedSession.locId || cachedSession.zoneId);
    if (!targetShelf) {
      replyTextMessage(replyToken, `⚠️ 辨識到標籤【${recognizedCode}】，但在系統層格配置中找不到對應儲位，請確認標籤文字是否正確。`);
      return;
    }

    const shortTag = targetShelf.cellCode.includes('#') ? targetShelf.cellCode.split('#')[1].trim() : recognizedCode;
    const fullLocName = '大安覺風 地下1樓 小教室';
    const displayShelf = `[${shortTag}] ${fullLocName} ｜ ${targetShelf.shelfName}`;

    cachedSession.state = 'STATE_INPUT_SKU';
    cachedSession.cellCode = targetShelf.cellCode;
    cachedSession.shelfName = targetShelf.shelfName;
    cachedSession.boxName = targetShelf.boxName;
    cachedSession.zoneId = targetShelf.zoneId;
    cachedSession.spaceName = fullLocName;
    SessionManager.save(lineUid, cachedSession, 3600);

    const webAppBase = getWebAppUrl();
    const webAppStocktakeUrl = `${webAppBase}?mode=stocktake` +
      `&cell=${encodeURIComponent(targetShelf.cellCode)}` +
      `&uid=${encodeURIComponent(myUserId)}` +
      `&name=${encodeURIComponent(myName)}` +
      `&shelf=${encodeURIComponent(displayShelf)}` +
      `&box=${encodeURIComponent(targetShelf.boxName)}` +
      `&space=${encodeURIComponent(fullLocName)}`;

    replyFlexSearchPromptCard(replyToken, fullLocName, targetShelf.boxName, `【${shortTag}】${targetShelf.shelfName}`, targetShelf.cellCode, false, webAppStocktakeUrl);
  } catch (err) {
    writeDebugLog("handleLineImageMessage 錯誤: " + err.message);
    replyTextMessage(replyToken, "❌ 圖片辨識處理異常，請稍後重試。");
  }
}

// ==================== 4. 🌟 極速盤點引導主卡片 (重構核心) ====================
function replyFlexStocktakeLauncher(replyToken, userName) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "⚡ 覺風極速盤點中心", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": `${userName} 您好，請選擇最方便的盤點方式：`, "size": "sm", "color": "#047857", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "spacing": "md",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F0FDF4",
          "borderColor": "#16A34A",
          "borderWidth": "1.5px",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "🌟 方式一：相機掃碼 (最推薦・0.1秒直達)", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "走到櫃架前，對準層板上的 QR Code 掃描，1秒開啟專屬盤點網頁，免選地點！", "size": "xs", "color": "#4B5563", "margin": "xs", "wrap": true },
            {
              "type": "button",
              "style": "primary",
              "color": "#16A34A",
              "height": "sm",
              "margin": "sm",
              "action": {
                "type": "uri",
                "label": "📷 開啟相機 掃描 QR Code",
                "uri": "https://line.me/R/nv/QRCodeReader"
              }
            }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#FEFCE8",
          "borderColor": "#CA8A04",
          "borderWidth": "1px",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "⚡ 方式二：快拍貼紙 / 輸入短碼", "weight": "bold", "size": "sm", "color": "#854D0E" },
            { "type": "text", "text": "直接拍照傳送手寫貼紙（如 B3-S1、B5-S3）或在對話框輸入代碼，系統秒跳直達按鈕！", "size": "xs", "color": "#713F12", "margin": "xs", "wrap": true }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F3F4F6",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "🗂️ 方式三：手動選櫃 (無標籤時備用)", "weight": "bold", "size": "sm", "color": "#374151" },
            { "type": "text", "text": "若所在區域尚未張貼標籤，請點擊下方按鈕依序選擇據點與空間。", "size": "xs", "color": "#6B7280", "margin": "xs", "wrap": true },
            {
              "type": "button",
              "style": "secondary",
              "height": "sm",
              "margin": "sm",
              "action": {
                "type": "message",
                "label": "🗂️ 手動選擇據點與空間",
                "text": "手動選櫃盤點"
              }
            }
          ]
        }
      ]
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "action": {
            "type": "message",
            "label": "🚪 結束盤點 (回主選單)",
            "text": "結束盤點"
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "⚡ 覺風極速盤點中心",
      "contents": flexContents
    }]
  });
}

// ==================== 5. Session 管理工具 ====================
const SessionManager = {
  get: function(userId) {
    const raw = CacheService.getUserCache().get(userId);
    return raw ? JSON.parse(raw) : null;
  },
  save: function(userId, sessionObj, ttl = 1200) {
    CacheService.getUserCache().put(userId, JSON.stringify(sessionObj), ttl);
  },
  clear: function(userId) {
    CacheService.getUserCache().remove(userId);
  }
};

// ==================== 6. 狀態處理策略群 ====================
const StateHandlers = {
  'STATE_LAUNCHER': function(ctx) {
    if (ctx.userMessage === '手動選櫃盤點' || ctx.userMessage === '手動選擇據點與空間') {
      startManualSiteSelection(ctx.replyToken, ctx.lineUid, ctx.userName);
      return;
    }
    replyFlexStocktakeLauncher(ctx.replyToken, ctx.userName);
  },

  'STATE_CHOOSE_SITE': function(ctx) {
    const selectedSite = ctx.userMessage;
    const floors = getFloorsBySite(selectedSite);
    if (floors.length === 0) {
      const sites = getAllSites();
      const menuItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
      replyFlexMenuCard(ctx.replyToken, "⚠️ 查無樓層", `找不到「${selectedSite}」底下的樓層配置，請重新選擇據點：`, menuItems, null);
      return;
    }
    ctx.session.state = 'STATE_CHOOSE_FLOOR';
    ctx.session.siteName = selectedSite;
    SessionManager.save(ctx.lineUid, ctx.session);
    const floorItems = floors.map(f => ({ title: f, desc: `${selectedSite} ${f}`, value: f }));
    replyFlexMenuCard(ctx.replyToken, "🏛️ 選擇所在樓層", `已選擇據點：${selectedSite}\n請點選所在【樓層】：`, floorItems, `↩️ 返回 [選擇據點]`);
  },

  'STATE_CHOOSE_FLOOR': function(ctx) {
    const selectedFloor = ctx.userMessage;
    const details = getDetailsBySiteAndFloor(ctx.session.siteName, selectedFloor);
    if (details.length === 0) {
      const floorsInSite = getFloorsBySite(ctx.session.siteName || "");
      const floorItems = floorsInSite.map(f => ({ title: f, desc: `${ctx.session.siteName} ${f}`, value: f }));
      replyFlexMenuCard(ctx.replyToken, "⚠️ 查無空間", `找不到「${ctx.session.siteName} ${selectedFloor}」的空間配置，請重新選擇樓層：`, floorItems, `↩️ 返回 [選擇據點]`);
      return;
    }
    ctx.session.state = 'STATE_CHOOSE_LOC';
    ctx.session.floorName = selectedFloor;
    SessionManager.save(ctx.lineUid, ctx.session);
    const spaceItems = details.map(d => ({ title: d.space_name, desc: `${ctx.session.siteName} ${selectedFloor} - ${d.space_name}`, value: d.loc_id }));
    replyFlexMenuCard(ctx.replyToken, "🏢 選擇具體空間", `已選擇：${ctx.session.siteName} ${selectedFloor}\n請點選具體【空間/展示區】：`, spaceItems, `↩️ 返回 [${ctx.session.siteName} 樓層]`);
  },

  'STATE_CHOOSE_LOC': function(ctx) {
    const locId = ctx.userMessage.toUpperCase();
    const zones = getZonesByLocation(locId); 
    const currentLocInfo = getLocationInfoById(locId);
    const spaceName = currentLocInfo ? currentLocInfo.space_name : locId;
    if (zones.length === 0) {
      const currentDetails = getDetailsBySiteAndFloor(ctx.session.siteName || "", ctx.session.floorName || "");
      const spaceItems = currentDetails.map(d => ({ title: d.space_name, desc: d.space_name, value: d.loc_id }));
      replyFlexMenuCard(ctx.replyToken, "⚠️ 查無櫃位", `找不到「${spaceName}」下的櫃位明細。請重新點選：`, spaceItems, `↩️ 返回 [${ctx.session.siteName} 樓層]`);
      return;
    }
    ctx.session.state = 'STATE_CHOOSE_ZONE';
    ctx.session.locId = locId;
    ctx.session.spaceName = spaceName;
    SessionManager.save(ctx.lineUid, ctx.session);
    const zoneItems = zones.map(z => ({ title: z.zone_name, desc: `${spaceName} - ${z.zone_name}`, value: z.zone_id }));

    const promptDesc = `已鎖定空間：【${spaceName}】！\n\n📸 極速盤點：直接對準眼前櫃架貼紙拍照（如 B3-S1、B5-S3、B22-D1）即可秒開盤點！\n\n亦可點選下方區域手動選櫃：`;
    replyFlexMenuCard(ctx.replyToken, "🗄️ 選擇櫃位區域", promptDesc, zoneItems, `↩️ 返回 [${ctx.session.floorName || "樓層空間"}]`);
  },

  'STATE_CHOOSE_ZONE': function(ctx) {
    const zoneId = ctx.userMessage.toUpperCase();
    const boxes = parseBoxesFromZone(zoneId); 
    const zoneName = getZoneNameById(zoneId);
    if (boxes.length === 0) {
      const currentZones = getZonesByLocation(ctx.session.locId || "");
      const zoneItems = currentZones.map(z => ({ title: z.zone_name, desc: z.zone_name, value: z.zone_id }));
      replyFlexMenuCard(ctx.replyToken, "❌ 查無櫃子", `找不到「${zoneName}」的空間配置。請重新點選：`, zoneItems, `↩️ 返回 [${ctx.session.spaceName || "空間清單"}]`);
      return;
    }
    ctx.session.state = 'STATE_CHOOSE_BOX';
    ctx.session.zoneId = zoneId;
    ctx.session.zoneName = zoneName;
    SessionManager.save(ctx.lineUid, ctx.session); 

    const boxItems = boxes.map(b => ({ title: b.display_label, desc: `點擊進入 ${b.display_label}`, value: b.display_label }));
    const promptDesc = `已鎖定分區：【${zoneName}】\n\n📸 推薦快拍：直接拍照傳送層板標籤（如 B3-S1 或 B5-S3）直達盤點！\n\n或點選下方按鈕手動選櫃：`;
    replyFlexMenuCard(ctx.replyToken, "🗃️ 選擇盤點櫃子", promptDesc, boxItems, `↩️ 返回 [${ctx.session.spaceName || "空間清單"}]`);
  },

  'STATE_CHOOSE_BOX': function(ctx) {
    const selectedBoxStr = ctx.userMessage;
    const selectedBoxId = selectedBoxStr.split('-')[0].toUpperCase().trim();
    const shelves = parseShelvesFromBox(ctx.session.zoneId, selectedBoxId); 
    if (shelves.length === 0) {
      const boxes = parseBoxesFromZone(ctx.session.zoneId);
      const boxItems = boxes.map(b => ({ title: b.display_label, desc: b.display_label, value: b.display_label }));
      replyFlexMenuCard(ctx.replyToken, "❌ 查無層格", `找不到該櫃子配置，請重新選擇櫃子：`, boxItems, `↩️ 返回 [${ctx.session.zoneName || "櫃位分區"}]`);
      return;
    }
    ctx.session.state = 'STATE_CHOOSE_CELL';
    ctx.session.boxId = selectedBoxId;
    ctx.session.boxName = selectedBoxStr;
    SessionManager.save(ctx.lineUid, ctx.session);
    const shelfItems = shelves.map(s => ({ title: `📍 [${s.short_code}] ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
    replyFlexMenuCard(ctx.replyToken, "🚪 選擇盤點層格", `已對齊櫃體：【${selectedBoxStr}】\n📸 亦可直接拍照傳送層架標籤！\n或點選具體【層格】：`, shelfItems, `↩️ 返回 [${ctx.session.zoneName || "櫃位分區"}]`);
  },

  'STATE_CHOOSE_CELL': function(ctx) {
    const cellCode = ctx.userMessage.toUpperCase().trim();
    const validShelves = parseShelvesFromBox(ctx.session.zoneId, ctx.session.boxId);
    const matchedShelf = validShelves.find(s => s.cell_code.toUpperCase().trim() === cellCode);
    if (!matchedShelf) {
      if (validShelves.length > 0) {
        const shelfItems = validShelves.map(s => ({ title: `📍 [${s.short_code}] ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
        replyFlexMenuCard(ctx.replyToken, "⚠️ 請重新點選", `未能識別層格，請點選下方大按鈕：`, shelfItems, `↩️ 返回 [${ctx.session.boxName || "櫃子清單"}]`);
      } else {
        replyTextMessage(ctx.replyToken, `❌ 系統狀態中斷，請重新輸入【開始盤點】。`);
      }
      return;
    }

    const shortTag = cellCode.includes('#') ? cellCode.split('#')[1].trim() : cellCode;
    const fullLocName = '大安覺風 地下1樓 小教室';
    const displayShelf = `[${shortTag}] ${fullLocName} ｜ ${matchedShelf.name}`;

    ctx.session.state = 'STATE_INPUT_SKU';
    ctx.session.cellCode = cellCode;
    ctx.session.shelfName = matchedShelf.name;
    SessionManager.save(ctx.lineUid, ctx.session);

    const webAppBase = getWebAppUrl();
    const webAppStocktakeUrl = `${webAppBase}?mode=stocktake` +
      `&cell=${encodeURIComponent(cellCode)}` +
      `&uid=${encodeURIComponent(ctx.userId)}` +
      `&name=${encodeURIComponent(ctx.userName)}` +
      `&shelf=${encodeURIComponent(displayShelf)}` +
      `&box=${encodeURIComponent(ctx.session.boxName || '')}` +
      `&space=${encodeURIComponent(fullLocName)}`;

    replyFlexSearchPromptCard(ctx.replyToken, fullLocName, ctx.session.boxName, `【${shortTag}】${matchedShelf.name}`, cellCode, false, webAppStocktakeUrl);
  },

  'STATE_INPUT_SKU': function(ctx) {
    const skus = findSKU(ctx.userMessage);
    ctx.session.pendingItemName = ctx.userMessage;

    if (skus.length === 0) {
      replyFlexInboundPromptCard(ctx.replyToken, ctx.userName);
      return;
    }

    if (skus.length > 1) {
      SessionManager.save(ctx.lineUid, ctx.session);
      replyFlexSkuVerticalList(ctx.replyToken, skus.slice(0, 6));
      return;
    }

    const targetSku = skus[0];
    ctx.session.state = 'STATE_INPUT_QTY';
    ctx.session.skuId = (targetSku['品項編號'] || targetSku['sku_id'] || targetSku['SKU_ID'] || '').toString();
    ctx.session.itemName = (targetSku['物品名稱'] || targetSku['品名'] || targetSku['name'] || '').toString();
    SessionManager.save(ctx.lineUid, ctx.session);

    replyFlexConfirmSingleSkuCard(ctx.replyToken, targetSku, ctx.userName);
  },

  'STATE_INPUT_QTY': function(ctx) {
    if (ctx.userMessage === ctx.session.skuId) {
      replyTextMessage(ctx.replyToken, `請在對話框中直接輸入本次盤點的【實清數量】數字（例如：5）：`);
      return;
    }

    const qty = parseInt(ctx.userMessage, 10);
    if (isNaN(qty) || qty < 0) {
      replyTextMessage(ctx.replyToken, "❌ 數量格式不正確，請輸入大於或等於 0 的純數字。");
      return;
    }
    
    const success = executeUpdateStockWorkflow(ctx.userId, ctx.session.cellCode, ctx.session.skuId, ctx.session.itemName, qty);
    if (success) {
      ctx.session.state = 'STATE_POST_STOCKTAKE';
      ctx.session.lastSkuId = ctx.session.skuId;
      ctx.session.lastItemName = ctx.session.itemName;
      ctx.session.lastQty = qty;
      SessionManager.save(ctx.lineUid, ctx.session, 1800);

      const fullChineseLocation = `${ctx.session.siteName || ""} ${ctx.session.floorName || ""} ${ctx.session.spaceName || ""} - ${ctx.session.boxName || ""} (${ctx.session.shelfName || ""})`;
      replyFlexPostStocktakeCard(ctx.replyToken, ctx.userName, fullChineseLocation, ctx.session.cellCode, ctx.session.itemName, qty, ctx.session.boxName);
    } else {
      replyTextMessage(ctx.replyToken, `❌ 寫入失敗：資料庫關聯驗證未通過，請檢查人員主檔與品項主檔。`);
    }
  },

  'STATE_CORRECT_ITEM_NAME': function(ctx) {
    const newCorrectName = ctx.userMessage;
    correctLastItemName(ctx.session.lastSkuId, newCorrectName, ctx.session.cellCode);
    ctx.session.lastItemName = newCorrectName;
    ctx.session.itemName = newCorrectName;
    ctx.session.state = 'STATE_POST_STOCKTAKE';
    SessionManager.save(ctx.lineUid, ctx.session, 1800);

    const locTextName = `${ctx.session.siteName || ""} ${ctx.session.floorName || ""} ${ctx.session.spaceName || ""} - ${ctx.session.boxName || ""} (${ctx.session.shelfName || ""})`;
    replyCorrectionSuccessWithMonk(ctx.replyToken, ctx.userName, locTextName, ctx.session.cellCode, newCorrectName, ctx.session.lastQty, ctx.session.boxName, `品項名稱已更新為【${newCorrectName}】！`);
  },

  'STATE_CORRECT_QTY': function(ctx) {
    const newCorrectQty = parseInt(ctx.userMessage, 10);
    if (isNaN(newCorrectQty) || newCorrectQty < 0) {
      replyTextMessage(ctx.replyToken, "❌ 請輸入大於或等於 0 的有效數量數字：");
      return;
    }

    correctLastQty(ctx.session.cellCode, ctx.session.lastSkuId, newCorrectQty);
    ctx.session.lastQty = newCorrectQty;
    ctx.session.state = 'STATE_POST_STOCKTAKE';
    SessionManager.save(ctx.lineUid, ctx.session, 1800);

    const locTextQty = `${ctx.session.siteName || ""} ${ctx.session.floorName || ""} ${ctx.session.spaceName || ""} - ${ctx.session.boxName || ""} (${ctx.session.shelfName || ""})`;
    replyCorrectionSuccessWithMonk(ctx.replyToken, ctx.userName, locTextQty, ctx.session.cellCode, newCorrectQty, ctx.session.boxName, `實清數量已更正為【${newCorrectQty} 本/套】！`);
  },

  'STATE_POST_STOCKTAKE': function(ctx) {
    handleSystemCommand(ctx.replyToken, ctx.lineUid, ctx.session, ctx.userMessage, ctx.userName);
  }
};

// ==================== 7. LINE 訊息路由分流入口 ====================
function handleLineMessage(event) {
  const replyToken = event.replyToken;
  const lineUid = event.source.userId; 
  const userMessage = event.message.text.trim();
  
  const cachedSession = SessionManager.get(lineUid);
  const currentVolunteer = getVolunteerByLineUid(lineUid);
  
  if (!currentVolunteer) {
    if (cachedSession) {
      if (cachedSession.state === 'STATE_BINDING_NAME') {
        cachedSession.state = 'STATE_BINDING_PHONE';
        cachedSession.inputName = userMessage; 
        SessionManager.save(lineUid, cachedSession);
        replyTextMessage(replyToken, `📝 已收到姓名：${userMessage}\n\n第二步：請輸入您在建檔時登記的【手機號碼】末 4 碼（或完整 10 碼）進行身份比對：`);
        return;
      }
      
      if (cachedSession.state === 'STATE_BINDING_PHONE') {
        processDualBinding(replyToken, lineUid, cachedSession.inputName, userMessage);
        return;
      }
    }
    
    SessionManager.save(lineUid, { state: 'STATE_BINDING_NAME' }); 
    replyTextMessage(replyToken, "🙏 您好！歡迎使用「覺風物資管理系統」。\n\n為確保物資紀錄正確，請先進行志工身份認證。\n\n第一步：請輸入您的【人員姓名】：");
    return;
  }

  const myUserId = currentVolunteer['人員編號'];
  const myName = currentVolunteer['人員姓名'];
  const myDept = currentVolunteer['隸屬組織/部門'] || "基本志工";
  const myTitle = currentVolunteer['職稱/身份'] || "志工";

  if (userMessage === '綁定身份') {
    replyTextMessage(replyToken, `💡 溫馨提醒：\n${myName} 您好，您已完成志工身份認證！\n\n編號：[${myUserId}]\n單位：${myDept}\n職稱：${myTitle}\n\n您的權限已開通，請點選「📸 拍照入庫」或「📷 開始盤點」進行作業！🙏`);
    return;
  }

  if (userMessage === '盤點說明' || userMessage === '說明' || userMessage.toLowerCase() === 'help') {
    replyFlexManualCard(replyToken, myName);
    return;
  }

  const isExitCommand = (userMessage === '結束盤點') || 
                        (userMessage === 'CMD_EXIT_STOCKTAKE') || 
                        (typeof CMD_EXIT_STOCKTAKE !== 'undefined' && userMessage === CMD_EXIT_STOCKTAKE);

  if (isExitCommand) {
    SessionManager.clear(lineUid);
    replyExitStocktakeWithImage(replyToken, myName);
    return;
  }

  if (userMessage === '拍照入庫' || (typeof CMD_TRIGGER_PHOTO_INBOUND !== 'undefined' && userMessage === CMD_TRIGGER_PHOTO_INBOUND)) {
    replyFlexInboundPromptCard(replyToken, myName);
    return;
  }

  // 🌟 返回按鈕處理
  if (userMessage.startsWith('↩️ 返回') || (typeof UI !== 'undefined' && UI.BTN_BACK_PREFIX && userMessage.startsWith(UI.BTN_BACK_PREFIX))) {
    if (cachedSession && cachedSession.state !== 'STATE_LAUNCHER') {
      handleGoBack(replyToken, lineUid, cachedSession, myName);
    } else {
      replyFlexStocktakeLauncher(replyToken, myName);
    }
    return;
  }

  if (isSystemControlCommand(userMessage)) {
    if (cachedSession) {
      handleSystemCommand(replyToken, lineUid, cachedSession, userMessage, myName);
    } else {
      replyFlexStocktakeLauncher(replyToken, myName);
    }
    return;
  }

  // 🌟 點擊「開始盤點」時，跳出「極速引導主卡片」
  if (userMessage === '開始盤點' || (typeof CMD !== 'undefined' && CMD.CHANGE_SITE && userMessage === CMD.CHANGE_SITE)) {
    SessionManager.save(lineUid, { state: 'STATE_LAUNCHER' });
    replyFlexStocktakeLauncher(replyToken, myName);
    return;
  }

  // 🌟 點擊「手動選櫃盤點」時，才展開據點清單
  if (userMessage === '手動選櫃盤點' || userMessage === '手動選擇據點與空間') {
    startManualSiteSelection(replyToken, lineUid, myName);
    return;
  }

  // 🌟 手動輸入標籤代碼（支援 B1~B24，層架 S 或抽屜 D，例如 B3-S1、B5-S3）
  const manualTagMatch = userMessage.match(/^B(\d{1,2})[-_/\s]?([SD5])(\d{1,2})$/i);
  if (manualTagMatch) {
    const boxNum = manualTagMatch[1];
    const type = (manualTagMatch[2].toUpperCase() === '5' || manualTagMatch[2].toUpperCase() === 'S') ? 'S' : manualTagMatch[2].toUpperCase();
    const shelfNum = manualTagMatch[3];
    const formattedTag = `B${boxNum}-${type}${shelfNum}`.toUpperCase();

    const targetShelf = findShelfByLabel(formattedTag, cachedSession ? (cachedSession.locId || cachedSession.zoneId) : null);
    if (targetShelf) {
      const activeSession = cachedSession || {};
      const shortTag = targetShelf.cellCode.includes('#') ? targetShelf.cellCode.split('#')[1].trim() : formattedTag;
      const fullLocName = '大安覺風 地下1樓 小教室';
      const displayShelf = `[${shortTag}] ${fullLocName} ｜ ${targetShelf.shelfName}`;

      activeSession.state = 'STATE_INPUT_SKU';
      activeSession.cellCode = targetShelf.cellCode;
      activeSession.shelfName = targetShelf.shelfName;
      activeSession.boxName = targetShelf.boxName;
      activeSession.zoneId = targetShelf.zoneId;
      activeSession.spaceName = fullLocName;
      SessionManager.save(lineUid, activeSession, 3600);

      const webAppBase = getWebAppUrl();
      const webAppStocktakeUrl = `${webAppBase}?mode=stocktake` +
        `&cell=${encodeURIComponent(targetShelf.cellCode)}` +
        `&uid=${encodeURIComponent(myUserId)}` +
        `&name=${encodeURIComponent(myName)}` +
        `&shelf=${encodeURIComponent(displayShelf)}` +
        `&box=${encodeURIComponent(targetShelf.boxName)}` +
        `&space=${encodeURIComponent(fullLocName)}`;

      replyFlexSearchPromptCard(replyToken, fullLocName, targetShelf.boxName, `【${shortTag}】${targetShelf.shelfName}`, targetShelf.cellCode, false, webAppStocktakeUrl);
      return;
    }
  }

  if (!cachedSession) {
    const skus = findSKU(userMessage);
    if (skus.length > 0) {
      replyTextMessage(replyToken, `🔍 找到物資【${skus[0]['物品名稱']}】，但您尚未選定盤點格位。\n\n請先點擊下方選單的「📷 開始盤點」掃描 QR Code 或輸入層架代碼（如 B3-S1）！🙏`);
    } else {
      replyFlexStocktakeLauncher(replyToken, myName);
    }
    return;
  }
  
  const handler = StateHandlers[cachedSession.state];
  if (handler) {
    handler({
      replyToken: replyToken,
      lineUid: lineUid,
      userMessage: userMessage,
      session: cachedSession,
      userId: myUserId,
      userName: myName
    });
  } else {
    writeDebugLog(`未知的 Session 狀態: ${cachedSession.state}`);
    replyFlexStocktakeLauncher(replyToken, myName);
  }
}

// 備用手動階層選單進入點
function startManualSiteSelection(replyToken, lineUid, myName) {
  const sites = getAllSites(); 
  if (sites.length === 0) {
    replyTextMessage(replyToken, `⚠️ 系統後台 LOC_MASTER 尚未設定任何據點，請先聯繫管理員建檔。`);
    return;
  }
  SessionManager.save(lineUid, { state: 'STATE_CHOOSE_SITE' });
  const menuItems = sites.map(site => ({ title: site, desc: "點擊進入此據點", value: site }));
  replyFlexMenuCard(replyToken, "🙏 選擇盤點據點", `${myName} 您好，請點選您所在的【據點】：`, menuItems, null);
}