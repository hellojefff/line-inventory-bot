/**
 * 高速優化版：嚴格鎖定「大類代碼 H」且「有內頁圖片URL」且「缺三欄資料」的書籍，進行 AI 提取與批次回填
 */
function backfillBookMetadataFromImages() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("SKU_MASTER");
  if (!sheet) return;

  const dataRange = sheet.getDataRange();
  const data = dataRange.getValues();
  if (data.length <= 1) return;

  const colMap = getSheetColumnIndexes(data[0]);

  const skuIdx = colMap['品項編號'];
  const cateCodeIdx = colMap['大類代碼'];
  const nameIdx = colMap['物品名稱'];
  const innerIdx = colMap['內頁圖片URL'] !== undefined ? colMap['內頁圖片URL'] : colMap['版權頁圖片URL'];

  const publisherIdx = colMap['出版社'];
  const editionIdx = colMap['版次與年份'];
  const priceIdx = colMap['定價'];

  if (publisherIdx === undefined || editionIdx === undefined || priceIdx === undefined) {
    Logger.log("❌ SKU_MASTER 缺少 出版社 / 版次與年份 / 定價 欄位");
    return;
  }

  if (innerIdx === undefined) {
    Logger.log("❌ SKU_MASTER 缺少 內頁圖片URL 欄位");
    return;
  }

  // ==================== 1. 第一階段：快速在記憶體篩選待處理清單 ====================
  const pendingTasks = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const skuId = row[skuIdx] ? row[skuIdx].toString().trim() : "";
    const cateCode = cateCodeIdx !== undefined && row[cateCodeIdx] ? row[cateCodeIdx].toString().trim().toUpperCase() : "";

    // 檢查 1：🌟 嚴格只處理「大類代碼 === 'H'」
    if (cateCode !== "H") continue;

    // 檢查 2：三個欄位是否已經填妥？若皆有值則立刻跳過
    const hasPublisher = !!row[publisherIdx];
    const hasEdition = !!row[editionIdx];
    const hasPrice = !!row[priceIdx];
    if (hasPublisher && hasEdition && hasPrice) continue;

    // 檢查 3：🌟 嚴格要求必須有「內頁圖片URL」，無內頁/版權頁照片者直接跳過
    const innerImgUrl = row[innerIdx] ? row[innerIdx].toString().trim() : "";
    if (!innerImgUrl) continue;

    const match = innerImgUrl.match(/id=([a-zA-Z0-9_-]+)/) || innerImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (!match) continue;

    pendingTasks.push({
      rowIndex: i,
      rowNumber: i + 1,
      skuId: skuId,
      name: row[nameIdx] ? row[nameIdx].toString().trim() : "",
      fileId: match[1],
      hasPublisher: hasPublisher,
      hasEdition: hasEdition,
      hasPrice: hasPrice
    });
  }

  Logger.log(`⚡ 預先檢查完成！全表共 ${data.length - 1} 筆，符合「大類代碼 H 且有內頁照片且缺資料」的書籍共 ${pendingTasks.length} 筆。`);
  if (pendingTasks.length === 0) {
    Logger.log("🎉 沒有需要補齊的書籍（大類 H 的資料皆已完整，或尚未上傳過內頁版權頁照片）！");
    return;
  }

  // ==================== 2. 第二階段：僅針對符合條件的內頁調用 AI ====================
  let updatedCount = 0;

  for (const task of pendingTasks) {
    try {
      const file = DriveApp.getFileById(task.fileId);
      const blob = file.getBlob();
      const base64Data = Utilities.base64Encode(blob.getBytes());
      const mimeType = blob.getContentType();

      const meta = extractMetaFromCipImage(base64Data, mimeType);

      let changed = false;
      if (!task.hasPublisher && meta.publisher) {
        data[task.rowIndex][publisherIdx] = meta.publisher;
        changed = true;
      }
      if (!task.hasEdition && meta.edition) {
        data[task.rowIndex][editionIdx] = meta.edition;
        changed = true;
      }
      if (!task.hasPrice && meta.price) {
        data[task.rowIndex][priceIdx] = meta.price;
        changed = true;
      }

      if (changed) {
        Logger.log(`[成功提取] 第 ${task.rowNumber} 列: ${task.name} (${task.skuId}) ➔ 出版社: ${meta.publisher || '無'} | 版次: ${meta.edition || '無'} | 定價: ${meta.price || '無'}`);
        updatedCount++;
      }

      Utilities.sleep(500); // 頻率保護
    } catch (err) {
      Logger.log(`處理第 ${task.rowNumber} 列 (${task.name}) 錯誤: ${err.message}`);
    }
  }

  // ==================== 3. 第三階段：極速批次一次性寫回試算表 ====================
  if (updatedCount > 0) {
    dataRange.setValues(data);
    Logger.log(`💾 批次寫入完畢！共成功更新 ${updatedCount} 筆書籍資料。`);
  } else {
    Logger.log(`執行完成，本次未更新任何欄位。`);
  }
}

/**
 * 輔助函式：調用 Gemini 提取出版社、版次、定價
 */
function extractMetaFromCipImage(base64Data, mimeType) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const prompt = `請觀察這張書籍版權頁（CIP）或封底照片，擷取以下三個資訊：
1. 出版社（出版者或發行機構名稱，例如「藝術家出版社」）。
2. 版次與年份（版次與印刷出版年月，例如「2014年3月 二版」或「2003年 初版」）。
3. 定價（新台幣定價數字，例如「380」）。
若照片中完全找不到某個欄位，請填入空字串。
只回傳標準 JSON 格式：
{"publisher": "出版社名稱", "edition": "版次與年份", "price": "定價"}`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || "image/jpeg", data: base64Data } }
      ]
    }],
    generationConfig: { responseMimeType: "application/json" }
  };

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
        return JSON.parse(raw);
      }
    }
  } catch (e) {}

  return { publisher: "", edition: "", price: "" };
}