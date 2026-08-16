/**
 * 模組 5：LINE Flex Message 視覺圖卡樣板 (5_FlexTemplates.js)
 */

function replyTextMessage(replyToken, text) {
  sendToLine({ replyToken: replyToken, messages: [{ type: 'text', text: text }] });
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
            { "type": "text", "text": "第 2 步：搜尋或建立物品", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "在對話框直接打入【書名或用品名稱】進行比對。若為全新物品，點擊按鈕即可一鍵建檔。", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
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
            { "type": "text", "text": "• 若打錯字或數量，點擊「✏️ 立即更正」可隨時修改。\n• 任何步驟皆可按「↩️ 返回」或「🚪 結束盤點」。", "size": "xs", "color": "#92400E", "margin": "xs", "wrap": true }
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
        "text": `🙏 ${userName} 您好，已為您安全結束本次盤點作業。\n\n感謝您的發心付出！如需再次盤點，請隨時點選下方「📷 開始盤點」。`
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

  if (backBtnLabel) {
    flexContents.footer = {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "action": {
            "type": "message",
            "label": backBtnLabel,
            "text": backBtnLabel
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

function replyFlexSearchPromptCard(replyToken, spaceName, boxName, shelfName, cellCode, isRetry = false) {
  const currentBoxLabel = boxName || "同櫃子";
  const cleanBoxName = currentBoxLabel.includes('-') ? currentBoxLabel.split('-')[1].split('(')[0] : (currentBoxLabel.split('(')[0] || "同櫃");
  const headerTitle = isRetry ? "🔍 重新搜尋物資" : "📍 已定位盤點格位";
  const promptText = isRetry ? "🔍 請在下方對話框輸入新的【物品名稱】或關鍵字：" : "🔍 請在下方對話框輸入【物品名稱】進行搜尋或建檔：";
  
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F0FDF4",
      "contents": [
        { "type": "text", "text": headerTitle, "weight": "bold", "size": "xl", "color": "#15803D" },
        { "type": "text", "text": "請在對話框直接打字，或使用下方按鈕導航", "size": "xs", "color": "#4B5563", "margin": "xs" }
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

function replyFlexCreateSkuCard(replyToken, inputKeyword) {
  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#FFFBEB",
      "contents": [
        { "type": "text", "text": "🔍 查無此品項", "weight": "bold", "size": "xl", "color": "#B45309" },
        { "type": "text", "text": "系統主檔中尚未建檔此物資", "size": "sm", "color": "#92400E", "margin": "xs" }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "您剛才搜尋的關鍵字：", "size": "sm", "color": "#6B7280" },
        {
          "type": "box",
          "layout": "vertical",
          "backgroundColor": "#F3F4F6",
          "paddingAll": "md",
          "cornerRadius": "md",
          "margin": "sm",
          "contents": [
            { "type": "text", "text": `【${inputKeyword}】`, "weight": "bold", "size": "lg", "color": "#111827", "wrap": true }
          ]
        },
        { "type": "text", "text": "請選擇建檔方式：", "weight": "bold", "size": "md", "color": "#111827", "margin": "md" },
        
        {
          "type": "button",
          "style": "primary",
          "color": "#16A34A",
          "height": "md",
          "margin": "sm",
          "action": {
            "type": "message",
            "label": "✏️ 自訂輸入完整品名規格",
            "text": CMD_INPUT_DETAILED_SKU
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
            "label": `⚡ 直接以「${inputKeyword.length > 6 ? inputKeyword.substring(0, 5) + "..." : inputKeyword}」建檔`,
            "text": CMD_CREATE_SKU_CONFIRM
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
    messages: [{
      "type": "flex",
      "altText": "🔍 查無品項，請選擇建檔方式",
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
        {
          "type": "text",
          "text": `📁 ${cateName}`,
          "weight": "bold",
          "size": "sm",
          "color": "#6B7280"
        },
        {
          "type": "text",
          "text": itemName,
          "weight": "bold",
          "size": "lg",
          "color": "#111827",
          "wrap": true,
          "margin": "xs"
        },
        {
          "type": "text",
          "text": `編號: ${skuId}`,
          "size": "sm",
          "color": "#9CA3AF",
          "margin": "xs"
        },
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
          "style": "primary",
          "color": "#0D9488",
          "height": "md",
          "margin": "xs",
          "action": {
            "type": "message",
            "label": "➕ 都不是，建立新品項",
            "text": CMD_INPUT_DETAILED_SKU
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
    messages: [{
      "type": "flex",
      "altText": "📦 找到多筆物資資料",
      "contents": flexContents
    }]
  });
}

function replyFlexSkuCard(replyToken, itemName, skuId, cateName, userKeyword) {
  const flexContents = {
    "type": "bubble",
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "📦 已尋獲盤點物資", "weight": "bold", "color": "#16A34A", "size": "md" },
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
            "label": "➕ 不是這項，建立新品項",
            "text": CMD_INPUT_DETAILED_SKU
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
    messages: [{
      "type": "flex",
      "altText": "📦 找到物資資料，請確認",
      "contents": flexContents
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