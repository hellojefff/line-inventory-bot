/**
 * 模組 5：LINE Flex Message 視覺圖卡樣板 (5_FlexTemplates.js)
 */

function replyTextMessage(replyToken, text) {
  sendToLine({ replyToken: replyToken, messages: [{ type: 'text', text: text }] });
}

// 📸 拍照入庫拍照提示卡片
function replyFlexInboundPromptCard(replyToken, originContext) {
  let subText = "請點選下方相機圖示，拍攝物品正面封面或標籤：";
  let locationTip = null;

  if (originContext && originContext.isFromStocktake) {
    locationTip = {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "borderColor": "#10B981",
      "borderWidth": "1px",
      "cornerRadius": "md",
      "paddingAll": "md",
      "margin": "sm",
      "contents": [
        { "type": "text", "text": "📍 正在接續盤點儲位：", "size": "xs", "color": "#065F46", "weight": "bold" },
        { "type": "text", "text": `${originContext.spaceName} ｜ ${originContext.boxName} (${originContext.shelfName})`, "size": "sm", "color": "#047857", "weight": "bold", "wrap": true }
      ]
    };
  }

  const bodyContents = [
    { "type": "text", "text": "📸 物資拍照前置入庫", "weight": "bold", "size": "xl", "color": "#065F46" },
    { "type": "text", "text": subText, "size": "sm", "color": "#374151", "margin": "sm", "wrap": true }
  ];

  if (locationTip) {
    bodyContents.push(locationTip);
  }

  bodyContents.push({
    "type": "box",
    "layout": "vertical",
    "backgroundColor": "#F3F4F6",
    "cornerRadius": "md",
    "paddingAll": "md",
    "margin": "md",
    "contents": [
      { "type": "text", "text": "💡 拍照小撇步：", "weight": "bold", "size": "xs", "color": "#4B5563" },
      { "type": "text", "text": "• 鏡頭保持水平對準封面文字\n• 避免反光，字體越清晰辨識越準確", "size": "xs", "color": "#6B7280", "margin": "xs", "wrap": true }
    ]
  });

  const flexContents = {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": bodyContents
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
            "label": "↩️ 返回",
            "text": "↩️ 返回"
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
    messages: [{ type: "flex", altText: "📸 請拍攝物資照片進行入庫", contents: flexContents }]
  });
}

// 🤖 AI 辨識確認卡片 (大字 + 縮圖核對)
function replyFlexAiInboundCard(replyToken, itemName, category, isbn, imageUrl) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F0FDF4",
      "contents": [
        { "type": "text", "text": "✨ AI 封面辨識完成", "weight": "bold", "size": "lg", "color": "#15803D" },
        { "type": "text", "text": "請核對下方辨識結果是否正確：", "size": "xs", "color": "#4B5563", "margin": "xs" }
      ]
    },
    "hero": {
      "type": "image",
      "url": imageUrl || MONK_IMG_URL,
      "size": "full",
      "aspectRatio": "4:3",
      "aspectMode": "cover"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": `📁 分類：${category}`, "size": "xs", "color": "#6B7280", "weight": "bold" },
        { "type": "text", "text": itemName, "weight": "bold", "size": "xl", "color": "#111827", "wrap": true, "margin": "xs" },
        isbn ? { "type": "text", "text": `條碼/ISBN：${isbn}`, "size": "xs", "color": "#9CA3AF", "margin": "xs" } : { "type": "box", "layout": "vertical", "contents": [] }
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
            "label": "✅ 確認正確，立即入庫",
            "text": CMD_CONFIRM_AI_INBOUND
          }
        },
        {
          "type": "button",
          "style": "primary",
          "color": "#F59E0B",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "✏️ 名稱有誤，手動修正",
            "text": CMD_EDIT_AI_INBOUND
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🔄 拍得不清楚，重新拍照",
            "text": CMD_RETAKE_PHOTO_INBOUND
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{ type: "flex", altText: `✨ 辨識確認：${itemName}`, contents: flexContents }]
  });
}

// ⚠️ AI 辨識無法辨識時的降級卡片
function replyFlexAiFailureCard(replyToken, imageUrl) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FFFBEB",
      "contents": [
        { "type": "text", "text": "⚠️ 封面辨識未完成", "weight": "bold", "size": "lg", "color": "#B45309" },
        { "type": "text", "text": "光線或角度影響無法自動讀取字體", "size": "xs", "color": "#92400E", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "照片已安全為您存入雲端，請直接手動輸入完整書名/品項規格完成入庫：", "size": "sm", "color": "#374151", "wrap": true }
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
            "label": "✏️ 手動輸入完整品名",
            "text": CMD_EDIT_AI_INBOUND
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "🔄 重新拍照",
            "text": CMD_RETAKE_PHOTO_INBOUND
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{ type: "flex", altText: "⚠️ 封面辨識未完成，請手動輸入", contents: flexContents }]
  });
}

// 🎉 獨立前置入庫完成卡片
function replyFlexInboundSuccessCard(replyToken, itemName, skuId, cateName, imageUrl) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "🎉 物資入庫建檔完成！", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": "零庫存前置建立成功，盤點時即可點選", "size": "xs", "color": "#047857", "margin": "xs" }
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
            { "type": "text", "text": `📁 分類：${cateName}`, "size": "xs", "color": "#6B7280" },
            { "type": "text", "text": itemName, "size": "lg", "weight": "bold", "color": "#111827", "wrap": true, "margin": "xs" },
            { "type": "text", "text": `品項編號：${skuId}`, "size": "xs", "color": "#9CA3AF", "margin": "sm" }
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
            "label": "📸 繼續拍照入庫下一件",
            "text": CMD_TRIGGER_PHOTO_INBOUND
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
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
    messages: [{ type: "flex", altText: "🎉 物資入庫建檔完成！", contents: flexContents }]
  });
}

// 📦 盤點搜尋查無品項時的專屬卡片 (阻斷手打，引導拍照)
function replyFlexNoSkuPromptPhotoCard(replyToken, inputKeyword) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FFFBEB",
      "contents": [
        { "type": "text", "text": "🔍 查無此在庫物資", "weight": "bold", "size": "xl", "color": "#B45309" },
        { "type": "text", "text": "盤點作業僅允許點選在庫品項", "size": "xs", "color": "#92400E", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "您搜尋的關鍵字：", "size": "sm", "color": "#6B7280" },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F3F4F6",
          "paddingAll": "md",
          "cornerRadius": "md",
          "margin": "sm",
          "contents": [
            { "type": "text", "text": `【${inputKeyword}】`, "weight": "bold", "size": "md", "color": "#111827", "wrap": true }
          ]
        },
        { "type": "text", "text": "請拍照入庫建檔，系統將於建檔完成後自動帶您回到目前格位填寫數量：", "size": "xs", "color": "#4B5563", "margin": "md", "wrap": true }
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
            "label": "📸 立即拍照入庫建檔",
            "text": CMD_TRIGGER_PHOTO_INBOUND
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
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
    messages: [{ type: "flex", altText: "🔍 查無在庫物資，請拍照入庫", contents: flexContents }]
  });
}

// 既有選單與盤點回覆樣板維持完備
function replyFlexManualCard(replyToken, userName) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "📖 覺風物資盤點操作指南", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": `${userName} 您好，三步驟輕鬆完成作業：`, "size": "sm", "color": "#047857", "margin": "xs" }
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
            { "type": "text", "text": "步驟 1：前置入庫 (隨時可做)", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "點選「📸 拍照入庫」，拍下書籍或物資封面，AI 自動辨識品名，確認即可零庫存建檔。", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
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
            { "type": "text", "text": "步驟 2：現場定位層格", "weight": "bold", "size": "md", "color": "#15803D" },
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
            { "type": "text", "text": "步驟 3：核對物資並填寫數量", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "搜尋在庫物資並輸入實清數量。若無可選品項，點擊按鈕直接拍照入庫，系統會自動帶您回到此格位！", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
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
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "📸 進行物資拍照入庫",
            "text": "拍照入庫"
          }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{ "type": "flex", "altText": "📖 覺風物資盤點操作指南", "contents": flexContents }]
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
        "text": `🙏 ${userName} 您好，已為您安全結束本次作業。\n\n感謝您的發心付出！如需再次作業，請隨時點選下方選單。`
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
      { "type": "text", "text": item.title, "weight": "bold", "size": "lg", "color": "#15803D", "wrap": true },
      { "type": "text", "text": item.desc || "點擊選取", "size": "sm", "color": "#4B5563", "wrap": true, "margin": "xs" }
    ]
  }));

  const footerButtons = [];
  if (backBtnLabel) {
    footerButtons.push({
      "type": "button",
      "style": "secondary",
      "height": "md",
      "action": { "type": "message", "label": backBtnLabel, "text": backBtnLabel }
    });
  }

  footerButtons.push({
    "type": "button",
    "style": "secondary",
    "height": "md",
    "margin": backBtnLabel ? "sm" : "none",
    "action": { "type": "message", "label": "🚪 結束盤點 (回主選單)", "text": CMD_EXIT_STOCKTAKE }
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
    "body": { "type": "box", "layout": "vertical", "contents": buttonRows },
    "footer": { "type": "box", "layout": "vertical", "contents": footerButtons }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{ "type": "flex", "altText": title, "contents": flexContents }]
  });
}

function replyFlexSearchPromptCard(replyToken, spaceName, boxName, shelfName, cellCode, isRetry = false) {
  const currentBoxLabel = boxName || "同櫃子";
  const cleanBoxName = currentBoxLabel.includes('-') ? currentBoxLabel.split('-')[1].split('(')[0] : (currentBoxLabel.split('(')[0] || "同櫃");
  const headerTitle = isRetry ? "🔍 重新搜尋在庫物資" : "📍 已定位盤點格位";
  const promptText = isRetry ? "🔍 請在對話框輸入在庫【物品名稱】或關鍵字：" : "🔍 請在下方對話框輸入【物品名稱】進行搜尋：";
  
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F0FDF4",
      "contents": [
        { "type": "text", "text": headerTitle, "weight": "bold", "size": "xl", "color": "#15803D" },
        { "type": "text", "text": "請輸入在庫物品關鍵字，或使用下方按鈕導航", "size": "xs", "color": "#4B5563", "margin": "xs" }
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
    messages: [{ "type": "flex", "altText": headerTitle, "contents": flexContents }]
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
    messages: [{ "type": "flex", "altText": "✅ 盤點更新成功，請選擇下一步", "contents": flexContents }]
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
    messages: [{ "type": "flex", "altText": "✏️ 盤點紀錄即時更正", "contents": flexContents }]
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

function replyFlexSkuVerticalList(replyToken, skus) {
  const skuRows = skus.map(s => {
    const skuId = s['品項編號'] ? s['品項編號'].toString() : "未知";
    const itemName = s['物品名稱'] ? s['物品名稱'].toString() : "未知名稱";
    const cateName = s['大類'] ? s['大類'].toString() : "一般物資";

    return {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F9FAFB",
      "borderColor": "#16A34A",
      "borderWidth": "1px",
      "cornerRadius": "lg",
      "paddingAll": "lg",
      "margin": "md",
      "contents": [
        { "type": "text", "text": `📁 ${cateName}`, "weight": "bold", "size": "sm", "color": "#6B7280" },
        { "type": "text", "text": itemName, "weight": "bold", "size": "lg", "color": "#111827", "wrap": true, "margin": "xs" },
        { "type": "text", "text": `編號: ${skuId}`, "size": "sm", "color": "#9CA3AF", "margin": "xs" },
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
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
    "body": { "type": "box", "layout": "vertical", "contents": skuRows },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "style": "primary",
          "color": "#0D9488",
          "height": "md",
          "margin": "xs",
          "action": {
            "type": "message",
            "label": "📸 都不是，拍照入庫新品項",
            "text": CMD_TRIGGER_PHOTO_INBOUND
          }
        },
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
    messages: [{ "type": "flex", "altText": "📦 找到多筆物資資料", "contents": flexContents }]
  });
}

function replyFlexSkuCard(replyToken, itemName, skuId, cateName, userKeyword) {
  const flexContents = {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "📦 已尋獲在庫物資", "weight": "bold", "color": "#16A34A", "size": "md" },
        { "type": "text", "text": itemName, "weight": "bold", "size": "xl", "margin": "sm", "wrap": true },
        { "type": "text", "text": `品項編號：${skuId}\n物資大類：${cateName}`, "color": "#4B5563", "size": "md", "margin": "md", "wrap": true }
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
            "label": "👌 確認是此物品",
            "text": skuId
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
            "label": "📸 不是這項，拍照入庫新品項",
            "text": CMD_TRIGGER_PHOTO_INBOUND
          }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "sm",
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
    messages: [{ "type": "flex", "altText": "📦 找到物資資料，請確認", "contents": flexContents }]
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