/**
 * 覺風物資管理系統 - 全網最防呆點選版 LINE Bot (長輩大字大按鈕 Flex 全面升級版)
 * 流程：選據點 -> 選樓層 -> 選空間 -> 選櫃位 -> 選櫃子 -> 選層格 -> 搜尋物資 -> 輸入數量
 */

// ==================== 全局配置 ====================
const SPREADSHEET_ID = '13J32Ewv0PVL8o6hEoJUCuK2Ur5pBEnHO90tdG7XxtC8'; 
const LINE_ACCESS_TOKEN = 'fstqDcGULaFwMfSL2jm1cTFgCo8Qewut0IeKvyHAwfsaL0Qd869L00YFJiHnpU7J1+oNistrv81ZAI4CrV8QeMJl3BXmm13ZEOHDqOoviFCVW17H3ObQdKFAJS54sGGA/4IFoLQUwh41EDRN36bg+wdB04t89/1O/w1cDnyilFU='; 
const BTN_BACK_TEXT = '↩️ 回上一層';

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

// ==================== LINE 狀態機引導邏輯 ====================
function handleLineMessage(event) {
  const replyToken = event.replyToken;
  const lineUid = event.source.userId; 
  const userMessage = event.message.text.trim();
  
  const cache = CacheService.getUserCache();
  const cachedState = cache.get(lineUid); 
  
  // 🔍 撈取人員物件
  let currentVolunteer = getVolunteerByLineUid(lineUid);
  
  // 👥 狀態 A：尚未綁定者強制進入實名綁定
  if (!currentVolunteer) {
    if (cachedState) {
      const session = JSON.parse(cachedState);
      
      if (session.state === 'STATE_BINDING_NAME') {
        session.state = 'STATE_BINDING_PHONE';
        session.inputName = userMessage; 
        cache.put(lineUid, JSON.stringify(session), 1200);
        
        replyTextMessage(replyToken, `📝 已收到姓名：${userMessage}\n\n第二步：請輸入您建檔時登記的【手機號碼】末 4 碼（或完整 10 碼）進行雙重比對：`);
        return;
      }
      
      if (session.state === 'STATE_BINDING_PHONE') {
        processDualBinding(replyToken, lineUid, session.inputName, userMessage);
        return;
      }
    }
    
    cache.put(lineUid, JSON.stringify({ state: 'STATE_BINDING_NAME' }), 1200); 
    replyTextMessage(replyToken, "🔒 您好，偵測到您的 LINE 尚未活化「覺風物資管理系統」身份。\n\n請先進行雙重實名認證。\n\n第一步：請輸入您的【人員姓名】：");
    return;
  }

  // 👑 狀態 B：已完成實名綁定
  const myUserId = currentVolunteer['人員編號'];
  const myName = currentVolunteer['人員姓名'];
  const myDept = currentVolunteer['隸屬組織/部門'] || "基本志工";
  const myTitle = currentVolunteer['職稱/身份'] || "志工";

  // 👤 點擊圖文選單的「身份綁定」
  if (userMessage === '綁定身份') {
    replyTextMessage(replyToken, `💡 溫馨提示：\n${myName} 您好，系統確認您已完成實名活化！\n\n編號：[${myUserId}]\n單位：${myDept}\n職稱：${myTitle}\n\n權限已固化，無需重複綁定。請直接點選下方「📷 開始盤點」開始作業！`);
    return;
  }

  // 🚀 關鍵字：開始盤點 ➔ 第一層：選據點 (大按鈕)
  if (userMessage === '開始盤點' || !cachedState) {
    const sites = getAllSites(); 
    if (sites.length === 0) {
      replyTextMessage(replyToken, `⚠️ 系統後台 LOC_MASTER 尚未設定任何據點，請先聯繫管理員建檔。`);
      return;
    }
    cache.put(lineUid, JSON.stringify({ state: 'STATE_CHOOSE_SITE' }), 1200);
    
    const menuItems = sites.map(site => ({ title: site, desc: "點擊進入此據點", value: site }));
    replyFlexMenuCard(replyToken, "🙏 選擇盤點據點", `${myName} 您好，請點選您所在的【據點】：`, menuItems, false);
    return;
  }

  const session = JSON.parse(cachedState);

  // ↩️ 統一攔截「回上一層」指令
  if (userMessage === BTN_BACK_TEXT) {
    handleGoBack(replyToken, lineUid, session, myName);
    return;
  }
  
  switch (session.state) {
    // 🏛️ 狀態 0：志工點選「據點」 ➔ 導向選擇「樓層」
    case 'STATE_CHOOSE_SITE':
      const selectedSite = userMessage;
      const floors = getFloorsBySite(selectedSite);
      
      if (floors.length === 0) {
        const sites = getAllSites();
        const menuItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
        replyFlexMenuCard(replyToken, "⚠️ 查無樓層", `找不到「${selectedSite}」底下的樓層配置，請重新選擇據點：`, menuItems, false);
        return;
      }
      
      session.state = 'STATE_CHOOSE_FLOOR';
      session.siteName = selectedSite;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const floorItems = floors.map(f => ({ title: f, desc: `${selectedSite} ${f}`, value: f }));
      replyFlexMenuCard(replyToken, "🏛️ 選擇所在樓層", `已選擇據點：${selectedSite}\n請點選所在【樓層】：`, floorItems, true);
      break;

    // 🏢 狀態 0.5：志工點選「樓層」 ➔ 導向選擇「詳細空間」
    case 'STATE_CHOOSE_FLOOR':
      const selectedFloor = userMessage;
      const details = getDetailsBySiteAndFloor(session.siteName, selectedFloor);
      
      if (details.length === 0) {
        const floorsInSite = getFloorsBySite(session.siteName || "");
        const floorItems = floorsInSite.map(f => ({ title: f, desc: `${session.siteName} ${f}`, value: f }));
        replyFlexMenuCard(replyToken, "⚠️ 查無空間", `找不到「${session.siteName} ${selectedFloor}」的空間配置，請重新選擇樓層：`, floorItems, true);
        return;
      }
      
      session.state = 'STATE_CHOOSE_LOC';
      session.floorName = selectedFloor;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const spaceItems = details.map(d => ({ title: d.space_name, desc: `場域代碼：${d.loc_id}`, value: d.loc_id }));
      replyFlexMenuCard(replyToken, "🏢 選擇具體空間", `已選擇：${session.siteName} ${selectedFloor}\n請點選具體【空間/展示區】：`, spaceItems, true);
      break;

    // 📍 狀態 1：志工點選「詳細空間」 ➔ 導向選擇「櫃位」
    case 'STATE_CHOOSE_LOC':
      const locId = userMessage.toUpperCase();
      const zones = getZonesByLocation(locId); 
      
      if (zones.length === 0) {
        const currentDetails = getDetailsBySiteAndFloor(session.siteName || "", session.floorName || "");
        const spaceItems = currentDetails.map(d => ({ title: d.space_name, desc: `場域代碼：${d.loc_id}`, value: d.loc_id }));
        replyFlexMenuCard(replyToken, "⚠️ 查無櫃位", `找不到場域 "${userMessage}" 下的櫃位明細。請重新點選：`, spaceItems, true);
        return;
      }
      
      session.state = 'STATE_CHOOSE_ZONE';
      session.locId = locId;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const zoneItems = zones.map(z => ({ title: z.zone_name, desc: `編碼：${z.zone_id}`, value: z.zone_id }));
      replyFlexMenuCard(replyToken, "🗄️ 選擇櫃位區域", `已定位場域：${locId}\n請點選要盤點的【櫃位/區域】：`, zoneItems, true);
      break;

    // 🗄️ 狀態 2：志工點選「儲位分區」 ➔ 導向選擇「櫃子」
    case 'STATE_CHOOSE_ZONE':
      const zoneId = userMessage.toUpperCase();
      const boxes = parseBoxesFromZone(zoneId);
      
      if (boxes.length === 0) {
        const currentZones = getZonesByLocation(session.locId || "");
        const zoneItems = currentZones.map(z => ({ title: z.zone_name, desc: `編碼：${z.zone_id}`, value: z.zone_id }));
        replyFlexMenuCard(replyToken, "❌ 查無櫃子", `找不到明細 "${zoneId}" 的空間配置。請重新點選：`, zoneItems, true);
        return;
      }
      
      session.state = 'STATE_CHOOSE_BOX';
      session.zoneId = zoneId;
      cache.put(lineUid, JSON.stringify(session), 1200); 
      
      const boxItems = boxes.map(b => ({ title: b.display_label, desc: `櫃位編號：${b.box_id}`, value: b.display_label }));
      replyFlexMenuCard(replyToken, "🗃️ 選擇盤點櫃子", `已鎖定區域：${zoneId}\n請點選要盤點的【櫃子】：`, boxItems, true);
      break;
      
    // 🗃️ 狀態 3：志工點選「櫃子」 ➔ 導向選擇「層格」
    case 'STATE_CHOOSE_BOX':
      const selectedBoxId = userMessage.split('-')[0].toUpperCase().trim();
      const shelves = parseShelvesFromBox(session.zoneId, selectedBoxId);
      
      if (shelves.length === 0) {
        const boxes = parseBoxesFromZone(session.zoneId);
        const boxItems = boxes.map(b => ({ title: b.display_label, desc: `櫃位編號：${b.box_id}`, value: b.display_label }));
        replyFlexMenuCard(replyToken, "❌ 查無層格", `找不到該櫃子配置，請重新選擇櫃子：`, boxItems, true);
        return;
      }
      
      session.state = 'STATE_CHOOSE_CELL';
      session.boxId = selectedBoxId;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const shelfItems = shelves.map(s => ({ title: `📍 格位：${s.short_code}`, desc: s.name, value: s.cell_code }));
      replyFlexMenuCard(replyToken, "🚪 選擇盤點層格", `已對齊櫃體：${selectedBoxId}\n請點選具體【層格】：`, shelfItems, true);
      break;
      
    // 📍 狀態 4：點選微細層格 ➔ 導向搜尋物資
    case 'STATE_CHOOSE_CELL':
      let cellCode = userMessage.toUpperCase().trim();
      
      const validShelves = parseShelvesFromBox(session.zoneId, session.boxId);
      const isCellValid = validShelves.some(s => s.cell_code.toUpperCase().trim() === cellCode);
      
      if (!isCellValid) {
        if (validShelves.length > 0) {
          const shelfItems = validShelves.map(s => ({ title: `📍 格位：${s.short_code}`, desc: s.name, value: s.cell_code }));
          replyFlexMenuCard(replyToken, "⚠️ 請重新點選", `未能識別層格，請點選下方大按鈕：`, shelfItems, true);
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
      
    // 📦 狀態 5：搜尋物資 (SKU)
    case 'STATE_INPUT_SKU':
      const skus = findSKU(userMessage);
      
      if (skus.length === 0) {
        replyTextMessage(replyToken, `🔍 找不到與 "${userMessage}" 相關的物資，請重新輸入關鍵字。`);
        return;
      }
      
      if (skus.length > 1) {
        replyFlexSkuCarousel(replyToken, skus.slice(0, 10));
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

    // 🔢 狀態 6：輸入數量
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

// ==================== 「回上一層」狀態倒退控制器 ====================

function handleGoBack(replyToken, lineUid, session, userName) {
  const cache = CacheService.getUserCache();

  switch (session.state) {
    case 'STATE_CHOOSE_FLOOR':
      const sites = getAllSites();
      session.state = 'STATE_CHOOSE_SITE';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const siteItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
      replyFlexMenuCard(replyToken, "↩️ 已返回據點選單", "請重新選擇【據點】：", siteItems, false);
      break;

    case 'STATE_CHOOSE_LOC':
      const floors = getFloorsBySite(session.siteName || "");
      session.state = 'STATE_CHOOSE_FLOOR';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const floorItems = floors.map(f => ({ title: f, desc: `${session.siteName} ${f}`, value: f }));
      replyFlexMenuCard(replyToken, "↩️ 已返回樓層選單", `請重新選擇【${session.siteName}】的樓層：`, floorItems, true);
      break;

    case 'STATE_CHOOSE_ZONE':
      const details = getDetailsBySiteAndFloor(session.siteName || "", session.floorName || "");
      session.state = 'STATE_CHOOSE_LOC';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const spaceItems = details.map(d => ({ title: d.space_name, desc: `場域代碼：${d.loc_id}`, value: d.loc_id }));
      replyFlexMenuCard(replyToken, "↩️ 已返回空間選單", "請重新選擇【空間/展示區】：", spaceItems, true);
      break;

    case 'STATE_CHOOSE_BOX':
      const zones = getZonesByLocation(session.locId || "");
      session.state = 'STATE_CHOOSE_ZONE';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const zoneItems = zones.map(z => ({ title: z.zone_name, desc: `編碼：${z.zone_id}`, value: z.zone_id }));
      replyFlexMenuCard(replyToken, "↩️ 已返回櫃位選單", "請重新選擇【櫃位/區域】：", zoneItems, true);
      break;

    case 'STATE_CHOOSE_CELL':
      const boxes = parseBoxesFromZone(session.zoneId || "");
      session.state = 'STATE_CHOOSE_BOX';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const boxItems = boxes.map(b => ({ title: b.display_label, desc: `櫃位編號：${b.box_id}`, value: b.display_label }));
      replyFlexMenuCard(replyToken, "↩️ 已返回櫃子選單", "請重新選擇【盤點櫃子】：", boxItems, true);
      break;

    default:
      const defaultSites = getAllSites();
      session.state = 'STATE_CHOOSE_SITE';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const defaultItems = defaultSites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
      replyFlexMenuCard(replyToken, "🙏 選擇盤點據點", "請選擇您所在的【據點】：", defaultItems, false);
      break;
  }
}

// ==================== 資料庫讀取與層級解析核心 ====================

function getAllSites() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("LOC_MASTER");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const siteIdx = headers.indexOf("據點");
  
  if (siteIdx === -1) return [];
  
  const siteSet = new Set();
  for (let i = 1; i < data.length; i++) {
    const site = data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
    if (site) siteSet.add(site);
  }
  return Array.from(siteSet);
}

function getFloorsBySite(siteName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("LOC_MASTER");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const siteIdx = headers.indexOf("據點");
  const floorIdx = headers.indexOf("樓層");
  
  if (siteIdx === -1 || floorIdx === -1) return [];
  
  const floorSet = new Set();
  for (let i = 1; i < data.length; i++) {
    const currentSite = data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
    const floor = data[i][floorIdx] ? data[i][floorIdx].toString().trim() : "";
    
    if (currentSite === siteName && floor) {
      floorSet.add(floor);
    }
  }
  return Array.from(floorSet);
}

function getDetailsBySiteAndFloor(siteName, floorName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("LOC_MASTER");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const idIdx = headers.indexOf("場域編碼");
  const siteIdx = headers.indexOf("據點");
  const floorIdx = headers.indexOf("樓層");
  const descIdx = headers.indexOf("儲位詳細說明");
  
  const details = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx]) {
      const locId = data[i][idIdx].toString().trim();
      const currentSite = siteIdx !== -1 && data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
      const currentFloor = floorIdx !== -1 && data[i][floorIdx] ? data[i][floorIdx].toString().trim() : "";
      
      if (currentSite === siteName && currentFloor === floorName) {
        let spaceName = descIdx !== -1 && data[i][descIdx] ? data[i][descIdx].toString().trim() : "";
        if (!spaceName) {
          const nameIdx = headers.indexOf("場域名稱");
          spaceName = (nameIdx !== -1 && data[i][nameIdx]) ? data[i][nameIdx].toString().trim() : locId;
        }
        
        details.push({
          loc_id: locId,
          space_name: spaceName
        });
      }
    }
  }
  return details;
}

function getZonesByLocation(locId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const zoneIdIdx = headers.indexOf('儲位明細編碼');
  const zoneNameIdx = headers.indexOf('儲位分區名稱');

  const zones = [];
  for (let i = 1; i < data.length; i++) {
    const zoneId = data[i][zoneIdIdx] ? data[i][zoneIdIdx].toString().trim() : "";
    
    if (zoneId && zoneId.startsWith(locId)) {
      let chineseName = zoneNameIdx !== -1 && data[i][zoneNameIdx] ? data[i][zoneNameIdx].toString().trim() : "";
      if (!chineseName) chineseName = zoneId;

      zones.push({
        zone_id: zoneId,
        zone_name: chineseName
      });
    }
  }
  return zones;
}

function parseBoxesFromZone(zoneId) {
  const jsonString = getRawJsonString(zoneId);
  if (!jsonString) return [];
  
  try {
    const boxArray = JSON.parse(jsonString);
    return boxArray.map(box => {
      const bId = box.box_id || "";
      const bName = box.box_name || box.name || "";
      return {
        box_id: bId,
        display_label: bId && bName ? `${bId}-${bName}` : (bId || bName)
      };
    });
  } catch(e) { return []; }
}

function parseShelvesFromBox(zoneId, boxId) {
  const jsonString = getRawJsonString(zoneId);
  if (!jsonString) return [];
  
  try {
    const boxArray = JSON.parse(jsonString);
    const targetBox = boxArray.find(b => (b.box_id || "").toUpperCase().trim() === boxId.toUpperCase().trim());
    if (!targetBox || !targetBox.shelves) return [];
    
    return targetBox.shelves.map(shelf => {
      const pureCellCode = shelf.cell_code || "";
      const shortCode = pureCellCode.includes('#') ? pureCellCode.split('#')[1] : pureCellCode; 
      
      return {
        cell_code: pureCellCode,
        short_code: shortCode,
        name: shelf.name || "層格"
      };
    });
  } catch(e) { return []; }
}

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

// ==================== 身份驗證與雙重實名綁定 ====================
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

function processDualBinding(replyToken, lineUid, inputName, inputPhone) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("USER_MASTER");
  if (!sheet) return;
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const userIdIdx = headers.indexOf('人員編號');
  const nameIdx = headers.indexOf('人員姓名');
  const phoneIdx = headers.indexOf('手機號碼');
  const uidIdx = headers.indexOf('LINE_UID');

  if (phoneIdx === -1) {
    replyTextMessage(replyToken, "❌ 系統後台出錯：USER_MASTER 中找不到「手機號碼」欄位，請通知管理員。");
    return;
  }

  const cleanInputName = inputName.replace(/\s+/g, "");
  const cleanInputPhone = inputPhone.replace(/[^0-9]/g, "");

  let matchedRows = [];

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

  if (matchedRows.length === 0) {
    CacheService.getUserCache().remove(lineUid);
    replyTextMessage(replyToken, `❌ 找不到名為 "${inputName}" 的志工。請重新點擊「身份綁定」重試。`);
    return;
  }

  let finalTarget = null;
  for (let match of matchedRows) {
    if (match.dbPhone && (match.dbPhone.endsWith(cleanInputPhone) || cleanInputPhone === match.dbPhone)) {
      finalTarget = match;
      break;
    }
  }

  if (!finalTarget) {
    replyTextMessage(replyToken, `⚠️ 驗證失敗：您輸入的手機號碼與後台登記的資料不符，請重新點選「身份綁定」或聯繫管理員核對資料。`);
    return;
  }

  if (finalTarget.currentUid !== "" && finalTarget.currentUid !== lineUid) {
    CacheService.getUserCache().remove(lineUid);
    replyTextMessage(replyToken, `⚠️ 綁定失敗：[${inputName}] 搭配此手機的帳號已被其他 LINE 綁定，請聯繫系統管理員。`);
    return;
  }

  sheet.getRange(finalTarget.rowIndex, uidIdx + 1).setValue(lineUid);
  CacheService.getUserCache().remove(lineUid);
  
  replyTextMessage(replyToken, `🎉 雙重實名綁定成功！\n\n歡迎 ${inputName} (編號: ${finalTarget.userId}) 釋出庫存權限！\n\n請點擊圖文選單的「📷 開始盤點」開始流程。`);
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

// ==================== LINE 訊息與長輩友善大字卡片模組 ====================

function replyTextMessage(replyToken, text) {
  sendToLine({ replyToken: replyToken, messages: [{ type: 'text', text: text }] });
}

/**
 * 🌟 核心升級：長輩大字大按鈕 Flex 選單生成器
 * @param {string} replyToken - LINE 回覆 Token
 * @param {string} title - 卡片主標題 (大字)
 * @param {string} subtitle - 副標題/說明文字
 * @param {Array<{title: string, desc: string, value: string}>} items - 按鈕清單
 * @param {boolean} showBackBtn - 是否顯示大尺寸「回上一層」按鈕
 */
function replyFlexMenuCard(replyToken, title, subtitle, items, showBackBtn = true) {
  // 動態建立大字大點擊區的按鈕列
  const buttonRows = items.map(item => ({
    "type": "box",
    "layout": "vertical",
    "backgroundColor": "#F0FDF4",      // 淺綠背景，視覺柔和清晰
    "borderColor": "#16A34A",          // 鮮明綠色邊框
    "borderWidth": "1px",
    "cornerRadius": "lg",              // 圓角大按鈕
    "paddingAll": "lg",                // 大內距，增加點擊觸發面積
    "margin": "md",
    "action": {
      "type": "message",
      "label": item.title.length > 20 ? item.title.substring(0, 17) + "..." : item.title,
      "text": item.value               // 點選送出的真實值
    },
    "contents": [
      {
        "type": "text",
        "text": item.title,
        "weight": "bold",
        "size": "lg",                  // 🌟 超大字體 (19px)
        "color": "#15803D",
        "wrap": true
      },
      {
        "type": "text",
        "text": item.desc || "點擊選取",
        "size": "sm",                  // 次要說明文字 (14px)
        "color": "#4B5563",
        "wrap": true,
        "margin": "xs"
      }
    ]
  }));

  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FAFAFA",
      "contents": [
        { "type": "text", "text": title, "weight": "bold", "size": "xl", "color": "#111827", "wrap": true },
        { "type": "text", "text": subtitle, "size": "md", "color": "#4B5563", "margin": "sm", "wrap": true }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": buttonRows
    }
  };

  // 加上長輩大字「回上一層」按鈕
  if (showBackBtn) {
    flexContents.footer = {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "style": "secondary",
          "height": "md",             // 增加按鈕高度
          "action": {
            "type": "message",
            "label": BTN_BACK_TEXT,
            "text": BTN_BACK_TEXT
          }
        }
      ]
    };
  }

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": title,
      "contents": flexContents
    }]
  });
}

function replyFlexSkuCard(replyToken, itemName, skuId, cateName) {
  const flexContents = {
    "type": "bubble",
    "body": {
      "type": "box", "layout": "vertical",
      "contents": [
        { "type": "text", "text": "📦 已尋獲盤點物資", "weight": "bold", "color": "#16A34A", "size": "md" },
        { "type": "text", "text": itemName, "weight": "bold", "size": "xl", "margin": "sm", "wrap": true },
        { "type": "text", "text": `品項編號：${skuId}\n物資大類：${cateName}`, "color": "#4B5563", "size": "md", "margin": "md", "wrap": true }
      ]
    },
    "footer": {
      "type": "box", "layout": "vertical",
      "contents": [
        {
          "type": "button", "style": "primary", "color": "#16A34A", "height": "md",
          "action": { "type": "message", "label": "👌 確認是此物品", "text": skuId }
        }
      ]
    }
  };
  sendToLine({ replyToken: replyToken, messages: [{ "type": "flex", "altText": "📦 找到物資資料", "contents": flexContents }] });
}

function replyFlexSkuCarousel(replyToken, skus) {
  const bubbles = skus.map(s => {
    const skuId = s['品項編號'] ? s['品項編號'].toString() : "未知";
    const itemName = s['物品名稱'] ? s['物品名稱'].toString() : "未知名稱";
    const cateName = s['大類'] ? s['大類'].toString() : "一般物資";

    return {
      "type": "bubble",
      "size": "kilo",                 // 放大卡片尺寸
      "body": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          { "type": "text", "text": `📁 ${cateName}`, "weight": "bold", "color": "#6B7280", "size": "sm" },
          { "type": "text", "text": itemName, "weight": "bold", "size": "md", "margin": "sm", "wrap": true, "maxLines": 3 },
          { "type": "text", "text": `編號: ${skuId}`, "color": "#9CA3AF", "size": "sm", "margin": "md" }
        ]
      },
      "footer": {
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "style": "primary",
            "color": "#16A34A",
            "height": "md",
            "action": {
              "type": "message",
              "label": "👉 盤點此件",
              "text": skuId
            }
          }
        ]
      }
    };
  });

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "📦 找到多筆物資資料",
      "contents": { "type": "carousel", "contents": bubbles }
    }]
  });
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