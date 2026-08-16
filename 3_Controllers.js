/**
 * 模組 3：控制與導航分流控制器 (3_Controllers.js)
 */

function isSystemControlCommand(msg) {
  const commands = [
    CMD_NEXT_SKU_SAME_CELL,
    CMD_CHANGE_SHELF_SAME_BOX,
    CMD_CHANGE_BOX_SAME_ROOM,
    CMD_CHANGE_SITE,
    CMD_CREATE_SKU_CONFIRM,
    CMD_INPUT_DETAILED_SKU,
    CMD_RETRY_SEARCH_SKU,
    CMD_EXIT_STOCKTAKE,
    CMD_START_CORRECTION,
    CMD_CORRECT_NAME,
    CMD_CORRECT_QTY,
    CMD_DELETE_LAST_LOG
  ];
  return commands.includes(msg);
}

function handleSystemCommand(replyToken, lineUid, session, userMessage, userName) {
  const cache = CacheService.getUserCache();

  // 1. 同格位盤下一件
  if (userMessage === CMD_NEXT_SKU_SAME_CELL) {
    session.state = 'STATE_INPUT_SKU';
    cache.put(lineUid, JSON.stringify(session), 1800);
    replyFlexSearchPromptCard(replyToken, session.spaceName, session.boxName, session.shelfName, session.cellCode, false);
    return;
  }

  // 2. 同櫃換其他層格
  if (userMessage === CMD_CHANGE_SHELF_SAME_BOX) {
    const shelves = parseShelvesFromBox(session.zoneId || "", session.boxId || "");
    if (shelves.length === 0) {
      replyTextMessage(replyToken, "⚠️ 查無該櫃子的層格明細，請重新選擇櫃位。");
      return;
    }
    session.state = 'STATE_CHOOSE_CELL';
    cache.put(lineUid, JSON.stringify(session), 1800);
    
    const shelfItems = shelves.map(s => ({ title: `📍 ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
    replyFlexMenuCard(replyToken, "🚪 選擇盤點層格", `已鎖定櫃體：【${session.boxName || "目前櫃子"}】\n請點選您要盤點的【分層】：`, shelfItems, `↩️ 返回 [${session.zoneName || "櫃位分區"}]`);
    return;
  }

  // 3. 同空間換其他櫃位
  if (userMessage === CMD_CHANGE_BOX_SAME_ROOM) {
    const zones = getZonesByLocation(session.locId || "");
    if (zones.length === 0) {
      replyTextMessage(replyToken, "⚠️ 查無該空間的其他櫃位，請重新選擇據點。");
      return;
    }
    session.state = 'STATE_CHOOSE_ZONE';
    cache.put(lineUid, JSON.stringify(session), 1800);
    const zoneItems = zones.map(z => ({ title: z.zone_name, desc: z.zone_name, value: z.zone_id }));
    replyFlexMenuCard(replyToken, "🗄️ 選擇同空間其他櫃位", `目前所在空間：【${session.spaceName || "小教室"}】\n請點選要盤點的【櫃位/區域】：`, zoneItems, `↩️ 返回 [${session.floorName || "空間清單"}]`);
    return;
  }

  // 4. 更換其他據點/空間
  if (userMessage === CMD_CHANGE_SITE) {
    const sites = getAllSites();
    session.state = 'STATE_CHOOSE_SITE';
    cache.put(lineUid, JSON.stringify(session), 1800);
    const siteItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
    replyFlexMenuCard(replyToken, "🙏 選擇新盤點據點", `${userName} 您好，請點選您要前往的【據點】：`, siteItems, null);
    return;
  }

  // 5. 建檔確認指令
  if (userMessage === CMD_CREATE_SKU_CONFIRM) {
    const newItemName = session.pendingItemName || "新品項";
    executeCreateSkuAndProceed(replyToken, lineUid, session, newItemName);
    return;
  }

  // 6. 自訂輸入完整品名指令
  if (userMessage === CMD_INPUT_DETAILED_SKU) {
    session.state = 'STATE_INPUT_FULL_SKU_NAME';
    cache.put(lineUid, JSON.stringify(session), 1200);
    replyTextMessage(replyToken, `✏️ 請在對話框中直接輸入【完整品項名稱與規格】：\n(例如：金剛經講記-智慧之光)`);
    return;
  }

  // 7. 重新搜尋關鍵字指令
  if (userMessage === CMD_RETRY_SEARCH_SKU) {
    session.state = 'STATE_INPUT_SKU';
    cache.put(lineUid, JSON.stringify(session), 1200);
    replyFlexSearchPromptCard(replyToken, session.spaceName, session.boxName, session.shelfName, session.cellCode, true);
    return;
  }

  // 8. 啟動即時補救與更正流程
  if (userMessage === CMD_START_CORRECTION) {
    replyFlexCorrectionMenu(replyToken, session.lastItemName, session.lastQty);
    return;
  }

  // 8-A. 選擇修改品名
  if (userMessage === CMD_CORRECT_NAME) {
    session.state = 'STATE_CORRECT_ITEM_NAME';
    cache.put(lineUid, JSON.stringify(session), 1200);
    replyTextMessage(replyToken, `📝 請在對話框中直接輸入【正確的物品名稱】：\n(原名稱：${session.lastItemName})`);
    return;
  }

  // 8-B. 選擇更正數量
  if (userMessage === CMD_CORRECT_QTY) {
    session.state = 'STATE_CORRECT_QTY';
    cache.put(lineUid, JSON.stringify(session), 1200);
    replyTextMessage(replyToken, `🔢 請在對話框中直接輸入【正確的實清數量數字】：\n(原數量：${session.lastQty})`);
    return;
  }

  // 8-C. 刪除剛才這筆紀錄
  if (userMessage === CMD_DELETE_LAST_LOG) {
    deleteLastRecord(session.cellCode, session.lastSkuId);
    session.state = 'STATE_INPUT_SKU';
    cache.put(lineUid, JSON.stringify(session), 1200);
    
    replyTextMessage(replyToken, `🗑️ 已為您刪除剛才【${session.lastItemName}】的盤點紀錄並還原庫存！\n\n您現在可以重新搜尋該格位的物資：`);
    return;
  }
}

function executeCreateSkuAndProceed(replyToken, lineUid, session, itemName) {
  const cache = CacheService.getUserCache();

  if (isSystemControlCommand(itemName) || itemName.startsWith('CMD_')) {
    session.state = 'STATE_INPUT_SKU';
    cache.put(lineUid, JSON.stringify(session), 1200);
    replyTextMessage(replyToken, `⚠️ 輸入無效，請直接輸入物品名稱（例如：紙盤）：`);
    return;
  }

  const createResult = createAndGetNewSKU(itemName);

  if (!createResult.success) {
    replyTextMessage(replyToken, `❌ 建立失敗：${createResult.message}`);
    return;
  }

  session.state = 'STATE_INPUT_QTY';
  session.skuId = createResult.skuId;
  session.itemName = createResult.itemName;
  session.cateName = createResult.cateName;
  cache.put(lineUid, JSON.stringify(session), 1200);

  const tipMsg = createResult.isExisting 
    ? `⚠️ 提示：系統已存在完全同名品項【${createResult.itemName}】(編號: ${createResult.skuId})，已自動為您載入！` 
    : `🎉 新品項建檔成功！\n名稱：${createResult.itemName}\n編號：${createResult.skuId}`;

  replyTextMessage(replyToken, `${tipMsg}\n\n請在對話框中直接輸入本次盤點的【實清數量】數字（例如：5）：`);
}

function handleGoBack(replyToken, lineUid, session, userName) {
  const cache = CacheService.getUserCache();

  switch (session.state) {
    case 'STATE_INPUT_SKU':
    case 'STATE_CONFIRM_CREATE_SKU':
    case 'STATE_INPUT_FULL_SKU_NAME':
      const currentBoxShelves = parseShelvesFromBox(session.zoneId || "", session.boxId || "");
      session.state = 'STATE_CHOOSE_CELL';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const currentShelfItems = currentBoxShelves.map(s => ({ title: `📍 ${s.name}`, desc: `格位：${s.short_code}`, value: s.cell_code }));
      replyFlexMenuCard(replyToken, "🚪 選擇盤點層格", `已返回櫃體：【${session.boxName || "目前櫃子"}】\n請重新點選【層格】：`, currentShelfItems, `↩️ 返回 [${session.zoneName || "櫃位分區"}]`);
      break;

    case 'STATE_CHOOSE_FLOOR':
      const sites = getAllSites();
      session.state = 'STATE_CHOOSE_SITE';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const siteItems = sites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
      replyFlexMenuCard(replyToken, "↩️ 已返回據點選單", "請重新選擇【據點】：", siteItems, null);
      break;

    case 'STATE_CHOOSE_LOC':
      const floors = getFloorsBySite(session.siteName || "");
      session.state = 'STATE_CHOOSE_FLOOR';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const floorItems = floors.map(f => ({ title: f, desc: `${session.siteName} ${f}`, value: f }));
      replyFlexMenuCard(replyToken, "↩️ 已返回樓層選單", `請重新選擇【${session.siteName}】的樓層：`, floorItems, `↩️ 返回 [選擇據點]`);
      break;

    case 'STATE_CHOOSE_ZONE':
      const details = getDetailsBySiteAndFloor(session.siteName || "", session.floorName || "");
      session.state = 'STATE_CHOOSE_LOC';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const spaceItems = details.map(d => ({ title: d.space_name, desc: d.space_name, value: d.loc_id }));
      replyFlexMenuCard(replyToken, "↩️ 已返回空間選單", "請重新選擇【空間/展示區】：", spaceItems, `↩️ 返回 [${session.siteName} 樓層]`);
      break;

    case 'STATE_CHOOSE_BOX':
      const zones = getZonesByLocation(session.locId || "");
      session.state = 'STATE_CHOOSE_ZONE';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const zoneItems = zones.map(z => ({ title: z.zone_name, desc: z.zone_name, value: z.zone_id }));
      replyFlexMenuCard(replyToken, "↩️ 已返回櫃位選單", `請重新選擇【${session.spaceName || "空間"}】的櫃位區域：`, zoneItems, `↩️ 返回 [${session.floorName || "空間清單"}]`);
      break;

    case 'STATE_CHOOSE_CELL':
      const boxes = parseBoxesFromZone(session.zoneId || "");
      session.state = 'STATE_CHOOSE_BOX';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const boxItems = boxes.map(b => ({ title: b.display_label, desc: b.display_label, value: b.display_label }));
      replyFlexMenuCard(replyToken, "↩️ 已返回櫃子選單", `請重新選擇【${session.zoneName || "分區"}】的櫃子：`, boxItems, `↩️ 返回 [${session.spaceName || "空間清單"}]`);
      break;

    default:
      const defaultSites = getAllSites();
      session.state = 'STATE_CHOOSE_SITE';
      cache.put(lineUid, JSON.stringify(session), 1200);
      const defaultItems = defaultSites.map(s => ({ title: s, desc: "點擊進入此據點", value: s }));
      replyFlexMenuCard(replyToken, "🙏 選擇盤點據點", "請選擇您所在的【據點】：", defaultItems, null);
      break;
  }
}