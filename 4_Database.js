/**
 * 模組 4：資料庫與試算表操作層 (4_Database.js)
 * 核心功能：
 * 1. 零庫存前置建檔 (嚴格僅寫入 SKU_MASTER，依大類代碼生成前綴流水號)
 * 2. 讀取 CATEGORY_MASTER 提供網頁大類下拉選單
 * 3. 獨立格位庫存盤點與補救更正機制 (LockService 防併發)
 * 4. 據點、空間、櫃位、層格之階層結構查詢與志工雙重認證
 */

// ==============================================================================
// 🌟 零庫存前置建檔模組 (純主檔作業)
// ==============================================================================

/**
 * 讀取 CATEGORY_MASTER 的所有大類清單
 * 支援合併儲存格、空列容錯與表頭定位
 */
function getCategoryMasterList() {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("CATEGORY_MASTER");
    if (!sheet) {
      writeDebugLog("[getCategoryMasterList] 找不到 CATEGORY_MASTER 工作表");
      return [];
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    const headers = data[0].map(h => h ? h.toString().trim() : "");
    const codeIdx = headers.indexOf('大類代碼');
    const nameIdx = headers.indexOf('大類名稱');

    const effectiveCodeIdx = codeIdx !== -1 ? codeIdx : 0;
    const effectiveNameIdx = nameIdx !== -1 ? nameIdx : 1;

    const list = [];
    for (let i = 1; i < data.length; i++) {
      const code = data[i][effectiveCodeIdx] ? data[i][effectiveCodeIdx].toString().trim() : "";
      const name = data[i][effectiveNameIdx] ? data[i][effectiveNameIdx].toString().trim() : "";
      
      // 只要兩者皆有值就收錄（避開說明欄跳行所產生的空列）
      if (code && name) {
        list.push({ code: code, name: name });
      }
    }
    return list;
  } catch (e) {
    writeDebugLog("getCategoryMasterList 錯誤: " + e.message);
    return [];
  }
}

/**
 * 零庫存前置建檔：依大類代碼生成流水號並寫入 SKU_MASTER
 * 嚴格只寫入 SKU_MASTER，絕不更新 CURRENT_STOCK 或寫入 STOCKTAKE_LOG
 */
function createPreStockSkuMasterWithCategory(itemName, categoryCode, categoryName, imageUrl = "", barcode = "") {
  const cleanName = itemName.trim();
  if (!cleanName) {
    return { success: false, message: "品項名稱不得為空" };
  }
  if (!categoryCode || !categoryName) {
    return { success: false, message: "請選擇正確的物資大類" };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName("SKU_MASTER");
    if (!sheet) {
      return { success: false, message: "找不到 SKU_MASTER 資料表" };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const skuIdIdx = headers.indexOf('品項編號');
    const itemNameIdx = headers.indexOf('物品名稱');
    const cateNameIdx = headers.indexOf('大類名稱') !== -1 ? headers.indexOf('大類名稱') : headers.indexOf('大類');
    const cateCodeIdx = headers.indexOf('大類代碼');
    const barcodeIdx = headers.indexOf('ISBN/條碼');
    const imgIdx = headers.indexOf('封面圖片URL');

    if (skuIdIdx === -1 || itemNameIdx === -1) {
      return { success: false, message: "SKU_MASTER 缺少必要欄位 (品項編號 / 物品名稱)" };
    }

    // 1. 查重比對：品名完全相同者避免重複建檔
    const normalizedTarget = cleanName.replace(/\s+/g, "").toLowerCase();
    for (let i = 1; i < data.length; i++) {
      const existingName = data[i][itemNameIdx] ? data[i][itemNameIdx].toString().replace(/\s+/g, "").toLowerCase() : "";
      if (existingName === normalizedTarget) {
        // 若已存在但原本無圖片，則補齊封面
        if (imgIdx !== -1 && !data[i][imgIdx] && imageUrl) {
          sheet.getRange(i + 1, imgIdx + 1).setValue(imageUrl);
        }
        return {
          success: true,
          skuId: data[i][skuIdIdx].toString(),
          itemName: data[i][itemNameIdx].toString(),
          cateName: cateNameIdx !== -1 ? data[i][cateNameIdx].toString() : categoryName,
          categoryCode: cateCodeIdx !== -1 ? data[i][cateCodeIdx].toString() : categoryCode,
          barcode: barcodeIdx !== -1 ? data[i][barcodeIdx].toString() : "",
          imageUrl: imgIdx !== -1 ? data[i][imgIdx].toString() : imageUrl,
          isExisting: true
        };
      }
    }

    // 2. 依【大類代碼】計算流水號（格式如：BK-001 或 B-001）
    let maxSerial = 0;
    const prefix = categoryCode.toUpperCase().trim() + '-';

    for (let i = 1; i < data.length; i++) {
      const currentSku = data[i][skuIdIdx] ? data[i][skuIdIdx].toString().trim().toUpperCase() : "";
      if (currentSku.startsWith(prefix)) {
        const numPart = currentSku.replace(prefix, "");
        const parsedNum = parseInt(numPart, 10);
        if (!isNaN(parsedNum) && parsedNum > maxSerial) {
          maxSerial = parsedNum;
        }
      }
    }

    const nextSerial = maxSerial + 1;
    const newSkuId = prefix + String(nextSerial).padStart(3, '0');

    // 3. 寫入 SKU_MASTER 主檔
    const newRow = new Array(headers.length).fill("");
    newRow[skuIdIdx] = newSkuId;
    newRow[itemNameIdx] = cleanName;
    if (cateCodeIdx !== -1) newRow[cateCodeIdx] = categoryCode;
    if (cateNameIdx !== -1) newRow[cateNameIdx] = categoryName;
    if (barcodeIdx !== -1) newRow[barcodeIdx] = barcode || "";
    if (imgIdx !== -1) newRow[imgIdx] = imageUrl || "";

    sheet.appendRow(newRow);

    return {
      success: true,
      skuId: newSkuId,
      itemName: cleanName,
      cateName: categoryName,
      categoryCode: categoryCode,
      barcode: barcode || "",
      imageUrl: imageUrl,
      isExisting: false
    };
  } catch (e) {
    writeDebugLog("createPreStockSkuMasterWithCategory 失敗: " + e.message);
    return { success: false, message: "建檔失敗: " + e.message };
  } finally {
    lock.releaseLock();
  }
}

// ==============================================================================
// 📦 格位盤點核心業務模組
// ==============================================================================

function executeUpdateStockWorkflow(userId, cellCode, skuId, itemName, qty) {
  if (!validateStocktakeRelations(userId, skuId)) {
    return false; 
  }
  
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // 1. 寫入歷史日誌表 STOCKTAKE_LOG
    let logSheet = ss.getSheetByName("STOCKTAKE_LOG");
    if (!logSheet) {
      logSheet = ss.insertSheet("STOCKTAKE_LOG");
      logSheet.appendRow(["流水編號", "日期時間", "人員編號", "儲位格位代碼", "品項編號", "物品名稱", "實清數量"]);
    }
    const nextLogId = 'LOG-' + String(logSheet.getLastRow()).padStart(3, '0');
    logSheet.appendRow([nextLogId, new Date(), userId, cellCode, skuId, itemName, qty]);

    // 2. 更新當前庫存表 CURRENT_STOCK (模式 1：依 cellCode + skuId 獨立更新)
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
  } catch (e) {
    writeDebugLog("executeUpdateStockWorkflow 執行失敗或鎖定逾時: " + e.message);
    return false;
  } finally {
    lock.releaseLock();
  }
}

function correctLastItemName(skuId, newItemName, cellCode) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    const skuSheet = ss.getSheetByName("SKU_MASTER");
    if (skuSheet) {
      const data = skuSheet.getDataRange().getValues();
      const skuIdx = data[0].indexOf("品項編號");
      const nameIdx = data[0].indexOf("物品名稱");
      for (let i = 1; i < data.length; i++) {
        if (data[i][skuIdx] && data[i][skuIdx].toString() === skuId) {
          skuSheet.getRange(i + 1, nameIdx + 1).setValue(newItemName);
          break;
        }
      }
    }

    const logSheet = ss.getSheetByName("STOCKTAKE_LOG");
    if (logSheet) {
      const lastRow = logSheet.getLastRow();
      if (lastRow > 1) {
        const headers = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
        const nameIdx = headers.indexOf("物品名稱");
        if (nameIdx !== -1) logSheet.getRange(lastRow, nameIdx + 1).setValue(newItemName);
      }
    }

    const stockSheet = ss.getSheetByName("CURRENT_STOCK");
    if (stockSheet) {
      const data = stockSheet.getDataRange().getValues();
      const cellIdx = data[0].indexOf("儲位格位代碼");
      const skuIdx = data[0].indexOf("品項編號");
      const nameIdx = data[0].indexOf("物品名稱");
      for (let i = 1; i < data.length; i++) {
        if (data[i][cellIdx] === cellCode && data[i][skuIdx] === skuId) {
          stockSheet.getRange(i + 1, nameIdx + 1).setValue(newItemName);
          break;
        }
      }
    }
  } catch (e) {
    writeDebugLog("correctLastItemName 執行失敗: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

function correctLastQty(cellCode, skuId, newQty) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    const logSheet = ss.getSheetByName("STOCKTAKE_LOG");
    if (logSheet) {
      const lastRow = logSheet.getLastRow();
      if (lastRow > 1) {
        const headers = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
        const qtyIdx = headers.indexOf("實清數量");
        if (qtyIdx !== -1) logSheet.getRange(lastRow, qtyIdx + 1).setValue(newQty);
      }
    }

    const stockSheet = ss.getSheetByName("CURRENT_STOCK");
    if (stockSheet) {
      const data = stockSheet.getDataRange().getValues();
      const cellIdx = data[0].indexOf("儲位格位代碼");
      const skuIdx = data[0].indexOf("品項編號");
      const qtyIdx = data[0].indexOf("現有庫存量");
      for (let i = 1; i < data.length; i++) {
        if (data[i][cellIdx] === cellCode && data[i][skuIdx] === skuId) {
          stockSheet.getRange(i + 1, qtyIdx + 1).setValue(newQty);
          break;
        }
      }
    }
  } catch (e) {
    writeDebugLog("correctLastQty 執行失敗: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

function deleteLastRecord(cellCode, skuId) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    const logSheet = ss.getSheetByName("STOCKTAKE_LOG");
    if (logSheet && logSheet.getLastRow() > 1) {
      logSheet.deleteRow(logSheet.getLastRow());
    }

    const stockSheet = ss.getSheetByName("CURRENT_STOCK");
    if (stockSheet) {
      const data = stockSheet.getDataRange().getValues();
      const cellIdx = data[0].indexOf("儲位格位代碼");
      const skuIdx = data[0].indexOf("品項編號");
      for (let i = 1; i < data.length; i++) {
        if (data[i][cellIdx] === cellCode && data[i][skuIdx] === skuId) {
          stockSheet.deleteRow(i + 1);
          break;
        }
      }
    }
  } catch (e) {
    writeDebugLog("deleteLastRecord 執行失敗: " + e.message);
  } finally {
    lock.releaseLock();
  }
}

// ==============================================================================
// 🏛️ 儲位層級查詢模組 (據點 ➔ 樓層 ➔ 空間 ➔ 櫃位 ➔ 層格)
// ==============================================================================

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

function getLocationInfoById(locId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("LOC_MASTER");
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idIdx = headers.indexOf("場域編碼");
  const descIdx = headers.indexOf("儲位詳細說明");
  const nameIdx = headers.indexOf("場域名稱");

  for (let i = 1; i < data.length; i++) {
    if (data[i][idIdx] && data[i][idIdx].toString().trim() === locId) {
      const spaceName = descIdx !== -1 && data[i][descIdx] ? data[i][descIdx].toString().trim() : (data[i][nameIdx] || locId);
      return { loc_id: locId, space_name: spaceName };
    }
  }
  return null;
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

function getZoneNameById(zoneId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
  if (!sheet) return zoneId;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const zoneIdIdx = headers.indexOf('儲位明細編碼');
  const zoneNameIdx = headers.indexOf('儲位分區名稱');

  for (let i = 1; i < data.length; i++) {
    if (data[i][zoneIdIdx] && data[i][zoneIdIdx].toString().trim() === zoneId) {
      return (zoneNameIdx !== -1 && data[i][zoneNameIdx]) ? data[i][zoneNameIdx].toString().trim() : zoneId;
    }
  }
  return zoneId;
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
  } catch(e) {
    writeDebugLog(`[JSON解析錯誤] parseBoxesFromZone 失敗, zoneId: ${zoneId}, 錯誤: ${e.message}, 內容: ${jsonString}`);
    return [];
  }
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
  } catch(e) {
    writeDebugLog(`[JSON解析錯誤] parseShelvesFromBox 失敗, zoneId: ${zoneId}, boxId: ${boxId}, 錯誤: ${e.message}, 內容: ${jsonString}`);
    return [];
  }
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

// ==============================================================================
// 👤 志工身分與安全認證模組
// ==============================================================================

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

  const matchedPhones = matchedRows.filter(m => 
    m.dbPhone && (m.dbPhone.endsWith(cleanInputPhone) || cleanInputPhone === m.dbPhone)
  );

  if (matchedPhones.length > 1 && cleanInputPhone.length < 10) {
    replyTextMessage(replyToken, `⚠️ 檢測到有同名且末碼相同的志工資料，為確保帳號安全，請在對話框中直接輸入您的【完整 10 碼手機號碼】：`);
    return;
  }

  const finalTarget = matchedPhones.length > 0 ? matchedPhones[0] : null;

  if (!finalTarget) {
    replyTextMessage(replyToken, `⚠️ 驗證失敗：您輸入的手機號碼與後台登記的資料不符，請重新點選「身份綁定」或聯繫管理員核對資料。`);
    return;
  }

  if (finalTarget.currentUid !== "" && finalTarget.currentUid !== lineUid) {
    CacheService.getUserCache().remove(lineUid);
    replyTextMessage(replyToken, `⚠️ 綁定失敗：[${inputName}] 搭配此手機的帳號已被其他 LINE 綁定，請聯繫系統管理員。`);
    return;
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    sheet.getRange(finalTarget.rowIndex, uidIdx + 1).setValue(lineUid);
    CacheService.getUserCache().remove(lineUid);
    replyTextMessage(replyToken, `🎉 志工身份認證成功！\n\n歡迎 ${inputName} (編號: ${finalTarget.userId})！已為您開通盤點權限。\n\n請點擊圖文選單的「📷 開始盤點」即可開始作業囉！🙏`);
  } catch (e) {
    writeDebugLog("processDualBinding 寫入 LINE_UID 失敗: " + e.message);
    replyTextMessage(replyToken, "❌ 系統忙碌中，請稍後重新嘗試綁定。");
  } finally {
    lock.releaseLock();
  }
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