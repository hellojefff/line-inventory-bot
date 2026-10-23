/**
 * 模組 4：資料庫與試算表操作層 (4_Database.js)
 */

// ==================== 1. 資料庫連線與安全鎖工具 ====================

function withSpreadsheet(action, requireLock = false, lockTimeout = 10000) {
  let lock = null;
  try {
    if (requireLock) {
      lock = LockService.getScriptLock();
      lock.waitLock(lockTimeout);
    }
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    return action(ss);
  } catch (e) {
    writeDebugLog(`withSpreadsheet 執行錯誤: ${e.message}`);
    throw e;
  } finally {
    if (lock) {
      lock.releaseLock();
    }
  }
}

function getSheetColumnIndexes(headers) {
  const map = {};
  headers.forEach((h, idx) => {
    if (h !== null && h !== undefined) {
      map[h.toString().trim()] = idx;
    }
  });
  return map;
}

// ==================== 2. 零庫存前置建檔模組 (SKU_MASTER) ====================

function getCategoryMasterList() {
  try {
    return withSpreadsheet(ss => {
      const sheet = ss.getSheetByName("CATEGORY_MASTER");
      if (!sheet) return [];
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) return [];

      const colMap = getSheetColumnIndexes(data[0]);
      const codeIdx = colMap['大類代碼'] !== undefined ? colMap['大類代碼'] : 0;
      const nameIdx = colMap['大類名稱'] !== undefined ? colMap['大類名稱'] : 1;

      const list = [];
      for (let i = 1; i < data.length; i++) {
        const code = data[i][codeIdx] ? data[i][codeIdx].toString().trim() : "";
        const name = data[i][nameIdx] ? data[i][nameIdx].toString().trim() : "";
        if (code && name) {
          list.push({ code: code, name: name });
        }
      }
      return list;
    }, false);
  } catch (e) {
    writeDebugLog("getCategoryMasterList 錯誤: " + e.message);
    return [];
  }
}

function appendSkuMasterRecord(data) {
  const cleanName = (data.name || data.itemName || "").trim();
  if (!cleanName) throw new Error("物品名稱不得為空");

  const categoryName = (data.category || "").trim();
  let categoryCode = (data.categoryCode || "").trim();

  if (!categoryCode) {
    const categories = getCategoryMasterList();
    const matched = categories.find(c => c.name === categoryName || categoryName.includes(c.name));
    if (matched) {
      categoryCode = matched.code;
    } else {
      const matchParen = categoryName.match(/\(([A-Za-z0-9]+)\)/);
      categoryCode = matchParen ? matchParen[1] : "H";
    }
  }
  categoryCode = (categoryCode || "H").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");

  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("SKU_MASTER");
    if (!sheet) throw new Error("找不到 SKU_MASTER 資料表");

    const rows = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(rows[0]);

    const skuIdIdx = colMap['品項編號'];
    const cateCodeIdx = colMap['大類代碼'];
    const cateNameIdx = colMap['大類名稱'] !== undefined ? colMap['大類名稱'] : colMap['大類'];
    const itemNameIdx = colMap['物品名稱'];
    const specAuthorIdx = colMap['規格或作者'] !== undefined ? colMap['規格或作者'] : colMap['規格/作者'];
    const unitIdx = colMap['單位'];
    const barcodeIdx = colMap['條碼編號'] !== undefined ? colMap['條碼編號'] : colMap['ISBN/條碼'];
    const imgIdx = colMap['封面圖片URL'] !== undefined ? colMap['封面圖片URL'] : colMap['圖片網址'];
    const innerImgIdx = colMap['內頁圖片URL'] !== undefined ? colMap['內頁圖片URL'] : colMap['版權頁圖片URL'];
    const sourceIdx = colMap['建檔來源'];
    const creatorIdx = colMap['建立人員'];
    const timeIdx = colMap['建立時間'];

    if (skuIdIdx === undefined || itemNameIdx === undefined) {
      throw new Error("SKU_MASTER 缺少必要欄位 (品項編號 / 物品名稱)");
    }

    const normalizedTarget = normalizeTitle(cleanName);
    for (let i = 1; i < rows.length; i++) {
      const existingName = rows[i][itemNameIdx] ? normalizeTitle(rows[i][itemNameIdx].toString()) : "";
      if (existingName === normalizedTarget) {
        if (imgIdx !== undefined && !rows[i][imgIdx] && data.imageUrl) {
          sheet.getRange(i + 1, imgIdx + 1).setValue(data.imageUrl);
        }
        if (innerImgIdx !== undefined && !rows[i][innerImgIdx] && data.innerImageUrl) {
          sheet.getRange(i + 1, innerImgIdx + 1).setValue(data.innerImageUrl);
        }
        return {
          id: rows[i][skuIdIdx].toString(),
          name: rows[i][itemNameIdx].toString(),
          isExisting: true
        };
      }
    }

    let maxSerial = 0;
    const prefixRegex = new RegExp(`^${categoryCode}-?(\\d+)$`, 'i');

    for (let i = 1; i < rows.length; i++) {
      const currentSku = rows[i][skuIdIdx] ? rows[i][skuIdIdx].toString().trim() : "";
      const match = currentSku.match(prefixRegex);
      if (match) {
        const parsedNum = parseInt(match[1], 10);
        if (!isNaN(parsedNum) && parsedNum > maxSerial) {
          maxSerial = parsedNum;
        }
      }
    }

    const nextSerial = maxSerial + 1;
    const newSkuId = `${categoryCode}${String(nextSerial).padStart(7, '0')}`;
    const timestamp = Utilities.formatDate(new Date(), "GMT+8", "yyyy-MM-dd HH:mm:ss");

    const newRow = new Array(rows[0].length).fill("");
    newRow[skuIdIdx] = newSkuId;
    if (cateCodeIdx !== undefined) newRow[cateCodeIdx] = categoryCode;
    if (cateNameIdx !== undefined) newRow[cateNameIdx] = categoryName;
    newRow[itemNameIdx] = cleanName;
    if (specAuthorIdx !== undefined) newRow[specAuthorIdx] = data.author || data.spec || "";
    if (unitIdx !== undefined) newRow[unitIdx] = data.unit || "本";
    if (barcodeIdx !== undefined) newRow[barcodeIdx] = data.barcode || "";
    if (imgIdx !== undefined) newRow[imgIdx] = data.imageUrl || "";
    if (innerImgIdx !== undefined) newRow[innerImgIdx] = data.innerImageUrl || "";
    if (sourceIdx !== undefined) newRow[sourceIdx] = data.source || "LINE拍照入庫";
    if (creatorIdx !== undefined) newRow[creatorIdx] = data.creator || "系統建檔";
    if (timeIdx !== undefined) newRow[timeIdx] = timestamp;

    sheet.appendRow(newRow);

    return {
      id: newSkuId,
      name: cleanName,
      isExisting: false
    };
  }, true);
}

// ==================== 3. 庫存盤點與批次更新模組 ====================

function executeBatchStockWorkflow(userId, cellCode, items) {
  if (!items || items.length === 0) {
    return { success: false, message: "無待更新項目" };
  }

  return withSpreadsheet(ss => {
    let logSheet = ss.getSheetByName("STOCKTAKE_LOG");
    if (!logSheet) {
      logSheet = ss.insertSheet("STOCKTAKE_LOG");
      logSheet.appendRow(["流水編號", "日期時間", "人員編號", "儲位格位代碼", "品項編號", "物品名稱", "實清數量"]);
    }
    const startRow = logSheet.getLastRow();
    const timestamp = new Date();
    const logRows = [];

    items.forEach((item, idx) => {
      const nextLogId = 'LOG-' + String(startRow + idx).padStart(3, '0');
      logRows.push([nextLogId, timestamp, userId, cellCode, item.skuId, item.itemName, item.qty]);
    });

    if (logRows.length > 0) {
      logSheet.getRange(startRow + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
    }

    let stockSheet = ss.getSheetByName("CURRENT_STOCK");
    if (!stockSheet) {
      stockSheet = ss.insertSheet("CURRENT_STOCK");
      stockSheet.appendRow(["場域編碼", "儲位格位代碼", "品項編號", "物品名稱", "現有庫存量"]);
    }

    const stockData = stockSheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(stockData[0]);
    const cellIdx = colMap['儲位格位代碼'];
    const skuIdx = colMap['品項編號'];
    const qtyIdx = colMap['現有庫存量'];
    const parts = cellCode.split('-');
    const targetLocId = parts.length >= 2 ? `${parts[0]}-${parts[1]}` : cellCode;

    const toAppend = [];
    items.forEach(item => {
      let isFound = false;
      for (let i = 1; i < stockData.length; i++) {
        if (stockData[i][cellIdx] === cellCode && stockData[i][skuIdx] === item.skuId) {
          stockSheet.getRange(i + 1, qtyIdx + 1).setValue(item.qty);
          stockData[i][qtyIdx] = item.qty;
          isFound = true;
          break;
        }
      }
      if (!isFound) {
        const newRow = new Array(stockData[0].length).fill("");
        newRow[colMap['場域編碼']] = targetLocId;
        newRow[cellIdx] = cellCode;
        newRow[skuIdx] = item.skuId;
        newRow[colMap['物品名稱']] = item.itemName;
        newRow[qtyIdx] = item.qty;
        toAppend.push(newRow);
      }
    });

    if (toAppend.length > 0) {
      stockSheet.getRange(stockSheet.getLastRow() + 1, 1, toAppend.length, toAppend[0].length).setValues(toAppend);
    }

    return { success: true, count: items.length };
  }, true);
}

function executeUpdateStockWorkflow(userId, cellCode, skuId, itemName, qty) {
  if (!validateStocktakeRelations(userId, skuId)) return false; 
  const res = executeBatchStockWorkflow(userId, cellCode, [{ skuId: skuId, itemName: itemName, qty: qty }]);
  return res.success;
}

function correctLastItemName(skuId, newItemName, cellCode) {
  try {
    withSpreadsheet(ss => {
      const skuSheet = ss.getSheetByName("SKU_MASTER");
      if (skuSheet) {
        const data = skuSheet.getDataRange().getValues();
        const colMap = getSheetColumnIndexes(data[0]);
        for (let i = 1; i < data.length; i++) {
          if (data[i][colMap['品項編號']] && data[i][colMap['品項編號']].toString() === skuId) {
            skuSheet.getRange(i + 1, colMap['物品名稱'] + 1).setValue(newItemName);
            break;
          }
        }
      }

      const logSheet = ss.getSheetByName("STOCKTAKE_LOG");
      if (logSheet && logSheet.getLastRow() > 1) {
        const headers = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
        const colMap = getSheetColumnIndexes(headers);
        if (colMap['物品名稱'] !== undefined) {
          logSheet.getRange(logSheet.getLastRow(), colMap['物品名稱'] + 1).setValue(newItemName);
        }
      }

      const stockSheet = ss.getSheetByName("CURRENT_STOCK");
      if (stockSheet) {
        const data = stockSheet.getDataRange().getValues();
        const colMap = getSheetColumnIndexes(data[0]);
        for (let i = 1; i < data.length; i++) {
          if (data[i][colMap['儲位格位代碼']] === cellCode && data[i][colMap['品項編號']] === skuId) {
            stockSheet.getRange(i + 1, colMap['物品名稱'] + 1).setValue(newItemName);
            break;
          }
        }
      }
    }, true);
  } catch (e) {
    writeDebugLog("correctLastItemName 失敗: " + e.message);
  }
}

function correctLastQty(cellCode, skuId, newQty) {
  try {
    withSpreadsheet(ss => {
      const logSheet = ss.getSheetByName("STOCKTAKE_LOG");
      if (logSheet && logSheet.getLastRow() > 1) {
        const headers = logSheet.getRange(1, 1, 1, logSheet.getLastColumn()).getValues()[0];
        const colMap = getSheetColumnIndexes(headers);
        if (colMap['實清數量'] !== undefined) {
          logSheet.getRange(logSheet.getLastRow(), colMap['實清數量'] + 1).setValue(newQty);
        }
      }

      const stockSheet = ss.getSheetByName("CURRENT_STOCK");
      if (stockSheet) {
        const data = stockSheet.getDataRange().getValues();
        const colMap = getSheetColumnIndexes(data[0]);
        for (let i = 1; i < data.length; i++) {
          if (data[i][colMap['儲位格位代碼']] === cellCode && data[i][colMap['品項編號']] === skuId) {
            stockSheet.getRange(i + 1, colMap['現有庫存量'] + 1).setValue(newQty);
            break;
          }
        }
      }
    }, true);
  } catch (e) {
    writeDebugLog("correctLastQty 失敗: " + e.message);
  }
}

function deleteLastRecord(cellCode, skuId) {
  try {
    withSpreadsheet(ss => {
      const logSheet = ss.getSheetByName("STOCKTAKE_LOG");
      if (logSheet && logSheet.getLastRow() > 1) {
        logSheet.deleteRow(logSheet.getLastRow());
      }

      const stockSheet = ss.getSheetByName("CURRENT_STOCK");
      if (stockSheet) {
        const data = stockSheet.getDataRange().getValues();
        const colMap = getSheetColumnIndexes(data[0]);
        for (let i = 1; i < data.length; i++) {
          if (data[i][colMap['儲位格位代碼']] === cellCode && data[i][colMap['品項編號']] === skuId) {
            stockSheet.deleteRow(i + 1);
            break;
          }
        }
      }
    }, true);
  } catch (e) {
    writeDebugLog("deleteLastRecord 失敗: " + e.message);
  }
}

// ==================== 4. 儲位階層檢索模組 ====================

function getAllSites() {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("LOC_MASTER");
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    const siteIdx = colMap['據點'];
    if (siteIdx === undefined) return [];

    const siteSet = new Set();
    for (let i = 1; i < data.length; i++) {
      const site = data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
      if (site) siteSet.add(site);
    }
    return Array.from(siteSet);
  }, false);
}

function getFloorsBySite(siteName) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("LOC_MASTER");
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    const siteIdx = colMap['據點'];
    const floorIdx = colMap['樓層'];
    if (siteIdx === undefined || floorIdx === undefined) return [];

    const floorSet = new Set();
    for (let i = 1; i < data.length; i++) {
      const currentSite = data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
      const floor = data[i][floorIdx] ? data[i][floorIdx].toString().trim() : "";
      if (currentSite === siteName && floor) {
        floorSet.add(floor);
      }
    }
    return Array.from(floorSet);
  }, false);
}

function getDetailsBySiteAndFloor(siteName, floorName) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("LOC_MASTER");
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    
    const idIdx = colMap['場域編碼'];
    const siteIdx = colMap['據點'];
    const floorIdx = colMap['樓層'];
    const descIdx = colMap['儲位詳細說明'];
    const nameIdx = colMap['場域名稱'];

    const details = [];
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx]) {
        const locId = data[i][idIdx].toString().trim();
        const currentSite = siteIdx !== undefined && data[i][siteIdx] ? data[i][siteIdx].toString().trim() : "";
        const currentFloor = floorIdx !== undefined && data[i][floorIdx] ? data[i][floorIdx].toString().trim() : "";
        
        if (currentSite === siteName && currentFloor === floorName) {
          let spaceName = descIdx !== undefined && data[i][descIdx] ? data[i][descIdx].toString().trim() : "";
          if (!spaceName) {
            spaceName = (nameIdx !== undefined && data[i][nameIdx]) ? data[i][nameIdx].toString().trim() : locId;
          }
          details.push({ loc_id: locId, space_name: spaceName });
        }
      }
    }
    return details;
  }, false);
}

function getLocationInfoById(locId) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("LOC_MASTER");
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    
    const idIdx = colMap['場域編碼'];
    const descIdx = colMap['儲位詳細說明'];
    const nameIdx = colMap['場域名稱'];

    for (let i = 1; i < data.length; i++) {
      if (data[i][idIdx] && data[i][idIdx].toString().trim() === locId) {
        const spaceName = descIdx !== undefined && data[i][descIdx] ? data[i][descIdx].toString().trim() : (data[i][nameIdx] || locId);
        return { loc_id: locId, space_name: spaceName };
      }
    }
    return null;
  }, false);
}

function getZonesByLocation(locId) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    
    const zoneIdIdx = colMap['儲位明細編碼'];
    const zoneNameIdx = colMap['儲位分區名稱'];

    const zones = [];
    for (let i = 1; i < data.length; i++) {
      const zoneId = data[i][zoneIdIdx] ? data[i][zoneIdIdx].toString().trim() : "";
      if (zoneId && zoneId.startsWith(locId)) {
        let chineseName = zoneNameIdx !== undefined && data[i][zoneNameIdx] ? data[i][zoneNameIdx].toString().trim() : "";
        if (!chineseName) chineseName = zoneId;

        zones.push({ zone_id: zoneId, zone_name: chineseName });
      }
    }
    return zones;
  }, false);
}

function getZoneNameById(zoneId) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
    if (!sheet) return zoneId;
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    const zoneIdIdx = colMap['儲位明細編碼'];
    const zoneNameIdx = colMap['儲位分區名稱'];

    for (let i = 1; i < data.length; i++) {
      if (data[i][zoneIdIdx] && data[i][zoneIdIdx].toString().trim() === zoneId) {
        return (zoneNameIdx !== undefined && data[i][zoneNameIdx]) ? data[i][zoneNameIdx].toString().trim() : zoneId;
      }
    }
    return zoneId;
  }, false);
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
    writeDebugLog(`[JSON解析錯誤] parseBoxesFromZone 失敗, zoneId: ${zoneId}, 錯誤: ${e.message}`);
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
    writeDebugLog(`[JSON解析錯誤] parseShelvesFromBox 失敗, zoneId: ${zoneId}, boxId: ${boxId}, 錯誤: ${e.message}`);
    return [];
  }
}

function getRawJsonString(zoneId) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("SUB_ZONE_DETAIL");
    if (!sheet) return "";
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    const zoneIdIdx = colMap['儲位明細編碼'];
    const jsonIdx = colMap['實體層格微細配置'];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][zoneIdIdx] === zoneId) return data[i][jsonIdx];
    }
    return "";
  }, false);
}

// ==================== 5. 志工身分認證與 SKU 強化檢索 ====================

function getVolunteerByLineUid(lineUid) {
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("USER_MASTER");
    if (!sheet) return null;
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    const uidIdx = colMap['LINE_UID'];
    if (uidIdx === undefined) return null;

    for (let i = 1; i < data.length; i++) {
      if (data[i][uidIdx] && data[i][uidIdx].toString().trim() === lineUid) {
        const userObj = {};
        data[0].forEach((header, index) => { userObj[header] = data[i][index]; });
        return userObj;
      }
    }
    return null;
  }, false);
}

function processDualBinding(replyToken, lineUid, inputName, inputPhone) {
  try {
    withSpreadsheet(ss => {
      const sheet = ss.getSheetByName("USER_MASTER");
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const colMap = getSheetColumnIndexes(data[0]);
      
      const userIdIdx = colMap['人員編號'];
      const nameIdx = colMap['人員姓名'];
      const phoneIdx = colMap['手機號碼'];
      const uidIdx = colMap['LINE_UID'];

      if (phoneIdx === undefined) {
        replyTextMessage(replyToken, "❌ 系統後台出錯：USER_MASTER 中找不到「手機號碼」欄位，請通知管理員。");
        return;
      }

      const cleanInputName = inputName.replace(/\s+/g, "");
      const cleanInputPhone = inputPhone.replace(/[^0-9]/g, "");

      const matchedRows = [];
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

      sheet.getRange(finalTarget.rowIndex, uidIdx + 1).setValue(lineUid);
      CacheService.getUserCache().remove(lineUid);
      replyTextMessage(replyToken, `🎉 志工身份認證成功！\n\n歡迎 ${inputName} (編號: ${finalTarget.userId})！已為您開通盤點權限。\n\n請點擊圖文選單的「📷 開始盤點」即可開始作業囉！🙏`);
    }, true);
  } catch (e) {
    writeDebugLog("processDualBinding 寫入 LINE_UID 失敗: " + e.message);
    replyTextMessage(replyToken, "❌ 系統忙碌中，請稍後重新嘗試綁定。");
  }
}

function normalizeTitle(str) {
  if (!str) return "";
  return str.toString()
    .toLowerCase()
    .replace(/[\s\r\n\t]/g, "")
    .replace(/[：:，,、。·・《》〈〉（）()\[\]【】\-_—"']/g, "");
}

/**
 * 🌟 強化版 findSKU：副標題自動切分比對 + 作者加權評分
 */
function findSKU(keyword, barcode = "", author = "") {
  if (!keyword && !barcode && !author) return [];
  
  return withSpreadsheet(ss => {
    const sheet = ss.getSheetByName("SKU_MASTER");
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    const colMap = getSheetColumnIndexes(data[0]);
    
    const skuIdIdx = colMap['品項編號'];
    const itemNameIdx = colMap['物品名稱'];
    const specAuthorIdx = colMap['規格或作者'] !== undefined ? colMap['規格或作者'] : colMap['規格/作者'];
    const barcodeIdx = colMap['條碼編號'] !== undefined ? colMap['條碼編號'] : colMap['ISBN/條碼']; 

    const rawKey = (keyword || "").toString().trim();
    const normKey = normalizeTitle(rawKey);
    const cleanBarcode = barcode ? barcode.toString().replace(/[^0-9]/g, "") : "";
    const normAuthorInput = normalizeTitle(author);

    // 🌟 將輸入字串依常見分隔符（破折號、冒號、斜線）切分子詞
    const subSegments = rawKey
      .split(/[—–\-_:：\s/\\()（）「」『』《》〈〉]/)
      .map(s => normalizeTitle(s))
      .filter(s => s.length >= 3);

    const scoredResults = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const skuVal = row[skuIdIdx] ? row[skuIdIdx].toString().trim() : "";
      const nameVal = row[itemNameIdx] ? row[itemNameIdx].toString().trim() : "";
      const authorVal = (specAuthorIdx !== undefined && row[specAuthorIdx]) ? row[specAuthorIdx].toString().trim() : "";
      const barcodeVal = (barcodeIdx !== undefined && row[barcodeIdx]) ? row[barcodeIdx].toString().replace(/[^0-9]/g, "") : "";

      const normName = normalizeTitle(nameVal);
      const normAuthor = normalizeTitle(authorVal);

      let score = 0;

      // 1. ISBN / 條碼命中
      if (cleanBarcode && barcodeVal && cleanBarcode === barcodeVal) {
        score += 100;
      }

      // 2. 品項編號完全命中
      if (rawKey && skuVal && skuVal.toLowerCase() === rawKey.toLowerCase()) {
        score += 100;
      }

      // 3. 全名標準化比對
      if (normKey && normName) {
        if (normKey === normName) {
          score += 80;
        } else if (normName.includes(normKey) || normKey.includes(normName)) {
          score += 60;
        }
      }

      // 4. 副標題 / 片段命中 (精準化解「法會」vs「法命」的差異)
      if (subSegments.length > 0 && normName) {
        for (const seg of subSegments) {
          if (normName.includes(seg)) {
            score += Math.min(50, seg.length * 7);
          }
        }
      }

      // 5. 作者加權比對
      if (normAuthorInput && normAuthor) {
        if (normAuthor.includes(normAuthorInput) || normAuthorInput.includes(normAuthor)) {
          score += 30;
        }
      }

      if (score >= 35) {
        const skuObj = {};
        data[0].forEach((header, index) => { skuObj[header] = row[index]; });
        skuObj._matchScore = score;
        scoredResults.push(skuObj);
      }
    }

    scoredResults.sort((a, b) => b._matchScore - a._matchScore);
    return scoredResults.map(item => {
      delete item._matchScore;
      return item;
    });
  }, false);
}

function validateStocktakeRelations(userId, skuId) {
  return withSpreadsheet(ss => {
    const userSheet = ss.getSheetByName('USER_MASTER');
    if (!userSheet) return false;
    const userData = userSheet.getDataRange().getValues();
    const userExists = userData.some((row, idx) => idx > 0 && row[0] === userId);
    if (!userExists) return false;
    
    const skuSheet = ss.getSheetByName('SKU_MASTER');
    if (!skuSheet) return false;
    const skuData = skuSheet.getDataRange().getValues();
    const skuExists = skuData.some((row, idx) => idx > 0 && row[0] === skuId);
    return skuExists;
  }, false);
}

function writeDebugLog(contents) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let debugSheet = ss.getSheetByName("DEBUG_LOG");
    if (!debugSheet) debugSheet = ss.insertSheet("DEBUG_LOG");
    debugSheet.appendRow([new Date(), contents]);
  } catch(e) {}
}