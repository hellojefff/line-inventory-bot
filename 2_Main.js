/**
 * 模組 2：主程式進入點、Web App RPC 與 LINE 狀態機 (2_Main.js)
 */

// ==================== 1. Webhook 與網頁應用程式進入點 ====================
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) return HtmlService.createHtmlOutput("OK");

  try {
    const postData = JSON.parse(e.postData.contents);
    const events = postData.events;
    
    if (events && events.length > 0) {
      const event = events[0];
      
      // 攔截無效測試 ReplyToken
      if (event.replyToken === "00000000000000000000000000000000" || event.replyToken === "ffffffffffffffffffffffffffffffff") {
        return HtmlService.createHtmlOutput("OK");
      }

      // 攔截 LINE Webhook 重複傳送
      if (event.deliveryContext && event.deliveryContext.isRedelivery === true) {
        return HtmlService.createHtmlOutput("OK");
      }

      // 訊息去重防護 (TTL: 60s)
      if (event.message && event.message.id) {
        const cache = CacheService.getUserCache();
        const msgKey = "PROCESSED_MSG_" + event.message.id;
        if (cache.get(msgKey)) {
          return HtmlService.createHtmlOutput("OK");
        }
        cache.put(msgKey, "1", 60);
      }

      writeDebugLog(e.postData.contents);

      // 僅處理文字訊息指令
      if (event.type === 'message' && event.message && event.message.type === 'text') {
        handleLineMessage(event);
      }
    }
  } catch (error) {
    writeDebugLog("doPost 執行錯誤: " + error.message);
  }
  
  return HtmlService.createHtmlOutput("OK");
}

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  const params = (e && e.parameter) ? e.parameter : {};
  
  template.mode = params.mode || 'inbound';
  template.cell = params.cell || '';
  template.uid = params.uid || '';
  template.userName = params.name || '';
  template.shelf = params.shelf || '';
  template.box = params.box || '';
  template.space = params.space || '';

  const title = template.mode === 'stocktake' ? '覺風格位拍照批次盤點' : '覺風物資前置拍照建檔';

  return template.evaluate()
    .setTitle(title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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

/**
 * 網頁【拍照盤點模式】專用：多物資識別與庫存主檔自動匹配
 */
function analyzeStocktakePhoto(base64Data, mimeType) {
  try {
    if (!CONFIG.GEMINI_API_KEY) {
      throw new Error("未設定 GEMINI_API_KEY");
    }

    // 1. 調用 Gemini Vision 多物件辨識
    const recognizedList = callGeminiMultiItemRecognition(base64Data, mimeType);

    // 2. 對辨識出的每一個品項比對 SKU_MASTER
    const results = recognizedList.map(item => {
      const keyword = item.itemName || "";
      const matched = keyword ? findSKU(keyword) : [];

      const candidates = matched.map(m => ({
        skuId: (m['品項編號'] || m['sku_id'] || '').toString(),
        itemName: (m['物品名稱'] || m['品名'] || '').toString(),
        author: (m['規格或作者'] || m['規格/作者'] || m['作者'] || '').toString(),
        category: (m['大類名稱'] || m['大類'] || '').toString(),
        barcode: (m['條碼編號'] || m['ISBN/條碼'] || '').toString()
      }));

      return {
        rawName: keyword,
        rawAuthor: item.author || "",
        rawBarcode: item.barcode || "",
        candidates: candidates
      };
    });

    return { success: true, items: results };
  } catch (err) {
    writeDebugLog("analyzeStocktakePhoto 錯誤: " + err.message);
    return { success: false, message: err.message, items: [] };
  }
}

/**
 * 調用 Gemini 辨識畫面中的「多件」物資/書籍
 */
function callGeminiMultiItemRecognition(base64Data, mimeType) {
  const candidateModels = [
    "gemini-flash-lite-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash"
  ];

  const prompt = `你是一個專業的圖書與佛寺物資盤點助理。請觀察這張照片，辨識畫面中出現的所有書籍或物品：
1. 找出畫面中所有清楚可見的書籍品名/書名（若有期數，如《覺風期刊 第82期》，請務必完整保留）。
2. 若有標註作者、編著者，請擷取。
3. 若有看見 ISBN 或條碼數字，請擷取。
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      const resCode = response.getResponseCode();
      const resText = response.getContentText();

      if (resCode === 200) {
        const resJson = JSON.parse(resText);
        if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
          const parsed = JSON.parse(resJson.candidates[0].content.parts[0].text);
          return parsed.items || [];
        }
      } else if (resCode === 503 || resCode === 429) {
        Utilities.sleep(300);
      }
    } catch (err) {
      writeDebugLog(`callGeminiMultiItemRecognition [${model}] 例外: ${err.message}`);
    }
  }

  return [];
}

/**
 * 網頁【拍照盤點模式】專用：一鍵批次寫入庫存與記錄
 */
function batchUpdateStock(cellCode, userId, items) {
  try {
    return executeBatchStockWorkflow(userId, cellCode, items);
  } catch (err) {
    writeDebugLog("batchUpdateStock 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * 網頁【零庫存建檔模式】專用：單圖分析
 */
function uploadAndAnalyzeImage(base64Data, mimeType) {
  try {
    if (!CONFIG.INBOUND_IMG_FOLDER_ID) {
      throw new Error("系統未設定 INBOUND_IMG_FOLDER_ID 指令碼屬性");
    }
    
    const decodedBytes = Utilities.base64Decode(base64Data);
    const fileName = "SKU_" + Utilities.formatDate(new Date(), "GMT+8", "yyyyMMdd_HHmmss") + ".jpg";
    const blob = Utilities.newBlob(decodedBytes, mimeType || "image/jpeg", fileName);
    
    const folder = DriveApp.getFolderById(CONFIG.INBOUND_IMG_FOLDER_ID);
    const file = folder.createFile(blob);
    const fileUrl = `https://drive.google.com/uc?id=${file.getId()}`;

    let aiResult = { itemName: "", author: "", barcode: "", category: "出版品與佛藝書籍" };
    try {
      aiResult = callGeminiVisionRecognition(base64Data, mimeType);
    } catch (aiErr) {
      writeDebugLog("Gemini 辨識例外: " + aiErr.message);
    }

    return {
      success: true,
      imageUrl: fileUrl,
      recognizedName: aiResult.itemName || "",
      author: aiResult.author || "",
      barcode: aiResult.barcode || "",
      category: aiResult.category || "出版品與佛藝書籍"
    };
  } catch (err) {
    writeDebugLog("uploadAndAnalyzeImage 錯誤: " + err.message);
    return { success: false, message: err.message };
  }
}

function callGeminiVisionRecognition(base64Data, mimeType) {
  if (!CONFIG.GEMINI_API_KEY) {
    return { itemName: "", author: "", barcode: "", category: "出版品與佛藝書籍" };
  }

  const candidateModels = ["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.8-flash"];
  const prompt = `你是一個專業的圖書與佛寺物資建檔助理。請仔細觀察這張照片：
1. 辨識照片中的【完整書籍書名/物品品名】（例如《大智慧到彼岸》，若有副標題可一併保留）。
2. 辨識書籍的【作者/著者/編譯者】姓名（例如「釋寬謙」、「印順導師」；若非書籍或未標明作者，請填空字串 ""）。
3. 若有看到 ISBN 或商品條碼數字，請擷取出來；若無則填空字串 ""。
4. 推論所屬物資大類（請對應：出版品與佛藝書籍、宗教與儀式物品、專業影音廣播、辦公與生活家電、消耗品與雜項）。
請務必只回傳合法的 JSON 字串，格式嚴格限定為：
{"itemName": "品名或書名", "author": "作者姓名", "barcode": "ISBN或條碼", "category": "大類名稱"}`;

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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    try {
      const response = UrlFetchApp.fetch(endpoint, options);
      if (response.getResponseCode() === 200) {
        const resJson = JSON.parse(response.getContentText());
        if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
          return JSON.parse(resJson.candidates[0].content.parts[0].text);
        }
      }
    } catch (err) {}
  }
  return { itemName: "", author: "", barcode: "", category: "出版品與佛藝書籍" };
}

function recognizeBarcodeOnly(base64Data, mimeType) {
  if (!CONFIG.GEMINI_API_KEY) return { success: false, barcode: "" };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const prompt = `你是一個專業條碼與 ISBN 辨識工具。找出照片中印出的純數字條碼（去除連字號）。回傳標準 JSON：{"barcode": "純數字條碼"}`;

  try {
    const response = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }] }],
        generationConfig: { responseMimeType: "application/json" }
      }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() === 200) {
      const resJson = JSON.parse(response.getContentText());
      if (resJson.candidates && resJson.candidates[0].content && resJson.candidates[0].content.parts[0].text) {
        const parsed = JSON.parse(resJson.candidates[0].content.parts[0].text);
        return { success: true, barcode: (parsed.barcode || "").replace(/[^0-9]/g, "") };
      }
    }
  } catch (err) {}

  return { success: false, barcode: "" };
}

function createSkuMasterItem(data) {
  try {
    const newSku = appendSkuMasterRecord({
      name: data.itemName,
      author: data.author || "",
      category: data.category,
      barcode: data.barcode || "",
      imageUrl: data.imageUrl || ""
    });

    const statusNote = newSku.isExisting ? "（已存在物資，已更新封面）" : "（新建物資）";
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

// ==================== 3. Session 管理工具 ====================
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

// ==================== 4. 狀態處理策略群 (State Handlers) ====================
const StateHandlers = {
  [STATE.CHOOSE_SITE]: function(ctx) {
    const selectedSite = ctx.userMessage;
    const floors = getFloorsBySite(selectedSite);
    if (floors.length === 0) {
      const sites = getAllSites();
      const menuItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
      replyFlexMenuCard(ctx.replyToken, "⚠️ 查無樓層", `找不到「${selectedSite}」底下的樓層配置，請重新選擇據點：`, menuItems, null);
      return;
    }
    ctx.session.state = STATE.CHOOSE_FLOOR;
    ctx.session.siteName = selectedSite;
    SessionManager.save(ctx.lineUid, ctx.session);
    const floorItems = floors.map(f => ({ title: f, desc: `${selectedSite} ${f}`, value: f }));
    replyFlexMenuCard(ctx.replyToken, "🏛️ 選擇所在樓層", `已選擇據點：${selectedSite}\n請點選所在【樓層】：`, floorItems, `↩️ 返回 [選擇據點]`);
  },

  [STATE.CHOOSE_FLOOR]: function(ctx) {
    const selectedFloor = ctx.userMessage;
    const details = getDetailsBySiteAndFloor(ctx.session.siteName, selectedFloor);
    if (details.length === 0) {
      const floorsInSite = getFloorsBySite(ctx.session.siteName || "");
      const floorItems = floorsInSite.map(f => ({ title: f, desc: `${ctx.session.siteName} ${f}`, value: f }));
      replyFlexMenuCard(ctx.replyToken, "⚠️ 查無空間", `找不到「${ctx.session.siteName} ${selectedFloor}」的空間配置，請重新選擇樓層：`, floorItems, `↩️ 返回 [選擇據點]`);
      return;
    }
    ctx.session.state = STATE.CHOOSE_LOC;
    ctx.session.floorName = selectedFloor;
    SessionManager.save(ctx.lineUid, ctx.session);
    const spaceItems = details.map(d => ({ title: d.space_name, desc: `${ctx.session.siteName} ${selectedFloor} - ${d.space_name}`, value: d.loc_id }));
    replyFlexMenuCard(ctx.replyToken, "🏢 選擇具體空間", `已選擇：${ctx.session.siteName} ${selectedFloor}\n請點選具體【空間/展示區】：`, spaceItems, `↩️ 返回 [${ctx.session.siteName} 樓層]`);
  },

  [STATE.CHOOSE_LOC]: function(ctx) {
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
    ctx.session.state = STATE.CHOOSE_ZONE;
    ctx.session.locId = locId;
    ctx.session.spaceName = spaceName;
    SessionManager.save(ctx.lineUid, ctx.session);
    const zoneItems = zones.map(z => ({ title: z.zone_name, desc: `${spaceName} - ${z.zone_name}`, value: z.zone_id }));
    replyFlexMenuCard(ctx.replyToken, "🗄️ 選擇櫃位區域", `已定位空間：【${spaceName}】\n請點選要盤點的【櫃位/區域】：`, zoneItems, `↩️ 返回 [${ctx.session.floorName || "樓層空間"}]`);
  },

  [STATE.CHOOSE_ZONE]: function(ctx) {
    const zoneId = ctx.userMessage.toUpperCase();
    const boxes = parseBoxesFromZone(zoneId); 
    const zoneName = getZoneNameById(zoneId);
    if (boxes.length === 0) {
      const currentZones = getZonesByLocation(ctx.session.locId || "");
      const zoneItems = currentZones.map(z => ({ title: z.zone_name, desc: z.zone_name, value: z.zone_id }));
      replyFlexMenuCard(ctx.replyToken, "❌ 查無櫃子", `找不到「${zoneName}」的空間配置。請重新點選：`, zoneItems, `↩️ 返回 [${ctx.session.spaceName || "空間清單"}]`);
      return;
    }
    ctx.session.state = STATE.CHOOSE_BOX;
    ctx.session.zoneId = zoneId;
    ctx.session.zoneName = zoneName;
    SessionManager.save(ctx.lineUid, ctx.session); 
    const boxItems = boxes.map(b => ({ title: b.display_label, desc: `點擊進入 ${b.display_label}`, value: b.display_label }));
    replyFlexMenuCard(ctx.replyToken, "🗃️ 選擇盤點櫃子", `已鎖定：【${zoneName}】\n請點選要盤點的【櫃子】：`, boxItems, `↩️ 返回 [${ctx.session.spaceName || "空間清單"}]`);
  },

  [STATE.CHOOSE_BOX]: function(ctx) {
    const selectedBoxStr = ctx.userMessage;
    const selectedBoxId = selectedBoxStr.split('-')[0].toUpperCase().trim();
    const shelves = parseShelvesFromBox(ctx.session.zoneId, selectedBoxId); 
    if (shelves.length === 0) {
      const boxes = parseBoxesFromZone(ctx.session.zoneId);
      const boxItems = boxes.map(b => ({ title: b.display_label, desc: b.display_label, value: b.display_label }));
      replyFlexMenuCard(ctx.replyToken, "❌ 查無層格", `找不到該櫃子配置，請重新選擇櫃子：`, boxItems, `↩️ 返回 [${ctx.session.zoneName || "櫃位分區"}]`);
      return;
    }
    ctx.session.state = STATE.CHOOSE_CELL;
    ctx.session.boxId = selectedBoxId;
    ctx.session.boxName = selectedBoxStr;
    SessionManager.save(ctx.lineUid, ctx.session);
    const shelfItems = shelves.map(s => ({ title: `📍 ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
    replyFlexMenuCard(ctx.replyToken, "🚪 選擇盤點層格", `已對齊櫃體：【${selectedBoxStr}】\n請點選具體【層格】：`, shelfItems, `↩️ 返回 [${ctx.session.zoneName || "櫃位分區"}]`);
  },

  [STATE.CHOOSE_CELL]: function(ctx) {
    const cellCode = ctx.userMessage.toUpperCase().trim();
    const validShelves = parseShelvesFromBox(ctx.session.zoneId, ctx.session.boxId);
    const matchedShelf = validShelves.find(s => s.cell_code.toUpperCase().trim() === cellCode);
    if (!matchedShelf) {
      if (validShelves.length > 0) {
        const shelfItems = validShelves.map(s => ({ title: `📍 ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
        replyFlexMenuCard(ctx.replyToken, "⚠️ 請重新點選", `未能識別層格，請點選下方大按鈕：`, shelfItems, `↩️ 返回 [${ctx.session.boxName || "櫃子清單"}]`);
      } else {
        replyTextMessage(ctx.replyToken, `❌ 系統狀態中斷，請重新輸入【開始盤點】。`);
      }
      return;
    }

    ctx.session.state = STATE.INPUT_SKU;
    ctx.session.cellCode = cellCode;
    ctx.session.shelfName = matchedShelf.name;
    SessionManager.save(ctx.lineUid, ctx.session);

    // 🌟 產生帶有當前格位參數的 Web App 盤點 URL
    const webAppStocktakeUrl = `${CONFIG.WEB_APP_URL}?mode=stocktake` +
      `&cell=${encodeURIComponent(cellCode)}` +
      `&uid=${encodeURIComponent(ctx.userId)}` +
      `&name=${encodeURIComponent(ctx.userName)}` +
      `&shelf=${encodeURIComponent(matchedShelf.name)}` +
      `&box=${encodeURIComponent(ctx.session.boxName || '')}` +
      `&space=${encodeURIComponent(ctx.session.spaceName || '')}`;

    replyFlexSearchPromptCard(ctx.replyToken, ctx.session.spaceName, ctx.session.boxName, matchedShelf.name, cellCode, false, webAppStocktakeUrl);
  },

  [STATE.INPUT_SKU]: function(ctx) {
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
    ctx.session.state = STATE.INPUT_QTY;
    ctx.session.skuId = (targetSku['品項編號'] || targetSku['sku_id'] || targetSku['SKU_ID'] || '').toString();
    ctx.session.itemName = (targetSku['物品名稱'] || targetSku['品名'] || targetSku['name'] || '').toString();
    SessionManager.save(ctx.lineUid, ctx.session);

    replyFlexConfirmSingleSkuCard(ctx.replyToken, targetSku, ctx.userName);
  },

  [STATE.INPUT_QTY]: function(ctx) {
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
      ctx.session.state = STATE.POST_STOCKTAKE;
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

  [STATE.CORRECT_ITEM_NAME]: function(ctx) {
    const newCorrectName = ctx.userMessage;
    correctLastItemName(ctx.session.lastSkuId, newCorrectName, ctx.session.cellCode);
    ctx.session.lastItemName = newCorrectName;
    ctx.session.itemName = newCorrectName;
    ctx.session.state = STATE.POST_STOCKTAKE;
    SessionManager.save(ctx.lineUid, ctx.session, 1800);

    const locTextName = `${ctx.session.siteName || ""} ${ctx.session.floorName || ""} ${ctx.session.spaceName || ""} - ${ctx.session.boxName || ""} (${ctx.session.shelfName || ""})`;
    replyCorrectionSuccessWithMonk(ctx.replyToken, ctx.userName, locTextName, ctx.session.cellCode, newCorrectName, ctx.session.lastQty, ctx.session.boxName, `品項名稱已更新為【${newCorrectName}】！`);
  },

  [STATE.CORRECT_QTY]: function(ctx) {
    const newCorrectQty = parseInt(ctx.userMessage, 10);
    if (isNaN(newCorrectQty) || newCorrectQty < 0) {
      replyTextMessage(ctx.replyToken, "❌ 請輸入大於或等於 0 的有效數量數字：");
      return;
    }

    correctLastQty(ctx.session.cellCode, ctx.session.lastSkuId, newCorrectQty);
    ctx.session.lastQty = newCorrectQty;
    ctx.session.state = STATE.POST_STOCKTAKE;
    SessionManager.save(ctx.lineUid, ctx.session, 1800);

    const locTextQty = `${ctx.session.siteName || ""} ${ctx.session.floorName || ""} ${ctx.session.spaceName || ""} - ${ctx.session.boxName || ""} (${ctx.session.shelfName || ""})`;
    replyCorrectionSuccessWithMonk(ctx.replyToken, ctx.userName, locTextQty, ctx.session.cellCode, ctx.session.lastItemName, newCorrectQty, ctx.session.boxName, `實清數量已更正為【${newCorrectQty} 本/套】！`);
  },

  [STATE.POST_STOCKTAKE]: function(ctx) {
    handleSystemCommand(ctx.replyToken, ctx.lineUid, ctx.session, ctx.userMessage, ctx.userName);
  }
};

// ==================== 5. LINE 訊息路由分流入口 ====================
function handleLineMessage(event) {
  const replyToken = event.replyToken;
  const lineUid = event.source.userId; 
  const userMessage = event.message.text.trim();
  
  const cachedSession = SessionManager.get(lineUid);
  const currentVolunteer = getVolunteerByLineUid(lineUid);
  
  // 👥 流程 A：未綁定志工身份驗證流程
  if (!currentVolunteer) {
    if (cachedSession) {
      if (cachedSession.state === STATE.BINDING_NAME) {
        cachedSession.state = STATE.BINDING_PHONE;
        cachedSession.inputName = userMessage; 
        SessionManager.save(lineUid, cachedSession);
        replyTextMessage(replyToken, `📝 已收到姓名：${userMessage}\n\n第二步：請輸入您在建檔時登記的【手機號碼】末 4 碼（或完整 10 碼）進行身份比對：`);
        return;
      }
      
      if (cachedSession.state === STATE.BINDING_PHONE) {
        processDualBinding(replyToken, lineUid, cachedSession.inputName, userMessage);
        return;
      }
    }
    
    SessionManager.save(lineUid, { state: STATE.BINDING_NAME }); 
    replyTextMessage(replyToken, "🙏 您好！歡迎使用「覺風物資管理系統」。\n\n為確保物資紀錄正確，請先進行志工身份認證。\n\n第一步：請輸入您的【人員姓名】：");
    return;
  }

  // 👑 流程 B：已認證人員處理
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

  if (userMessage === CMD.EXIT_STOCKTAKE || userMessage === '結束盤點') {
    SessionManager.clear(lineUid);
    replyExitStocktakeWithImage(replyToken, myName);
    return;
  }

  if (userMessage === '拍照入庫' || userMessage === CMD.TRIGGER_PHOTO_INBOUND) {
    replyFlexInboundPromptCard(replyToken, myName);
    return;
  }

  if (userMessage === '開始盤點' || userMessage === CMD.CHANGE_SITE || !cachedSession) {
    const sites = getAllSites(); 
    if (sites.length === 0) {
      replyTextMessage(replyToken, `⚠️ 系統後台 LOC_MASTER 尚未設定任何據點，請先聯繫管理員建檔。`);
      return;
    }
    SessionManager.save(lineUid, { state: STATE.CHOOSE_SITE });
    const menuItems = sites.map(site => ({ title: site, desc: "點擊進入此據點", value: site }));
    replyFlexMenuCard(replyToken, "🙏 選擇盤點據點", `${myName} 您好，請點選您所在的【據點】：`, menuItems, null);
    return;
  }

  if (userMessage.startsWith(UI.BTN_BACK_PREFIX)) {
    handleGoBack(replyToken, lineUid, cachedSession, myName);
    return;
  }

  if (isSystemControlCommand(userMessage)) {
    handleSystemCommand(replyToken, lineUid, cachedSession, userMessage, myName);
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
  }
}