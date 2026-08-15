/**
 * 覺風物資管理系統 - 全網最防呆點選版 LINE Bot
 * 功能：整合 LOC_MASTER 與 SUB_ZONE_DETAIL，實現「場域 -> 明細 -> 格位」全按鈕引導，志工 0 打字
 */

// ==================== 全局配置 ====================
const SPREADSHEET_ID = '13J32Ewv0PVL8o6hEoJUCuK2Ur5pBEnHO90tdG7XxtC8'; 
const LINE_ACCESS_TOKEN = 'fstqDcGULaFwMfSL2jm1cTFgCo8Qewut0IeKvyHAwfsaL0Qd869L00YFJiHnpU7J1+oNistrv81ZAI4CrV8QeMJl3BXmm13ZEOHDqOoviFCVW17H3ObQdKFAJS54sGGA/4IFoLQUwh41EDRN36bg+wdB04t89/1O/w1cDnyilFU='; 

// ==================== Webhook 進入點 ====================
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

      writeDebugLog(e.postData.contents);

      if (event.type === 'message' && event.message && event.message.type === 'text') {
        handleLineMessage(event);
      }
    }
  } catch (error) {
    writeDebugLog("doPost 執行錯誤: " + error.message);
  }
  
  return HtmlService.createHtmlOutput("OK");
}

// ==================== LINE 狀態機引導邏輯 (雙層 JSON 活化版) ====================
function handleLineMessage(event) {
const replyToken = event.replyToken;
  const lineUid = event.source.userId; 
  const userMessage = event.message.text.trim();
  
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(lineUid); 
  
  // 🔍 核心邏輯：去 USER_MASTER 撈取 LINE_UID 等於當前 lineUid 的人員物件
  let currentVolunteer = getVolunteerByLineUid(lineUid);
  
  // 👥 狀態 A：主動防禦 (當此 LINE 帳號尚未更新寫入 USER_MASTER.LINE_UID 時)
  if (!currentVolunteer) {
    if (cachedState) {
      const session = JSON.parse(cachedState);
      
      // 1. 收到姓名 ➔ 暫存並導向手機密碼關卡
      if (session.state === 'STATE_BINDING_NAME') {
        session.state = 'STATE_BINDING_PHONE';
        session.inputName = userMessage; 
        cache.put(lineUid, JSON.stringify(session), 1200);
        
        replyTextMessage(replyToken, `📝 已收到姓名：${userMessage}\n\n第二步：請輸入您建檔時登記的【手機號碼】進行雙重比對：`);
        return;
      }
      
      // 2. 收到手機 ➔ 送去核心進行雙欄位比對，成功後正式更新 LINE_UID
      if (session.state === 'STATE_BINDING_PHONE') {
        processDualBinding(replyToken, lineUid, session.inputName, userMessage);
        return;
      }
    }
    
    // 3. 既沒綁定、也沒在流程中（例如直接打字），強制進入綁定流程
    cache.put(lineUid, JSON.stringify({ state: 'STATE_BINDING_NAME' }), 1200); 
    replyTextMessage(replyToken, "🔒 您好，偵測到您的 LINE 尚未活化「覺風物資管理系統」身份。\n\n請先進行雙重實名認證。\n\n第一步：請輸入您的【人員姓名】：");
    return;
  }
  // 👑 狀態 B：此 LINE 帳號已成功與後台 LINE_UID 綁定，取出行政建檔的資訊
  const myUserId = currentVolunteer['人員編號'];
  const myName = currentVolunteer['人員姓名'];
  const myDept = currentVolunteer['隸屬組織/部門'] || "基本志工"; // 讀取行政建檔欄位
  const myTitle = currentVolunteer['職稱/身份'] || "志工";        // 讀取行政建檔欄位

  // 🚀 關鍵字：開始盤點 (已綁定者才能暢行無阻)
  if (userMessage === '開始盤點' || !cachedState) {
    const locations = getAllLocations(); 
    if (locations.length === 0) {
      replyTextMessage(replyToken, `⚠️ 系統後台 LOC_MASTER 尚未設定任何場域，請先聯繫管理員建檔。`);
      return;
    }
    cache.put(lineUid, JSON.stringify({ state: 'STATE_CHOOSE_LOC' }), 1200);
    replyQuickReplyLocations(replyToken, myName, locations);
    return;
  }

  // 👤 關鍵字：點擊圖文選單的「身份綁定」
  if (userMessage === '綁定身份') {
    // 🛡️ 最高安全攔截：判斷 USER_MASTER.LINE_UID 已經有值，絕不重複走流程
    replyTextMessage(replyToken, `💡 溫馨提示：\n${myName} 您好，系統確認您已完成實名活化！\n\n編號：[${myUserId}]\n單位：${myDept}\n職稱：${myTitle}\n\n權限已固化，無需重複綁定。請直接點選下方「📷 開始盤點」開始作業！`);
    return;
  }


  // 🚀 啟動命令與重置點：動態加載第一個層級「場域選單」
  if (userMessage === '開始盤點' || !cachedState) {
    const locations = getAllLocations(); 
    if (locations.length === 0) {
      replyTextMessage(replyToken, `⚠️ 系統後台 LOC_MASTER 尚未設定任何場域，請先聯繫管理員建檔。`);
      return;
    }
    cache.put(lineUid, JSON.stringify({ state: 'STATE_CHOOSE_LOC' }), 1200);
    replyQuickReplyLocations(replyToken, myName, locations);
    return;
  }
 // 👤 點擊圖文選單的「身份綁定」啟動點
  if (userMessage === '綁定身份') {
    // 鎖定在第一階段：等待輸入姓名
    cache.put(lineUid, JSON.stringify({ state: 'STATE_BINDING_NAME' }), 1200); 
    replyTextMessage(replyToken, "🔒 您好，開始執行雙重安全綁定。\n\n第一步：請先輸入您的【人員姓名】\n(例如：陳曉鈴)：");
    return;
  }  
  const session = JSON.parse(cachedState);
  
  switch (session.state) {
   
   // 👤 綁定階段一：收到姓名，改詢問手機號碼
    case 'STATE_BINDING_NAME':
      session.state = 'STATE_BINDING_PHONE';
      session.inputName = userMessage; // 暫存姓名到快取
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      replyTextMessage(replyToken, `📝 已收到姓名：${userMessage}\n\n第二步：請輸入您在後台登記的【手機號碼】末 4 碼（或完整 10 碼）進行比對：`);
      break;

    // 📱 綁定階段二：收到手機，執行雙重關聯驗證
    case 'STATE_BINDING_PHONE':
      // 呼叫升級版的雙層驗證函式
      processDualBinding(replyToken, lineUid, session.inputName, userMessage);
      break;
 
    // 🏢 狀態 1：志工點選了「特定場域」（例如：DA-004）
    case 'STATE_CHOOSE_LOC':
      const locId = userMessage.toUpperCase();
      const zones = getZonesByLocation(locId); 
      
      if (zones.length === 0) {
        const locations = getAllLocations();
        replyQuickReplyLocations(replyToken, myName, locations, `⚠️ 找不到場域 "${userMessage}" 下的儲位明細。請重新點選：`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_ZONE';
      session.locId = locId;
      cache.put(lineUid, JSON.stringify(session), 1200);
      replyQuickReplyZones(replyToken, locId, zones);
      break;

    // 🗄️ 狀態 2：志工點選了「儲位明細編碼」（例如：DA-004-Z04）
    // 💡 升級：現在這裡不直接噴出底層 cell_code，而是先噴出「櫃子列表 (box_id)」
    case 'STATE_CHOOSE_ZONE':
      const zoneId = userMessage.toUpperCase();
      const boxes = parseBoxesFromZone(zoneId); // 新增：抓取該區所有的櫃子
      
      if (boxes.length === 0) {
        const currentZones = getZonesByLocation(session.locId || "");
        replyQuickReplyZones(replyToken, session.locId, currentZones, `❌ 找不到明細 "${zoneId}" 的空間配置。請重新點選：`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_BOX'; // 切換至新狀態：選擇櫃子
      session.zoneId = zoneId;
      cache.put(lineUid, JSON.stringify(session), 1200); 
      
      replyQuickReplyBoxes(replyToken, zoneId, boxes); // 噴出櫃子按鈕
      break;
      
    // 🗃️ 新增狀態 3：志工點選了「具體櫃子」（例如點選了 B19）
    case 'STATE_CHOOSE_BOX':
      const selectedBoxId = userMessage.split('-')[0].toUpperCase().trim(); // 從 "B19-第19櫃..." 提取出 "B19"
      const shelves = parseShelvesFromBox(session.zoneId, selectedBoxId); // 抓取該櫃子下的所有層格
      
      if (shelves.length === 0) {
        const boxes = parseBoxesFromZone(session.zoneId);
        replyQuickReplyBoxes(replyToken, session.zoneId, boxes, `❌ 找不到該櫃子配置，請重新選擇櫃子：`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_CELL'; // 前往最終層格定位
      session.boxId = selectedBoxId;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      replyQuickReplyShelves(replyToken, selectedBoxId, shelves); // 噴出層格按鈕
      break;
      
    // 📍 狀態 4：點選最底層微細層格 (例如：DA-004-Z04#B19-S1)
    case 'STATE_CHOOSE_CELL':
      // 如果是用戶直接點選按鈕，格式會是 "B19-S1：第19櫃-上層"，我們透過分隔號切出最前面的真實 cell_code 
      let cellCode = userMessage.toUpperCase().trim();
      if (cellCode.includes('：')) {
        const tempCode = cellCode.split('：')[0].trim(); // 拿到 "B19-S1"
        // 還原完整的 cell_code 格式：DA-004-Z04#B19-S1
        cellCode = `${session.zoneId}#${tempCode}`;
      }
      
      // 驗證安全性
      const validShelves = parseShelvesFromBox(session.zoneId, session.boxId);
      const isCellValid = validShelves.some(s => s.cell_code.toUpperCase().trim() === cellCode);
      
      if (!isCellValid) {
        if (validShelves.length > 0) {
          replyQuickReplyShelves(replyToken, session.boxId, validShelves, `⚠️ 未能識別層格。請重新點選下方快捷按鈕：`);
        } else {
          replyTextMessage(replyToken, `❌ 系統狀態中斷，請重新輸入【開始盤點】。`);
        }
        return;
      }
      
      session.state = 'STATE_INPUT_SKU';
      session.cellCode = cellCode;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      replyTextMessage(replyToken, `📍 已定位格位：\n${cellCode}\n\n請開啟相機「掃描物品條碼」，或直接「輸入物品名稱關鍵字」進行搜尋：`);
      break;
      
    // 📦 狀態 5：輸入並搜尋物資 (SKU)
    case 'STATE_INPUT_SKU':
      const skus = findSKU(userMessage);
      
      if (skus.length === 0) {
        replyTextMessage(replyToken, `🔍 找不到與 "${userMessage}" 相關的物資，請重新輸入關鍵字。`);
        return;
      }
      
      // 💡 升級：找到多筆物資時，改噴出橫向輪播 Flex 卡片，防呆點選
      if (skus.length > 1) {
        replyFlexSkuCarousel(replyToken, skus.slice(0, 10)); // LINE 限制 Carousel 最多 10 張卡片
        return;
      }
      
      const targetSku = skus[0];
      session.state = 'STATE_INPUT_QTY';
      session.skuId = targetSku['品項編號'] ? targetSku['品項編號'].toString() : "未知";
      session.itemName = targetSku['物品名稱'] ? targetSku['物品名稱'].toString() : "未知名稱";
      const cateName = targetSku['大類'] ? targetSku['大類'].toString() : "一般物資"; 
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      replyFlexSkuCard(replyToken, session.itemName, session.skuId, cateName);
      break;  

    // 🔢 狀態 6：確認並輸入清點數量
    case 'STATE_INPUT_QTY':
      if (userMessage === session.skuId) {
        replyTextMessage(replyToken, `請在對話框中直接輸入本次盤點的【實清數量】數字（例如：5）：`);
        return;
      }

      const qty = parseInt(userMessage, 10);
      if (isNaN(qty) || qty < 0) {
        replyTextMessage(replyToken, "❌ 數量格式不正確，請輸入大於或等於 0 的純數字。");
        return;
      }
      
      const success = executeUpdateStockWorkflow(myUserId, session.cellCode, session.skuId, session.itemName, qty);
      
      if (success) {
        cache.remove(lineUid); 
        replyTextMessage(replyToken, `✅ 盤點紀錄更新成功！\n\n經手人員：${myName}\n格位：${session.cellCode}\n物品：${session.itemName}\n實清數量：${qty} 本/套\n\n資料已同步更新。若要繼續盤點，請輸入「開始盤點」。`);
      } else {
        replyTextMessage(replyToken, `❌ 寫入失敗：資料庫關聯驗證未通過，請檢查人員主檔與品項主檔。`);
      }
      break;
  }
}

// ==================== JSON 儲位解析核心工廠 (Skill 1 升級版) ====================

/**
 * 核心升級 A：從 JSON 中提取「櫃子主體」列表 (第一層)
 * 格式對齊：B19-第19櫃(下櫃3-雙開門左)
 */
function parseBoxesFromZone(zoneId) {
  const jsonString = getRawJsonString(zoneId);
  if (!jsonString) return [];
  
  try {
    const boxArray = JSON.parse(jsonString);
    return boxArray.map(box => {
      const bId = box.box_id || "";
      const bName = box.box_name || box.name || ""; // 支援 box_name 與 name 彈性欄位
      return {
        box_id: bId,
        display_label: bId && bName ? `${bId}-${bName}` : (bId || bName)
      };
    });
  } catch(e) { return []; }
}

/**
 * 核心升級 B：根據選定的櫃子，進一步提取旗下的「層格/細項」列表 (第二層)
 * 格式對齊：按鈕顯示「B19-S1：第19櫃-上層」，發送純文字為簡化代碼，由狀態機自動還原
 */
function parseShelvesFromBox(zoneId, boxId) {
  const jsonString = getRawJsonString(zoneId);
  if (!jsonString) return [];
  
  try {
    const boxArray = JSON.parse(jsonString);
    const targetBox = boxArray.find(b => (b.box_id || "").toUpperCase().trim() === boxId.toUpperCase().trim());
    if (!targetBox || !targetBox.shelves) return [];
    
    return targetBox.shelves.map(shelf => {
      const pureCellCode = shelf.cell_code || ""; // 例如: DA-004-Z04#B19-S1
      // 從 cell_code 中切出後綴以便排版 (如 B19-S1)
      const shortCode = pureCellCode.includes('#') ? pureCellCode.split('#')[1] : pureCellCode; 
      
      return {
        cell_code: pureCellCode,
        display_label: `${shortCode}：${shelf.name || ""}` // 格式：B19-S1：第19櫃-上層
      };
    });
  } catch(e) { return []; }
}

/**
 * 內部輔助：讀取 SUB_ZONE_DETAIL 的 JSON 字串原始碼
 */
function getRawJsonString(zoneId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
  if (!sheet) return "";
  const data = sheet.getDataRange().getValues();
  const zoneIdIdx = data[0].indexOf('儲位明細編碼');
  const jsonIdx = data[0].indexOf('實體層格微細配置');
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][zoneIdIdx] === zoneId) { return data[i][jsonIdx]; }
  }
  return "";
}

// ==================== 身份驗證與綁定專用函式 ====================
function getVolunteerByLineUid(lineUid) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("USER_MASTER");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uidIdx = headers.indexOf('LINE_UID');
  if (uidIdx === -1) return null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][uidIdx] && data[i][uidIdx].toString().trim() === lineUid) {
      const userObj = {};
      headers.forEach((header, index) => { userObj[header] = data[i][index]; });
      return userObj;
    }
  }
  return null;
}

/**
 * 核心升級：姓名 ＋ 手機號碼雙重條件模糊/精準比對驗證
 * 支援輸入完整手機或末4碼防呆
 */
function processDualBinding(replyToken, lineUid, inputName, inputPhone) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("USER_MASTER");
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const userIdIdx = headers.indexOf('人員編號');
  const nameIdx = headers.indexOf('人員姓名');
  const phoneIdx = headers.indexOf('手機號碼'); // 💡 讀取新欄位
  const uidIdx = headers.indexOf('LINE_UID');

  if (phoneIdx === -1) {
    replyTextMessage(replyToken, "❌ 系統後台出錯：USER_MASTER 中找不到「手機號碼」欄位，請通知管理員。");
    return;
  }

  const cleanInputName = inputName.replace(/\s+/g, "");
  const cleanInputPhone = inputPhone.replace(/[^0-9]/g, ""); // 只保留純數字比對

  let matchedRows = [];

  // 1. 先在試算表中過濾出所有名字相符的人（解決重複姓名問題）
  for (let i = 1; i < data.length; i++) {
    if (!data[i][nameIdx]) continue;
    const dbName = data[i][nameIdx].toString().replace(/\s+/g, "");
    
    if (dbName === cleanInputName) {
      matchedRows.push({
        rowIndex: i + 1,
        userId: data[i][userIdIdx] ? data[i][userIdIdx].toString() : "未知",
        dbPhone: data[i][phoneIdx] ? data[i][phoneIdx].toString().replace(/[^0-9]/g, "") : "",
        currentUid: data[i][uidIdx] ? data[i][uidIdx].toString().trim() : ""
      });
    }
  }

  // 2. 情況 A：連名字都找不到
  if (matchedRows.length === 0) {
    CacheService.getUserCache().remove(lineUid); // 清除快取，重置狀態
    replyTextMessage(replyToken, `❌ 找不到名為 "${inputName}" 的志工。請重新點擊「身份綁定」重試。`);
    return;
  }

  // 3. 在名字相符的人當中，進一步比對手機號碼（無論是輸入末4碼或完整號碼都能對齊）
  let finalTarget = null;
  for (let match of matchedRows) {
    if (match.dbPhone && (match.dbPhone.endsWith(cleanInputPhone) || cleanInputPhone === match.dbPhone)) {
      finalTarget = match;
      break;
    }
  }

  // 4. 情況 B：名字對了，但手機末4碼對不上
  if (!finalTarget) {
    replyTextMessage(replyToken, `⚠️ 驗證失敗：您輸入的手機號碼與後台登記的資料不符，請重新點選「身份綁定」或聯繫管理員核對資料。`);
    return;
  }

  // 5. 情況 C：手機和名字都對了，但這個坑已經有人蹲了
  if (finalTarget.currentUid !== "" && finalTarget.currentUid !== lineUid) {
    CacheService.getUserCache().remove(lineUid);
    replyTextMessage(replyToken, `⚠️ 綁定失敗：[${inputName}] 搭配此手機的帳號已被其他 LINE 綁定，請聯繫系統管理員。`);
    return;
  }

  // 6. 驗證全數通過，正式寫入 LINE_UID 固化身份
  sheet.getRange(finalTarget.rowIndex, uidIdx + 1).setValue(lineUid);
  CacheService.getUserCache().remove(lineUid); // 功成身退，清除綁定快取
  
  replyTextMessage(replyToken, `🎉 雙重實名綁定成功！\n\n歡迎 ${inputName} (編號: ${finalTarget.userId}) 釋出庫存權限！\n\n請點擊圖文選單的「📷 開始盤點」開始流程。`);
}

// ==================== 核心資料庫讀寫與工具模組 (Skill 1) ====================

/**
 * 修改後：從 LOC_MASTER 讀取並組合「據點＋樓層＋儲位詳細說明」作為按鈕名稱
 */
function getAllLocations() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("LOC_MASTER");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  // 💡 精準定位您的實體欄位索引 (請確保與您 Google Sheets 的標頭中文字完全對齊)
  const idIdx = headers.indexOf("場域編碼");
  const siteIdx = headers.indexOf("據點");               // 例如：大安、北投
  const floorIdx = headers.indexOf("樓層");              // 例如：B1、1樓
  const descIdx = headers.indexOf("儲位詳細說明");       // 例如：小教室、大殿外側
  
  const locations = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx]) {
      const locId = data[i][idIdx].toString().trim();
      
      // 動態組合名稱：據點 + 樓層 + 詳細說明
      const siteName = siteIdx !== -1 && data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
      const floorName = floorIdx !== -1 && data[i][floorIdx] ? data[i][floorIdx].toString().trim() : "";
      const detailDesc = descIdx !== -1 && data[i][descIdx] ? data[i][descIdx].toString().trim() : "";
      
      // 組合出像是：「大安B1小教室」
      let fullName = `${siteName}${floorName}${detailDesc}`;
      
      // 防呆預備：如果上述欄位沒填，就拿「場場編碼」當備用名稱
      if (!fullName) {
        const nameIdx = headers.indexOf("場域名稱");
        fullName = (nameIdx !== -1 && data[i][nameIdx]) ? data[i][nameIdx].toString().trim() : locId;
      }
      
      locations.push({
        loc_id: locId,
        loc_name: fullName
      });
    }
  }
  return locations;
}
/**
 * 修改後：從 SUB_ZONE_DETAIL 讀取「儲位區域描述」作為按鈕顯示名稱 (第二層中文化)
 * 遵循 LINE 限制：Label 限制在 17 字以內
 */
function getZonesByLocation(locId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const zoneIdIdx = headers.indexOf('儲位明細編碼');
  // 💡 精準對齊您實體表格中的欄位名稱
  const zoneNameIdx = headers.indexOf('儲位分區名稱'); // 例如表格裡寫：第1櫃(左一開放架)

  const zones = [];
  for (let i = 1; i < data.length; i++) {
    const zoneId = data[i][zoneIdIdx] ? data[i][zoneIdIdx].toString().trim() : "";
    
    // 檢查明細編碼是否以此場域編碼開頭 (例如 DA-004-Z01 是否以 DA-004 開頭)
    if (zoneId && zoneId.startsWith(locId)) {
      
      // 抓取試算表中的中文描述
      let chineseName = zoneNameIdx !== -1 && data[i][zoneNameIdx] ? data[i][zoneNameIdx].toString().trim() : "";
      
      // 防呆機制：如果志工在後台沒寫「儲位分區名稱」，就拿 zoneId (如 DA-004-Z01) 當備用名稱
      if (!chineseName) {
        chineseName = zoneId;
      }

      zones.push({
        zone_id: zoneId,      // 傳回後台的真實資料 (不變，維持相容性)
        zone_name: chineseName // 顯示在 LINE 按鈕上的親民中文 (如：第1櫃)
      });
    }
  }
  return zones;
}
function findSKU(keyword) {
  if (!keyword) return [];
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SKU_MASTER");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const skuIdIdx = headers.indexOf('品項編號');
  const itemNameIdx = headers.indexOf('物品名稱');
  const barcodeIdx = headers.indexOf('ISBN/條碼'); 

  const results = [];
  const searchStr = keyword.toString().toLowerCase();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if ((row[skuIdIdx] && row[skuIdIdx].toString().toLowerCase().includes(searchStr)) ||
        (row[itemNameIdx] && row[itemNameIdx].toString().toLowerCase().includes(searchStr)) ||
        (row[barcodeIdx] && row[barcodeIdx].toString().toLowerCase() === searchStr)) {
      const skuObj = {};
      headers.forEach((header, index) => { skuObj[header] = row[index]; });
      results.push(skuObj);
    }
  }
  return results;
}

function parseCellCodes(zoneId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const zoneIdIdx = headers.indexOf('儲位明細編碼');
  const jsonIdx = headers.indexOf('實體層格微細配置');
  let jsonString = '';
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][zoneIdIdx] === zoneId) { jsonString = data[i][jsonIdx]; break; }
  }
  if (!jsonString) return [];
  try {
    const boxArray = JSON.parse(jsonString);
    const allCells = [];
    boxArray.forEach(box => {
      if (box.shelves && Array.isArray(box.shelves)) {
        box.shelves.forEach(shelf => {
          allCells.push({ cell_code: shelf.cell_code, name: `${box.box_id || ""}櫃-${shelf.name}` });
        });
      }
    });
    return allCells;
  } catch (e) { return []; }
}

function executeUpdateStockWorkflow(userId, cellCode, skuId, itemName, qty) {
  if (!validateStocktakeRelations(userId, skuId)) {
    return false; 
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  let logSheet = ss.getSheetByName("STOCKTAKE_LOG");
  if (!logSheet) {
    logSheet = ss.insertSheet("STOCKTAKE_LOG");
    logSheet.appendRow(["流水編號", "日期時間", "人員編號", "儲位格位代碼", "品項編號", "物品名稱", "實清數量"]);
  }
  const nextLogId = 'LOG-' + String(logSheet.getLastRow()).padStart(3, '0');
  logSheet.appendRow([nextLogId, new Date(), userId, cellCode, skuId, itemName, qty]);

  let stockSheet = ss.getSheetByName("CURRENT_STOCK");
  if (!stockSheet) {
    stockSheet = ss.insertSheet("CURRENT_STOCK");
    stockSheet.appendRow(["場域編碼", "儲位格位代碼", "品項編號", "物品名稱", "現有庫存量"]);
  }
  
  const stockData = stockSheet.getDataRange().getValues();
  const stockHeaders = stockData[0];
  const cellIdx = stockHeaders.indexOf('儲位格位代碼');
  const skuIdx = stockHeaders.indexOf('品項編號');
  const qtyIdx = stockHeaders.indexOf('現有庫存量');
  let isRecordFound = false;

  for (let i = 1; i < stockData.length; i++) {
    if (stockData[i][cellIdx] === cellCode && stockData[i][skuIdx] === skuId) {
      stockSheet.getRange(i + 1, qtyIdx + 1).setValue(qty);
      isRecordFound = true;
      break;
    }
  }

  if (!isRecordFound) {
    const targetLocId = cellCode.split('-')[0] + '-' + cellCode.split('-')[1];
    const newRow = new Array(stockHeaders.length).fill("");
    
    newRow[stockHeaders.indexOf('場域編碼')] = targetLocId;
    newRow[cellIdx] = cellCode;
    newRow[skuIdx] = skuId;
    newRow[stockHeaders.indexOf('物品名稱')] = itemName;
    newRow[qtyIdx] = qty;
    
    stockSheet.appendRow(newRow);
  }
  return true;
}

function validateStocktakeRelations(userId, skuId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  const userSheet = ss.getSheetByName('USER_MASTER');
  if (!userSheet) return false;
  const userData = userSheet.getDataRange().getValues();
  const userExists = userData.some((row, idx) => idx > 0 && row[0] === userId);
  if (!userExists) return false;
  
  const skuSheet = ss.getSheetByName('SKU_MASTER');
  if (!skuSheet) return false;
  const skuData = skuSheet.getDataRange().getValues();
  const skuExists = skuData.some((row, idx) => idx > 0 && row[0] === skuId);
  if (!skuExists) return false;
  
  return true;
}

function writeDebugLog(contents) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let debugSheet = ss.getSheetByName("DEBUG_LOG");
    if (!debugSheet) debugSheet = ss.insertSheet("DEBUG_LOG");
    debugSheet.appendRow([new Date(), contents]);
  } catch(e) {}
}

// ==================== LINE 訊息發送與 Quick Reply 工具 ====================

function replyTextMessage(replyToken, text) {
  sendToLine({ replyToken: replyToken, messages: [{ type: 'text', text: text }] });
}

/**
 * 新增：噴出場域選擇按鈕 (第一層)
 */
function replyQuickReplyLocations(replyToken, userName, locations, customText) {
  const displayText = customText || `🙏 ${userName} 您好，請點選您目前的【所在場域】：`;
  const items = locations.slice(0, 13).map(loc => {
    return {
      type: "action",
      action: {
        type: "message",
        label: loc.loc_name.length > 17 ? loc.loc_name.substring(0, 14) + "..." : loc.loc_name,
        text: loc.loc_id
      }
    };
  });
  sendToLine({ replyToken: replyToken, messages: [{ type: "text", text: displayText, quickReply: { items: items } }] });
}

/**
 * 新增：噴出區域明細選擇按鈕 (第二層)
 */
function replyQuickReplyZones(replyToken, locId, zones, customText) {
  const displayText = customText || `🏢 已定位場域：${locId}\n請點選您要盤點的【櫃位/區域】：`;
  const items = zones.slice(0, 13).map(zone => {
    return {
      type: "action",
      action: {
        type: "message",
        label: zone.zone_name.length > 17 ? zone.zone_name.substring(0, 14) + "..." : zone.zone_name,
        text: zone.zone_id
      }
    };
  });
  sendToLine({ replyToken: replyToken, messages: [{ type: "text", text: displayText, quickReply: { items: items } }] });
}

/**
 * 噴出微細格位選擇按鈕 (第三層)
 */
function replyQuickReplyCells(replyToken, zoneId, cells, customText) {
  const displayText = customText || `✅ 已鎖定區域：${zoneId}\n請點選下方快捷按鈕選擇【具體格位】：`;
  const items = cells.slice(0, 13).map(cell => {
    const rawLabel = cell.name || "格位";
    const rawText = cell.cell_code || "CODE";
    
    return { 
      type: "action", 
      action: { 
        type: "message", 
        label: rawLabel.length > 17 ? rawLabel.substring(0, 14) + "..." : rawLabel, 
        text: rawText.length > 30 ? rawText.substring(0, 30) : rawText              
      } 
    };
  });
  sendToLine({ replyToken: replyToken, messages: [{ type: "text", text: displayText, quickReply: { items: items } }] });
}

function replyFlexSkuCard(replyToken, itemName, skuId, cateName) {
  const flexContents = {
    "type": "bubble",
    "body": {
      "type": "box", "layout": "vertical",
      "contents": [
        { "type": "text", "text": "📦 已尋獲盤點物資", "weight": "bold", "color": "#1DB446", "size": "sm" },
        { "type": "text", "text": itemName, "weight": "bold", "size": "lg", "margin": "sm", "wrap": true },
        { "type": "text", "text": `品項編號：${skuId}\n物資大類：${cateName}`, "color": "#666666", "size": "sm", "margin": "md", "wrap": true }
      ]
    },
    "footer": {
      "type": "box", "layout": "vertical",
      "contents": [
        {
          "type": "button", "style": "primary", "color": "#1DB446", "height": "sm",
          "action": { "type": "message", "label": "👌 確認是此物品", "text": skuId }
        }
      ]
    }
  };
  sendToLine({ replyToken: replyToken, messages: [{ "type": "flex", "altText": "📦 找到物資資料", "contents": flexContents }] });
}

function sendToLine(payload) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options = {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    payload: JSON.stringify(payload), muteHttpExceptions: true
  };
  UrlFetchApp.fetch(url, options);
}
/**
 * 雙層按鈕 A：噴出櫃子 (box) 選擇按鈕 (Label 17字防禦)
 */
function replyQuickReplyBoxes(replyToken, zoneId, boxes, customText) {
  const displayText = customText || `✅ 已鎖定區域：${zoneId}\n請點選下方快捷按鈕選擇【盤點櫃子】：`;
  const items = boxes.slice(0, 13).map(box => {
    const labelText = box.display_label;
    return { 
      type: "action", 
      action: { 
        type: "message", 
        label: labelText.length > 17 ? labelText.substring(0, 14) + "..." : labelText, 
        text: labelText // 點擊後發送完整格式，例如：B19-第19櫃(下櫃3-雙開門左)
      } 
    };
  });
  sendToLine({ replyToken: replyToken, messages: [{ type: "text", text: displayText, quickReply: { items: items } }] });
}

/**
 * 雙層按鈕 B：噴出層格 (shelf) 選擇按鈕 (Label 17字防禦)
 */
function replyQuickReplyShelves(replyToken, boxId, shelves, customText) {
  const displayText = customText || `🗄️ 已對齊櫃體：${boxId}\n請點選具體【盤點層格】：`;
  const items = shelves.slice(0, 13).map(shelf => {
    const labelText = shelf.display_label; // B19-S1：第19櫃-上層
    return { 
      type: "action", 
      action: { 
        type: "message", 
        label: labelText.length > 17 ? labelText.substring(0, 14) + "..." : labelText, 
        text: labelText 
      } 
    };
  });
  sendToLine({ replyToken: replyToken, messages: [{ type: "text", text: displayText, quickReply: { items: items } }] });
}

/**
 * 修正版：當搜尋到多筆物資時，噴出橫向滑動的 Carousel 卡片選單
 * 修正點：移除 micro 卡片不支援的 height 屬性，確保 100% 繞過 LINE 400 格式錯誤
 */
function replyFlexSkuCarousel(replyToken, skus) {
  // 將每一筆 SKU 資料動態轉化為一個 Flex Bubble 卡片
  const bubbles = skus.map(s => {
    const skuId = s['品項編號'] ? s['品項編號'].toString() : "未知";
    const itemName = s['物品名稱'] ? s['物品名稱'].toString() : "未知名稱";
    const cateName = s['大類'] ? s['大類'].toString() : "一般物資";

    return {
      "type": "bubble",
      "size": "micro", // 保持 micro 大小，橫拉最清爽
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": `📁 ${cateName}`, "weight": "bold", "color": "#888888", "size": "xs" },
          // 🛡️ 安全修正：拿掉 height: "40px"，改用 wrap: true 自然換行，最高顯示 3 行
          { "type": "text", "text": itemName, "weight": "bold", "size": "sm", "margin": "sm", "wrap": true, "maxLines": 3 },
          { "type": "text", "text": `編號: ${skuId}`, "color": "#aaaaaa", "size": "xs", "margin": "md" }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "style": "primary",
            "color": "#1DB446",
            "height": "sm",
            "action": {
              "type": "message",
              "label": "👉 盤點此件",
              "text": skuId // 志工點擊後，自動幫他打出該品項編號
            }
          }
        ]
      }
    };
  });

  const carouselPayload = {
    "type": "carousel",
    "contents": bubbles
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "📦 找到多筆物資資料", // 簡化替代文字
      "contents": carouselPayload
    }]
  });
}