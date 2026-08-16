/**
 * 模組 2：主程式進入點與狀態機 (2_Main.js)
 */

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
  
  // 👥 狀態 A：尚未綁定者強制進入實名認證流程
  if (!currentVolunteer) {
    if (cachedState) {
      const session = JSON.parse(cachedState);
      
      if (session.state === 'STATE_BINDING_NAME') {
        session.state = 'STATE_BINDING_PHONE';
        session.inputName = userMessage; 
        cache.put(lineUid, JSON.stringify(session), 1200);
        
        replyTextMessage(replyToken, `📝 已收到姓名：${userMessage}\n\n第二步：請輸入您在建檔時登記的【手機號碼】末 4 碼（或完整 10 碼）進行身份比對：`);
        return;
      }
      
      if (session.state === 'STATE_BINDING_PHONE') {
        processDualBinding(replyToken, lineUid, session.inputName, userMessage);
        return;
      }
    }
    
    cache.put(lineUid, JSON.stringify({ state: 'STATE_BINDING_NAME' }), 1200); 
    replyTextMessage(replyToken, "🙏 您好！歡迎使用「覺風物資管理系統」。\n\n為確保物資紀錄正確，請先進行志工身份認證。\n\n第一步：請輸入您的【人員姓名】：");
    return;
  }

  // 👑 狀態 B：已完成身份認證
  const myUserId = currentVolunteer['人員編號'];
  const myName = currentVolunteer['人員姓名'];
  const myDept = currentVolunteer['隸屬組織/部門'] || "基本志工";
  const myTitle = currentVolunteer['職稱/身份'] || "志工";

  // 👤 點擊圖文選單的「身份綁定」
  if (userMessage === '綁定身份') {
    replyTextMessage(replyToken, `💡 溫馨提醒：\n${myName} 您好，您已完成志工身份認證！\n\n編號：[${myUserId}]\n單位：${myDept}\n職稱：${myTitle}\n\n您的盤點權限已開通，不需重複認證。請直接點選下方「📷 開始盤點」即可開始作業囉！🙏`);
    return;
  }

  // 📖 點擊「盤點說明」時發送指南手冊卡片
  if (userMessage === '盤點說明' || userMessage === '說明' || userMessage.toLowerCase() === 'help') {
    replyFlexManualCard(replyToken, myName);
    return;
  }

  // 🚪 結束盤點圖文發送
  if (userMessage === CMD_EXIT_STOCKTAKE || userMessage === '結束盤點') {
    cache.remove(lineUid);
    replyExitStocktakeWithImage(replyToken, myName);
    return;
  }

  // 🚀 關鍵字：開始盤點 或更換據點指令
  if (userMessage === '開始盤點' || userMessage === CMD_CHANGE_SITE || !cachedState) {
    const sites = getAllSites(); 
    if (sites.length === 0) {
      replyTextMessage(replyToken, `⚠️ 系統後台 LOC_MASTER 尚未設定任何據點，請先聯繫管理員建檔。`);
      return;
    }
    cache.put(lineUid, JSON.stringify({ state: 'STATE_CHOOSE_SITE' }), 1200);
    
    const menuItems = sites.map(site => ({ title: site, desc: "點擊進入此據點", value: site }));
    replyFlexMenuCard(replyToken, "🙏 選擇盤點據點", `${myName} 您好，請點選您所在的【據點】：`, menuItems, null);
    return;
  }

  const session = JSON.parse(cachedState);

  // 🌟 全域優先攔截「返回按鈕」
  if (userMessage.startsWith(BTN_BACK_PREFIX)) {
    handleGoBack(replyToken, lineUid, session, myName);
    return;
  }

  // 🌟 全域優先攔截「系統操作與更正指令」
  if (isSystemControlCommand(userMessage)) {
    handleSystemCommand(replyToken, lineUid, session, userMessage, myName);
    return;
  }
  
  switch (session.state) {
    // 🏛️ 狀態 0：選擇據點 ➔ 導向選擇「樓層」
    case 'STATE_CHOOSE_SITE':
      const selectedSite = userMessage;
      const floors = getFloorsBySite(selectedSite);
      
      if (floors.length === 0) {
        const sites = getAllSites();
        const menuItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
        replyFlexMenuCard(replyToken, "⚠️ 查無樓層", `找不到「${selectedSite}」底下的樓層配置，請重新選擇據點：`, menuItems, null);
        return;
      }
      
      session.state = 'STATE_CHOOSE_FLOOR';
      session.siteName = selectedSite;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const floorItems = floors.map(f => ({ title: f, desc: `${selectedSite} ${f}`, value: f }));
      replyFlexMenuCard(replyToken, "🏛️ 選擇所在樓層", `已選擇據點：${selectedSite}\n請點選所在【樓層】：`, floorItems, `↩️ 返回 [選擇據點]`);
      break;

    // 🏢 狀態 0.5：選擇樓層 ➔ 導向選擇「詳細空間」
    case 'STATE_CHOOSE_FLOOR':
      const selectedFloor = userMessage;
      const details = getDetailsBySiteAndFloor(session.siteName, selectedFloor);
      
      if (details.length === 0) {
        const floorsInSite = getFloorsBySite(session.siteName || "");
        const floorItems = floorsInSite.map(f => ({ title: f, desc: `${session.siteName} ${f}`, value: f }));
        replyFlexMenuCard(replyToken, "⚠️ 查無空間", `找不到「${session.siteName} ${selectedFloor}」的空間配置，請重新選擇樓層：`, floorItems, `↩️ 返回 [選擇據點]`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_LOC';
      session.floorName = selectedFloor;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const spaceItems = details.map(d => ({ title: d.space_name, desc: `${session.siteName} ${selectedFloor} - ${d.space_name}`, value: d.loc_id }));
      replyFlexMenuCard(replyToken, "🏢 選擇具體空間", `已選擇：${session.siteName} ${selectedFloor}\n請點選具體【空間/展示區】：`, spaceItems, `↩️ 返回 [${session.siteName} 樓層]`);
      break;

    // 📍 狀態 1：選擇詳細空間 ➔ 導向選擇「櫃位分區」
    case 'STATE_CHOOSE_LOC':
      const locId = userMessage.toUpperCase();
      const zones = getZonesByLocation(locId); 
      
      const currentLocInfo = getLocationInfoById(locId);
      const spaceName = currentLocInfo ? currentLocInfo.space_name : locId;
      
      if (zones.length === 0) {
        const currentDetails = getDetailsBySiteAndFloor(session.siteName || "", session.floorName || "");
        const spaceItems = currentDetails.map(d => ({ title: d.space_name, desc: d.space_name, value: d.loc_id }));
        replyFlexMenuCard(replyToken, "⚠️ 查無櫃位", `找不到「${spaceName}」下的櫃位明細。請重新點選：`, spaceItems, `↩️ 返回 [${session.siteName} 樓層]`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_ZONE';
      session.locId = locId;
      session.spaceName = spaceName;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const zoneItems = zones.map(z => ({ title: z.zone_name, desc: `${spaceName} - ${z.zone_name}`, value: z.zone_id }));
      replyFlexMenuCard(replyToken, "🗄️ 選擇櫃位區域", `已定位空間：【${spaceName}】\n請點選要盤點的【櫃位/區域】：`, zoneItems, `↩️ 返回 [${session.floorName || "樓層空間"}]`);
      break;

    // 🗄️ 狀態 2：選擇櫃位分區 ➔ 導向選擇「櫃子」
    case 'STATE_CHOOSE_ZONE':
      const zoneId = userMessage.toUpperCase();
      const boxes = parseBoxesFromZone(zoneId); 
      const zoneName = getZoneNameById(zoneId);
      
      if (boxes.length === 0) {
        const currentZones = getZonesByLocation(session.locId || "");
        const zoneItems = currentZones.map(z => ({ title: z.zone_name, desc: z.zone_name, value: z.zone_id }));
        replyFlexMenuCard(replyToken, "❌ 查無櫃子", `找不到「${zoneName}」的空間配置。請重新點選：`, zoneItems, `↩️ 返回 [${session.spaceName || "空間清單"}]`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_BOX';
      session.zoneId = zoneId;
      session.zoneName = zoneName;
      cache.put(lineUid, JSON.stringify(session), 1200); 
      
      const boxItems = boxes.map(b => ({ title: b.display_label, desc: `點擊進入 ${b.display_label}`, value: b.display_label }));
      replyFlexMenuCard(replyToken, "🗃️ 選擇盤點櫃子", `已鎖定：【${zoneName}】\n請點選要盤點的【櫃子】：`, boxItems, `↩️ 返回 [${session.spaceName || "空間清單"}]`);
      break;
      
    // 🗃️ 狀態 3：選擇櫃子 ➔ 導向選擇「層格」
    case 'STATE_CHOOSE_BOX':
      const selectedBoxStr = userMessage;
      const selectedBoxId = selectedBoxStr.split('-')[0].toUpperCase().trim();
      const shelves = parseShelvesFromBox(session.zoneId, selectedBoxId); 
      
      if (shelves.length === 0) {
        const boxes = parseBoxesFromZone(session.zoneId);
        const boxItems = boxes.map(b => ({ title: b.display_label, desc: b.display_label, value: b.display_label }));
        replyFlexMenuCard(replyToken, "❌ 查無層格", `找不到該櫃子配置，請重新選擇櫃子：`, boxItems, `↩️ 返回 [${session.zoneName || "櫃位分區"}]`);
        return;
      }
      
      session.state = 'STATE_CHOOSE_CELL';
      session.boxId = selectedBoxId;
      session.boxName = selectedBoxStr;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      const shelfItems = shelves.map(s => ({ title: `📍 ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
      replyFlexMenuCard(replyToken, "🚪 選擇盤點層格", `已對齊櫃體：【${selectedBoxStr}】\n請點選具體【層格】：`, shelfItems, `↩️ 返回 [${session.zoneName || "櫃位分區"}]`);
      break;
      
    // 📍 狀態 4：鎖定層格 ➔ 呈現定位卡片
    case 'STATE_CHOOSE_CELL':
      let cellCode = userMessage.toUpperCase().trim();
      
      const validShelves = parseShelvesFromBox(session.zoneId, session.boxId);
      const matchedShelf = validShelves.find(s => s.cell_code.toUpperCase().trim() === cellCode);
      
      if (!matchedShelf) {
        if (validShelves.length > 0) {
          const shelfItems = validShelves.map(s => ({ title: `📍 ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
          replyFlexMenuCard(replyToken, "⚠️ 請重新點選", `未能識別層格，請點選下方大按鈕：`, shelfItems, `↩️ 返回 [${session.boxName || "櫃子清單"}]`);
        } else {
          replyTextMessage(replyToken, `❌ 系統狀態中斷，請重新輸入【開始盤點】。`);
        }
        return;
      }
      
      session.state = 'STATE_INPUT_SKU';
      session.cellCode = cellCode;
      session.shelfName = matchedShelf.name;
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      replyFlexSearchPromptCard(replyToken, session.spaceName, session.boxName, matchedShelf.name, cellCode, false);
      break;
      
    // 📦 狀態 5：搜尋物資 (SKU)
    case 'STATE_INPUT_SKU':
      const skus = findSKU(userMessage);
      session.pendingItemName = userMessage;
      
      if (skus.length === 0) {
        session.state = 'STATE_CONFIRM_CREATE_SKU';
        cache.put(lineUid, JSON.stringify(session), 1200);

        replyFlexCreateSkuCard(replyToken, userMessage);
        return;
      }
      
      if (skus.length > 1) {
        cache.put(lineUid, JSON.stringify(session), 1200);
        replyFlexSkuVerticalList(replyToken, skus.slice(0, 6));
        return;
      }
      
      const targetSku = skus[0];
      session.state = 'STATE_INPUT_QTY';
      session.skuId = targetSku['品項編號'] ? targetSku['品項編號'].toString() : "未知";
      session.itemName = targetSku['物品名稱'] ? targetSku['物品名稱'].toString() : "未知名稱";
      const cateName = targetSku['大類'] ? targetSku['大類'].toString() : "一般物資"; 
      cache.put(lineUid, JSON.stringify(session), 1200);
      
      replyFlexSkuCard(replyToken, session.itemName, session.skuId, cateName, userMessage);
      break;  

    // ➕ 狀態 5.5：確認建檔選擇分流
    case 'STATE_CONFIRM_CREATE_SKU':
      if (userMessage === CMD_CREATE_SKU_CONFIRM) {
        const newItemName = session.pendingItemName;
        executeCreateSkuAndProceed(replyToken, lineUid, session, newItemName);
        return;
      }

      if (userMessage === CMD_INPUT_DETAILED_SKU) {
        session.state = 'STATE_INPUT_FULL_SKU_NAME';
        cache.put(lineUid, JSON.stringify(session), 1200);
        replyTextMessage(replyToken, `✏️ 請在對話框中直接輸入【完整品項名稱與規格】：\n(例如：金剛經講記-智慧之光)`);
        return;
      }

      if (userMessage === CMD_RETRY_SEARCH_SKU) {
        session.state = 'STATE_INPUT_SKU';
        cache.put(lineUid, JSON.stringify(session), 1200);
        replyFlexSearchPromptCard(replyToken, session.spaceName, session.boxName, session.shelfName, session.cellCode, true);
        return;
      }

      session.state = 'STATE_INPUT_SKU';
      handleLineMessage(event);
      break;

    // 📝 狀態 5.6：收到志工輸入的「完整品項名稱」
    case 'STATE_INPUT_FULL_SKU_NAME':
      executeCreateSkuAndProceed(replyToken, lineUid, session, userMessage);
      break;

    // 🔢 狀態 6：輸入實清數量並獨立更新該格位庫存
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
        session.state = 'STATE_POST_STOCKTAKE';
        session.lastSkuId = session.skuId;
        session.lastItemName = session.itemName;
        session.lastQty = qty;
        cache.put(lineUid, JSON.stringify(session), 1800);

        const fullChineseLocation = `${session.siteName || ""} ${session.floorName || ""} ${session.spaceName || ""} - ${session.boxName || ""} (${session.shelfName || ""})`;
        replyFlexPostStocktakeCard(replyToken, myName, fullChineseLocation, session.cellCode, session.itemName, qty, session.boxName);
      } else {
        replyTextMessage(replyToken, `❌ 寫入失敗：資料庫關聯驗證未通過，請檢查人員主檔與品項主檔。`);
      }
      break;

    // 🌟 狀態 8-A：更正品項名稱
    case 'STATE_CORRECT_ITEM_NAME':
      const newCorrectName = userMessage;
      correctLastItemName(session.lastSkuId, newCorrectName, session.cellCode);
      
      session.lastItemName = newCorrectName;
      session.itemName = newCorrectName;
      session.state = 'STATE_POST_STOCKTAKE';
      cache.put(lineUid, JSON.stringify(session), 1800);

      const locTextName = `${session.siteName || ""} ${session.floorName || ""} ${session.spaceName || ""} - ${session.boxName || ""} (${session.shelfName || ""})`;
      replyCorrectionSuccessWithMonk(replyToken, myName, locTextName, session.cellCode, newCorrectName, session.lastQty, session.boxName, `品項名稱已更新為【${newCorrectName}】！`);
      break;

    // 🌟 狀態 8-B：更正實清數量
    case 'STATE_CORRECT_QTY':
      const newCorrectQty = parseInt(userMessage, 10);
      if (isNaN(newCorrectQty) || newCorrectQty < 0) {
        replyTextMessage(replyToken, "❌ 請輸入大於或等於 0 的有效數量數字：");
        return;
      }

      correctLastQty(session.cellCode, session.lastSkuId, newCorrectQty);
      
      session.lastQty = newCorrectQty;
      session.state = 'STATE_POST_STOCKTAKE';
      cache.put(lineUid, JSON.stringify(session), 1800);

      const locTextQty = `${session.siteName || ""} ${session.floorName || ""} ${session.spaceName || ""} - ${session.boxName || ""} (${session.shelfName || ""})`;
      replyCorrectionSuccessWithMonk(replyToken, myName, locTextQty, session.cellCode, session.lastItemName, newCorrectQty, session.boxName, `實清數量已更正為【${newCorrectQty} 本/套】！`);
      break;

    // 🌟 狀態 7：盤點後連續作業導航控制器
    case 'STATE_POST_STOCKTAKE':
      handleSystemCommand(replyToken, lineUid, session, userMessage, myName);
      break;
  }
}