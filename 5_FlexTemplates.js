/**
 * 模組 5：LINE Flex Message 視覺圖卡樣板 (5_FlexTemplates.js)
 */

function replyTextMessage(replyToken, text) {
  sendToLine({ replyToken: replyToken, messages: [{ type: 'text', text: text }] });
}

/**
 * 🌟 零庫存前置建檔導引卡片
 */
function replyFlexInboundPromptCard(replyToken, userName) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "📷 零庫存前置建檔", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": `${userName} 您好，請點擊下方開啟相機：`, "size": "sm", "color": "#047857", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "text",
          "text": "此功能專用於【新物資前置建檔】。\n拍照後由 AI 辨識品名、作者與條碼，自動存入物資主檔 (SKU_MASTER)，不涉及任何儲位與庫存數量。",
          "size": "sm",
          "color": "#374151",
          "wrap": true
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
          "margin": "lg",
          "action": {
            "type": "uri",
            "label": "📸 開啟拍照建檔網頁",
            "uri": WEB_APP_URL
          }
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
            "label": "🚪 結束 (回主選單)",
            "text": CMD_EXIT_STOCKTAKE
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "📷 零庫存前置拍照建檔",
      "contents": flexContents
    }]
  });
}

function replyFlexManualCard(replyToken, userName) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "📖 覺風物資盤點操作指南", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": `${userName} 您好，三步驟輕鬆完成盤點：`, "size": "sm", "color": "#047857", "margin": "xs" }
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
          "borderWidth": "1px",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "第 1 步：定位所在格位", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "點選 據點 ➔ 樓層 ➔ 空間 ➔ 櫃子 ➔ 具體層格。", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F0FDF4",
          "borderColor": "#16A34A",
          "borderWidth": "1px",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "第 2 步：搜尋物資名稱", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "在對話框直接打入【書名或用品名稱】進行即時比對。", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F0FDF4",
          "borderColor": "#16A34A",
          "borderWidth": "1px",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "第 3 步：輸入實清數量", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "輸入眼前看到的實際數量（如：5），系統即刻更新該格位庫存！", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
          ]
        },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#FFFBEB",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": "💡 貼心小提醒：", "weight": "bold", "size": "sm", "color": "#B45309" },
            { "type": "text", "text": "• 若有全新物資尚未建檔，請點選「📷 拍照入庫」建立主檔。\n• 任何步驟皆可按「↩️ 返回」或「🚪 結束盤點」。", "size": "xs", "color": "#92400E", "margin": "xs", "wrap": true }
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
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
          "action": {
            "type": "message",
            "label": "📷 立即開始盤點",
            "text": "開始盤點"
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "📖 覺風物資盤點操作指南",
      "contents": flexContents
    }]
  });
}

function replyExitStocktakeWithImage(replyToken, userName) {
  sendToLine({
    replyToken: replyToken,
    messages: [
      {
        "type": "image",
        "originalContentUrl": FINISH_IMG_URL,
        "previewImageUrl": FINISH_IMG_URL
      },
      {
        "type": "text",
        "text": `🙏 ${userName} 您好，已為您安全結束本次作業。\n\n感謝您的發心付出！如需繼續盤點或建檔，請點擊下方圖文選單。`
      }
    ]
  });
}

function replyFlexMenuCard(replyToken, title, subtitle, items, backBtnLabel = null) {
  const buttonRows = items.map(item => ({
    "type": "box",
    "layout": "vertical",
    "backgroundColor": "#F0FDF4",
    "borderColor": "#16A34A",
    "borderWidth": "1px",
    "cornerRadius": "lg",
    "paddingAll": "lg",
    "margin": "md",
    "action": {
      "type": "message",
      "label": item.title.length > 20 ? item.title.substring(0, 17) + "..." : item.title,
      "text": item.value
    },
    "contents": [
      {
        "type": "text",
        "text": item.title,
        "weight": "bold",
        "size": "lg",
        "color": "#15803D",
        "wrap": true
      },
      {
        "type": "text",
        "text": item.desc || "點擊選取",
        "size": "sm",
        "color": "#4B5563",
        "wrap": true,
        "margin": "xs"
      }
    ]
  }));

  const footerButtons = [];

  if (backBtnLabel) {
    footerButtons.push({
      "type": "button",
      "style": "secondary",
      "height": "md",
      "action": {
        "type": "message",
        "label": backBtnLabel,
        "text": backBtnLabel
      }
    });
  }

  footerButtons.push({
    "type": "button",
    "style": "secondary",
    "height": "md",
    "margin": backBtnLabel ? "sm" : "none",
    "action": {
      "type": "message",
      "label": "🚪 結束盤點 (回主選單)",
      "text": CMD_EXIT_STOCKTAKE
    }
  });

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
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": footerButtons
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": title,
      "contents": flexContents
    }]
  });
}

function replyFlexSearchPromptCard(replyToken, spaceName, boxName, shelfName, cellCode, isRetry = false) {
  const currentBoxLabel = boxName || "同櫃子";
  const cleanBoxName = currentBoxLabel.includes('-') ? currentBoxLabel.split('-')[1].split('(')[0] : (currentBoxLabel.split('(')[0] || "同櫃");
  const headerTitle = isRetry ? "🔍 重新搜尋物資" : "📍 已定位盤點格位";
  const promptText = isRetry ? "🔍 請在下方對話框輸入新的【物品名稱】或關鍵字：" : "🔍 請在下方對話框輸入【物品名稱】進行比對：";
  
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F0FDF4",
      "contents": [
        { "type": "text", "text": headerTitle, "weight": "bold", "size": "xl", "color": "#15803D" },
        { "type": "text", "text": "請在對話框直接打字搜尋", "size": "xs", "color": "#4B5563", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F9FAFB",
          "borderColor": "#16A34A",
          "borderWidth": "1px",
          "cornerRadius": "md",
          "paddingAll": "md",
          "contents": [
            { "type": "text", "text": `🏢 ${spaceName} ｜ ${boxName}`, "size": "sm", "color": "#4B5563", "wrap": true },
            { "type": "text", "text": `📍 ${shelfName}`, "weight": "bold", "size": "lg", "color": "#15803D", "margin": "xs", "wrap": true },
            { "type": "text", "text": `格位代碼：${cellCode}`, "size": "xs", "color": "#9CA3AF", "margin": "sm" }
          ]
        },
        {
          "type": "text",
          "text": promptText,
          "size": "sm",
          "weight": "bold",
          "color": "#374151",
          "margin": "lg",
          "wrap": true
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
            "label": `↩️ 返回 [${cleanBoxName} 清單]`,
            "text": `↩️ 返回 [${cleanBoxName} 清單]`
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🚪 結束盤點 (回主選單)",
            "text": CMD_EXIT_STOCKTAKE
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": headerTitle,
      "contents": flexContents
    }]
  });
}

function replyFlexPostStocktakeCard(replyToken, userName, fullChineseLocation, cellCode, itemName, qty, boxName) {
  const currentBoxLabel = boxName ? (boxName.includes('-') ? boxName.split('-')[1].split('(')[0] : boxName.split('(')[0]) : "同櫃子";
  
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "✅ 盤點紀錄更新成功！", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": `經手人員：${userName}`, "size": "sm", "color": "#047857", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F9FAFB",
          "paddingAll": "md",
          "cornerRadius": "md",
          "contents": [
            { "type": "text", "text": `📍 位置：${fullChineseLocation}`, "weight": "bold", "size": "sm", "color": "#374151", "wrap": true },
            { "type": "text", "text": `代碼：${cellCode}`, "size": "xs", "color": "#9CA3AF", "margin": "xs" },
            { "type": "text", "text": `📦 物品：${itemName}`, "size": "md", "weight": "bold", "color": "#111827", "margin": "sm" },
            { "type": "text", "text": `🔢 實清數量：${qty} 本/套`, "size": "sm", "color": "#059669", "margin": "xs" }
          ]
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#F59E0B",
          "height": "md",
          "margin": "md",
          "action": {
            "type": "message",
            "label": "✏️ 剛才打錯了？立即更正",
            "text": CMD_START_CORRECTION
          }
        },
        { "type": "separator", "margin": "lg" },
        { "type": "text", "text": "下一步您想要：", "weight": "bold", "size": "md", "color": "#111827", "margin": "lg" },
        
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
          "margin": "md",
          "action": {
            "type": "message",
            "label": "📦 同格位盤點下一件物品",
            "text": CMD_NEXT_SKU_SAME_CELL
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#2563EB",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": `🚪 盤點 [${currentBoxLabel}] 其他層格`,
            "text": CMD_CHANGE_SHELF_SAME_BOX
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#0D9488",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🗄️ 盤點此空間其他櫃位",
            "text": CMD_CHANGE_BOX_SAME_ROOM
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🏛️ 更換其他據點/空間",
            "text": CMD_CHANGE_SITE
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🚪 結束盤點 (回主選單)",
            "text": CMD_EXIT_STOCKTAKE
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "✅ 盤點更新成功，請選擇下一步",
      "contents": flexContents
    }]
  });
}

function replyFlexCorrectionMenu(replyToken, currentItemName, currentQty) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FFFBEB",
      "contents": [
        { "type": "text", "text": "✏️ 盤點紀錄即時更正", "weight": "bold", "size": "xl", "color": "#B45309" },
        { "type": "text", "text": "請選擇您要修正的項目：", "size": "sm", "color": "#92400E", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F9FAFB",
          "paddingAll": "md",
          "cornerRadius": "md",
          "contents": [
            { "type": "text", "text": `當前物品：${currentItemName}`, "weight": "bold", "size": "sm", "color": "#374151" },
            { "type": "text", "text": `當前數量：${currentQty} 本/套`, "size": "sm", "color": "#059669", "margin": "xs" }
          ]
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
          "margin": "md",
          "action": {
            "type": "message",
            "label": "📝 修改物品名稱 (打錯字)",
            "text": CMD_CORRECT_NAME
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#2563EB",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🔢 更正實清數量 (算錯本數)",
            "text": CMD_CORRECT_QTY
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#DC2626",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🗑️ 刪除剛才這筆紀錄",
            "text": CMD_DELETE_LAST_LOG
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "✏️ 盤點紀錄即時更正",
      "contents": flexContents
    }]
  });
}

function replyCorrectionSuccessWithMonk(replyToken, userName, fullChineseLocation, cellCode, itemName, qty, boxName, customTip) {
  const currentBoxLabel = boxName ? (boxName.includes('-') ? boxName.split('-')[1].split('(')[0] : boxName.split('(')[0]) : "同櫃子";
  
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "✅ 紀錄已成功更正！", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "size": "sm", "color": "#047857", "margin": "xs", "text": `經手人員：${userName}` }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F9FAFB",
          "paddingAll": "md",
          "cornerRadius": "md",
          "contents": [
            { "type": "text", "text": `📍 位置：${fullChineseLocation}`, "weight": "bold", "size": "sm", "color": "#374151", "wrap": true },
            { "type": "text", "text": `代碼：${cellCode}`, "size": "xs", "color": "#9CA3AF", "margin": "xs" },
            { "type": "text", "text": `📦 物品：${itemName}`, "size": "md", "weight": "bold", "color": "#111827", "margin": "sm" },
            { "type": "text", "text": `🔢 實清數量：${qty} 本/套`, "size": "sm", "color": "#059669", "margin": "xs" }
          ]
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#F59E0B",
          "height": "md",
          "margin": "md",
          "action": {
            "type": "message",
            "label": "✏️ 剛才打錯了？立即更正",
            "text": CMD_START_CORRECTION
          }
        },
        { "type": "separator", "margin": "lg" },
        { "type": "text", "text": "下一步您想要：", "weight": "bold", "size": "md", "color": "#111827", "margin": "lg" },
        
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
          "margin": "md",
          "action": {
            "type": "message",
            "label": "📦 同格位盤點下一件物品",
            "text": CMD_NEXT_SKU_SAME_CELL
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#2563EB",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": `🚪 盤點 [${currentBoxLabel}] 其他層格`,
            "text": CMD_CHANGE_SHELF_SAME_BOX
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#0D9488",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🗄️ 盤點此空間其他櫃位",
            "text": CMD_CHANGE_BOX_SAME_ROOM
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🏛️ 更換其他據點/空間",
            "text": CMD_CHANGE_SITE
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🚪 結束盤點 (回主選單)",
            "text": CMD_EXIT_STOCKTAKE
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [
      {
        "type": "image",
        "originalContentUrl": MONK_IMG_URL,
        "previewImageUrl": MONK_IMG_URL
      },
      {
        "type": "text",
        "text": `🙏 ${customTip}\n\n下次盤點要再多加小心確認喔～😊`
      },
      {
        "type": "flex",
        "altText": "✅ 紀錄已成功更正",
        "contents": flexContents
      }
    ]
  });
}

/**
 * 🌟 搜尋多筆物資直列清單：動態呈現封面與 ISBN，無資料自動隱藏
 */
function replyFlexSkuVerticalList(replyToken, skus) {
  const skuRows = skus.map(s => {
    const skuId = s['品項編號'] ? s['品項編號'].toString().trim() : "未知";
    const itemName = s['物品名稱'] ? s['物品名稱'].toString().trim() : "未知名稱";
    const cateName = (s['大類名稱'] || s['大類'] || "一般物資").toString().trim();
    const barcode = (s['條碼編號'] || s['ISBN/條碼'] || "").toString().trim();
    let rawImgUrl = (s['封面圖片URL'] || s['圖片網址'] || "").toString().trim();

    // 🌟 將 Google Drive 轉向網址轉換為 LINE 相容性最高的 CDN 直連格式
    if (rawImgUrl.includes("drive.google.com")) {
      const match = rawImgUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        rawImgUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    // 1. 組裝右側文字內容
    const infoContents = [
      {
        "type": "text",
        "text": `📁 ${cateName}`,
        "weight": "bold",
        "size": "xs",
        "color": "#6B7280"
      },
      {
        "type": "text",
        "text": itemName,
        "weight": "bold",
        "size": "md",
        "color": "#111827",
        "wrap": true,
        "margin": "xs"
      },
      {
        "type": "text",
        "text": `編號: ${skuId}`,
        "size": "xs",
        "color": "#9CA3AF",
        "margin": "xs"
      }
    ];

    // 條碼條件渲染
    if (barcode) {
      infoContents.push({
        "type": "box",
        "layout": "baseline",
        "margin": "xs",
        "contents": [
          {
            "type": "text",
            "text": `🏷️ ISBN: ${barcode}`,
            "size": "xxs",
            "color": "#0284C7",
            "wrap": true
          }
        ]
      });
    }

    // 2. 封面圖條件渲染
    let topSection;
    if (rawImgUrl && (rawImgUrl.startsWith("http://") || rawImgUrl.startsWith("https://"))) {
      topSection = {
        "type": "box",
        "layout": "horizontal",
        "spacing": "md",
        "contents": [
          {
            "type": "image",
            "url": rawImgUrl,
            "size": "72px",
            "aspectRatio": "3:4",
            "aspectMode": "cover",
            "cornerRadius": "md",
            "flex": 0
          },
          {
            "type": "box",
            "layout": "vertical",
            "flex": 1,
            "contents": infoContents
          }
        ]
      };
    } else {
      topSection = {
        "type": "box",
        "layout": "vertical",
        "contents": infoContents
      };
    }

    return {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FFFFFF",
      "borderColor": "#16A34A",
      "borderWidth": "1px",
      "cornerRadius": "lg",
      "paddingAll": "md",
      "margin": "md",
      "contents": [
        topSection,
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "sm",
          "margin": "md",
          "action": {
            "type": "message",
            "label": "👉 盤點此件",
            "text": skuId
          }
        }
      ]
    };
  });

  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FAFAFA",
      "contents": [
        { "type": "text", "text": "📦 找到多筆物資", "weight": "bold", "size": "xl", "color": "#111827" },
        { "type": "text", "text": "請由上往下瀏覽，點擊您要盤點的物品：", "size": "sm", "color": "#4B5563", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": skuRows
    },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "xs",
          "action": {
            "type": "message",
            "label": "🔍 重新搜尋關鍵字",
            "text": CMD_RETRY_SEARCH_SKU
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "xs",
          "action": {
            "type": "message",
            "label": "🚪 結束盤點 (回主選單)",
            "text": CMD_EXIT_STOCKTAKE
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{
      "type": "flex",
      "altText": "📦 找到多筆物資資料",
      "contents": flexContents
    }]
  });
}

/**
 * 發送訊息至 LINE（含詳細錯誤排查日誌）
 */
function sendToLine(payload) {
  const url = 'https://api.line.me/v2/bot/message/reply';
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${LINE_ACCESS_TOKEN}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    if (code !== 200) {
      writeDebugLog(`[LINE API 錯誤 ${code}]: ${res.getContentText()}`);
    }
  } catch (err) {
    writeDebugLog(`[LINE fetch 例外]: ${err.message}`);
  }
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