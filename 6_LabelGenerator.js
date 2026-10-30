/**
 * 🌟 實體櫃位 QR Code 標籤自動排版工具（全層級完整版）
 * 自動聯表 LOC_MASTER 補齊【據點（如：大安覺風）】、【樓層與空間】
 */
function generateShelfQrCodeSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sourceSheet = ss.getSheetByName("SUB_ZONE_DETAIL");
  if (!sourceSheet) {
    Logger.log("❌ 找不到 SUB_ZONE_DETAIL 工作表");
    return;
  }

  const webAppBase = getWebAppUrl();

  // 1. 建立 LOC_MASTER 空間快查表（場域編碼 ➔ 據點、樓層、空間名稱）
  const locMasterSheet = ss.getSheetByName("LOC_MASTER");
  const locMap = {};
  if (locMasterSheet) {
    const locData = locMasterSheet.getDataRange().getValues();
    if (locData.length > 1) {
      const locCol = getSheetColumnIndexes(locData[0]);
      for (let i = 1; i < locData.length; i++) {
        const lid = locData[i][locCol['場域編碼']] ? locData[i][locCol['場域編碼']].toString().trim() : "";
        if (lid) {
          const site = locCol['據點'] !== undefined && locData[i][locCol['據點']] ? locData[i][locCol['據點']].toString().trim() : "";
          const floor = locCol['樓層'] !== undefined && locData[i][locCol['樓層']] ? locData[i][locCol['樓層']].toString().trim() : "";
          let spaceName = locCol['儲位詳細說明'] !== undefined && locData[i][locCol['儲位詳細說明']] ? locData[i][locCol['儲位詳細說明']].toString().trim() : "";
          if (!spaceName) {
            spaceName = locCol['場域名稱'] !== undefined && locData[i][locCol['場域名稱']] ? locData[i][locCol['場域名稱']].toString().trim() : lid;
          }
          locMap[lid] = { site: site, floor: floor, spaceName: spaceName };
        }
      }
    }
  }

  // 2. 讀取 SUB_ZONE_DETAIL 分區與層格微細配置
  const srcData = sourceSheet.getDataRange().getValues();
  if (srcData.length <= 1) return;

  const colMap = getSheetColumnIndexes(srcData[0]);
  const zoneIdIdx = colMap['儲位明細編碼'];
  const zoneNameIdx = colMap['儲位分區名稱'];
  const jsonIdx = colMap['實體層格微細配置'];

  const labelRows = [];

  for (let i = 1; i < srcData.length; i++) {
    const zoneId = srcData[i][zoneIdIdx] ? srcData[i][zoneIdIdx].toString().trim() : "";
    const zoneName = srcData[i][zoneNameIdx] ? srcData[i][zoneNameIdx].toString().trim() : "";
    const jsonStr = srcData[i][jsonIdx];
    if (!jsonStr) continue;

    // 由 zoneId (例：DA-004-Z01) 取得場域編碼 (DA-004)
    const locId = zoneId.includes('-Z') ? zoneId.split('-Z')[0] : zoneId.split('-').slice(0, 2).join('-');
    const locInfo = locMap[locId] || { site: "", floor: "", spaceName: "" };
    const siteName = locInfo.site || "";
    const floorAndSpace = [locInfo.floor, locInfo.spaceName].filter(Boolean).join(" ");
    
    // 組裝直達網頁的完整空間層級（大安覺風 地下1樓 小教室 - 書架藏書區）
    const fullSpaceDisplay = [siteName, floorAndSpace, zoneName].filter(Boolean).join(" ");

    try {
      const boxes = JSON.parse(jsonStr);
      for (const box of boxes) {
        if (!box.shelves) continue;
        const boxName = box.box_name || box.box_id || "";

        for (const shelf of box.shelves) {
          const cellCode = shelf.cell_code || "";
          if (!cellCode) continue;

          const shortCode = cellCode.includes('#') ? cellCode.split('#')[1] : cellCode;
          const shelfName = shelf.name || "";
          const defaultItem = shelf.default_item || "無";

          // 組裝直達網址
          const directUrl = `${webAppBase || 'https://script.google.com/macros/s/...'}` +
            `?mode=stocktake` +
            `&cell=${encodeURIComponent(cellCode)}` +
            `&shelf=${encodeURIComponent(shelfName)}` +
            `&box=${encodeURIComponent(boxName)}` +
            `&space=${encodeURIComponent(fullSpaceDisplay)}`;

          const qrFormula = `=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=1&data=" & ENCODEURL("${directUrl}"))`;

          labelRows.push([
            qrFormula,            // A: QR Code 圖片
            shortCode,            // B: 標籤短碼 (B1-S1)
            siteName,             // C: 據點 (大安覺風)
            floorAndSpace || locId, // D: 樓層與空間 (地下1樓 小教室)
            zoneName,             // E: 分區名稱 (書架藏書區)
            boxName,              // F: 櫃位名稱 (第1櫃(左一開放架))
            shelfName,            // G: 實體層格名稱 (第1櫃-第1層(上))
            defaultItem,          // H: 常態預設物資 (佛學期刊)
            cellCode,             // I: 儲位全碼 (DA-004-Z01#B1-S1)
            directUrl             // J: 盤點直達網址
          ]);
        }
      }
    } catch (err) {
      Logger.log(`解析第 ${i + 1} 列 (${zoneName}) JSON 失敗: ${err.message}`);
    }
  }

  if (labelRows.length === 0) {
    Logger.log("未解析到任何層格資料！");
    return;
  }

  // 3. 建立或重置工作表
  let targetSheet = ss.getSheetByName("SHELF_QR_LABELS");
  if (targetSheet) {
    targetSheet.clear();
  } else {
    targetSheet = ss.insertSheet("SHELF_QR_LABELS");
  }

  // 4. 設定標題列
  const headers = [
    "QR Code 二維碼", 
    "標籤短碼", 
    "據點",
    "樓層與空間", 
    "分區名稱", 
    "櫃位名稱", 
    "實體層格名稱", 
    "常態預設物資", 
    "儲位格位全碼", 
    "盤點直達網址"
  ];
  targetSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 5. 批次寫入資料
  targetSheet.getRange(2, 1, labelRows.length, headers.length).setValues(labelRows);

  // 6. 視覺與排版設定
  targetSheet.setFrozenRows(1);
  targetSheet.getRange(1, 1, 1, headers.length)
    .setBackground("#166534")
    .setFontColor("#FFFFFF")
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  targetSheet.setRowHeights(2, labelRows.length, 90);

  targetSheet.setColumnWidth(1, 95);   // QR Code
  targetSheet.setColumnWidth(2, 85);   // 標籤短碼
  targetSheet.setColumnWidth(3, 100);  // 據點
  targetSheet.setColumnWidth(4, 130);  // 樓層與空間
  targetSheet.setColumnWidth(5, 110);  // 分區名稱
  targetSheet.setColumnWidth(6, 140);  // 櫃位名稱
  targetSheet.setColumnWidth(7, 150);  // 實體層格
  targetSheet.setColumnWidth(8, 170);  // 常態預設物資
  targetSheet.setColumnWidth(9, 160);  // 儲位格位全碼
  targetSheet.setColumnWidth(10, 120); // 盤點直達網址

  targetSheet.getRange(2, 1, labelRows.length, 3)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");

  targetSheet.getRange(2, 2, labelRows.length, 1)
    .setFontSize(14)
    .setFontWeight("bold")
    .setFontColor("#15803D");

  targetSheet.getRange(2, 4, labelRows.length, headers.length - 3)
    .setVerticalAlignment("middle")
    .setWrap(true);

  Logger.log(`🎉 成功生成 ${labelRows.length} 筆包含【據點】的標籤資料！`);
}