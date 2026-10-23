/**
 * 模組 5：LINE Flex Message 視覺圖卡樣板 (5_FlexTemplates.js)
 */

function replyTextMessage(replyToken, text) {
  sendToLine({ replyToken: replyToken, messages: [{ type: 'text', text: text }] });
}

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
          "text": "此功能專用於【新物資前置建檔】。\n支援「封面外觀 + 版權頁」雙照比對，自動提取標準書名與 ISBN 存入主檔。",
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
            { "type": "text", "text": "第 2 步：拍照或搜尋物資", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "點擊綠色大按鈕直接拍照，一次拍多本並點擊數量完成！", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
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
            { "type": "text", "text": "第 3 步：一鍵完成入庫", "weight": "bold", "size": "md", "color": "#15803D" },
            { "type": "text", "text": "點擊送出即可自動寫入庫存，無需逐筆打字！", "size": "sm", "color": "#4B5563", "margin": "xs", "wrap": true }
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

function replyFlexSearchPromptCard(replyToken, spaceName, boxName, shelfName, cellCode, isRetry = false, webAppStocktakeUrl = null) {
  const currentBoxLabel = boxName || "同櫃子";
  const cleanBoxName = currentBoxLabel.includes('-') ? currentBoxLabel.split('-')[1].split('(')[0] : (currentBoxLabel.split('(')[0] || "同櫃");
  const headerTitle = isRetry ? "🔍 重新搜尋物資" : "📍 已定位盤點格位";

  const bodyContents = [
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
    }
  ];

  if (webAppStocktakeUrl) {
    bodyContents.push({
      "type": "button",
      "style": "primary",
      "color": "#16A34A",
      "height": "md",
      "margin": "lg",
      "action": {
        "type": "uri",
        "label": "📸 拍照盤點 (支援一圖多本)",
        "uri": webAppStocktakeUrl
      }
    });
    bodyContents.push({
      "type": "text",
      "text": "✨ 點擊拍照自動辨識物資，免手動打字！",
      "size": "xxs",
      "color": "#047857",
      "align": "center",
      "margin": "xs"
    });
    bodyContents.push({ "type": "separator", "margin": "md" });
  }

  bodyContents.push({
    "type": "text",
    "text": isRetry ? "🔍 或在下方對話框輸入【物品名稱】打字搜尋：" : "🔍 或直接在下方對話框打字搜尋物資：",
    "size": "xs",
    "color": "#6B7280",
    "margin": "md",
    "wrap": true
  });

  const flexContents = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#F0FDF4",
      "contents": [
        { "type": "text", "text": headerTitle, "weight": "bold", "size": "xl", "color": "#15803D" },
        { "type": "text", "text": "請選擇拍照盤點或打字比對", "size": "xs", "color": "#4B5563", "margin": "xs" }
      ]
    },
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

function replyFlexSkuVerticalList(replyToken, skus) {
  const skuRows = skus.map(s => {
    const skuId = (s['品項編號'] || s['sku_id'] || s['SKU_ID'] || "未知").toString().trim();
    const itemName = (s['物品名稱'] || s['品名'] || s['name'] || "未知名稱").toString().trim();
    const cateName = (s['大類名稱'] || s['大類'] || s['category'] || "一般物資").toString().trim();
    const author = (s['規格或作者'] || s['規格/作者'] || s['作者'] || s['規格'] || s['author'] || "").toString().trim();
    const barcode = (s['條碼編號'] || s['ISBN/條碼'] || s['barcode'] || "").toString().trim();
    
    // 🌟 圖片降級策略：優先讀取封面，若無封面則回退顯示內頁/版權頁
    let rawImgUrl = (s['封面圖片URL'] || s['圖片網址'] || s['內頁圖片URL'] || s['版權頁圖片URL'] || "").toString().trim();

    let thumbUrl = rawImgUrl;
    let fullImgUrl = rawImgUrl;
    if (rawImgUrl.includes("drive.google.com")) {
      const match = rawImgUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        thumbUrl = `https://lh3.googleusercontent.com/d/${match[1]}=w240`;
        fullImgUrl = `https://lh3.googleusercontent.com/d/${match[1]}=w1200`;
      }
    }

    const infoContents = [
      { "type": "text", "text": `📁 ${cateName}`, "weight": "bold", "size": "xs", "color": "#6B7280" },
      { "type": "text", "text": itemName, "weight": "bold", "size": "md", "color": "#111827", "wrap": true, "margin": "xs" }
    ];

    if (author) {
      infoContents.push({ "type": "text", "text": `✍️ 作者: ${author}`, "size": "xs", "color": "#4B5563", "wrap": true, "margin": "xs" });
    }
    infoContents.push({ "type": "text", "text": `編號: ${skuId}`, "size": "xs", "color": "#9CA3AF", "margin": "xs" });

    if (barcode) {
      infoContents.push({
        "type": "box",
        "layout": "baseline",
        "margin": "xs",
        "contents": [{ "type": "text", "text": `🏷️ ISBN: ${barcode}`, "size": "xxs", "color": "#0284C7", "wrap": true }]
      });
    }

    let topSection;
    if (thumbUrl && (thumbUrl.startsWith("http://") || thumbUrl.startsWith("https://"))) {
      topSection = {
        "type": "box",
        "layout": "horizontal",
        "spacing": "md",
        "contents": [
          {
            "type": "box",
            "layout": "vertical",
            "cornerRadius": "md",
            "flex": 0,
            "action": { "type": "uri", "label": "查看大圖", "uri": fullImgUrl },
            "contents": [{ "type": "image", "url": thumbUrl, "size": "72px", "aspectRatio": "3:4", "aspectMode": "cover" }]
          },
          { "type": "box", "layout": "vertical", "flex": 1, "contents": infoContents }
        ]
      };
    } else {
      topSection = { "type": "box", "layout": "vertical", "contents": infoContents };
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
          "action": { "type": "message", "label": "👉 盤點此件", "text": skuId }
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
        { "type": "text", "text": "點擊左圖可放大封面，確認後點擊盤點：", "size": "sm", "color": "#4B5563", "margin": "xs" }
      ]
    },
    "body": { "type": "box", "layout": "vertical", "contents": skuRows },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "xs",
          "action": { "type": "message", "label": "🔍 重新搜尋關鍵字", "text": CMD_RETRY_SEARCH_SKU }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "md",
          "margin": "xs",
          "action": { "type": "message", "label": "🚪 結束盤點 (回主選單)", "text": CMD_EXIT_STOCKTAKE }
        }
      ]
    }
  };

  sendToLine({
    replyToken: replyToken,
    messages: [{ "type": "flex", "altText": "📦 找到多筆物資資料", "contents": flexContents }]
  });
}

function replyFlexConfirmSingleSkuCard(replyToken, targetSku, userName) {
  const skuId = (targetSku['品項編號'] || targetSku['sku_id'] || targetSku['SKU_ID'] || "未知").toString().trim();
  const itemName = (targetSku['物品名稱'] || targetSku['品名'] || targetSku['name'] || "未知名稱").toString().trim();
  const cateName = (targetSku['大類名稱'] || targetSku['大類'] || targetSku['category'] || "一般物資").toString().trim();
  const author = (targetSku['規格或作者'] || targetSku['規格/作者'] || targetSku['作者'] || targetSku['規格'] || targetSku['author'] || "").toString().trim();
  const barcode = (targetSku['條碼編號'] || targetSku['ISBN/條碼'] || targetSku['barcode'] || "").toString().trim();
  
  // 🌟 圖片降級策略
  let rawImgUrl = (targetSku['封面圖片URL'] || targetSku['圖片網址'] || targetSku['內頁圖片URL'] || targetSku['版權頁圖片URL'] || "").toString().trim();

  let fullImgUrl = rawImgUrl;
  if (rawImgUrl.includes("drive.google.com")) {
    const match = rawImgUrl.match(/id=([a-zA-Z0-9_-]+)/) || rawImgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) fullImgUrl = `https://lh3.googleusercontent.com/d/${match[1]}=w1000`;
  }

  let heroSection = undefined;
  if (fullImgUrl && (fullImgUrl.startsWith("http://") || fullImgUrl.startsWith("https://"))) {
    heroSection = {
      "type": "image",
      "url": fullImgUrl,
      "size": "full",
      "aspectRatio": "3:4",
      "aspectMode": "cover",
      "action": { "type": "uri", "label": "查看封面大圖", "uri": fullImgUrl }
    };
  }

  const bodyContents = [
    { "type": "text", "text": `📁 ${cateName}`, "weight": "bold", "size": "xs", "color": "#6B7280" },
    { "type": "text", "text": itemName, "weight": "bold", "size": "xl", "color": "#111827", "wrap": true, "margin": "xs" }
  ];

  if (author) {
    bodyContents.push({ "type": "text", "text": `✍️ 作者: ${author}`, "size": "sm", "color": "#4B5563", "wrap": true, "margin": "xs" });
  }

  bodyContents.push({ "type": "text", "text": `編號: ${skuId}`, "size": "xs", "color": "#9CA3AF", "margin": "xs" });

  if (barcode) {
    bodyContents.push({
      "type": "box",
      "layout": "baseline",
      "margin": "xs",
      "contents": [{ "type": "text", "text": `🏷️ ISBN: ${barcode}`, "size": "xs", "color": "#0284C7", "wrap": true }]
    });
  }

  bodyContents.push({ "type": "separator", "margin": "lg" });
  bodyContents.push({
    "type": "box",
    "layout": "vertical",
    "backgroundColor": "#FEF3C7",
    "borderColor": "#F59E0B",
    "borderWidth": "1px",
    "cornerRadius": "md",
    "paddingAll": "md",
    "margin": "md",
    "contents": [
      { "type": "text", "text": "🔢 請在下方輸入【實清數量】：", "weight": "bold", "size": "sm", "color": "#92400E" },
      { "type": "text", "text": "請直接回覆眼前看到的數字（例如：5 或 10）", "size": "xs", "color": "#B45309", "margin": "xs" }
    ]
  });

  bodyContents.push({
    "type": "box",
    "layout": "horizontal",
    "spacing": "xs",
    "margin": "sm",
    "contents": [1, 2, 3, 5, 10].map(n => ({
      "type": "button",
      "style": "secondary",
      "height": "sm",
      "action": { "type": "message", "label": `${n}`, "text": `${n}` }
    }))
  });

  const bubble = {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#ECFDF5",
      "contents": [
        { "type": "text", "text": "🎯 已確認盤點物品", "weight": "bold", "size": "xl", "color": "#065F46" },
        { "type": "text", "text": `${userName} 您好，請核對物資並填寫數量：`, "size": "sm", "color": "#047857", "margin": "xs" }
      ]
    },
    "body": { "type": "box", "layout": "vertical", "contents": bodyContents },
    "footer": {
      "type": "box",
      "layout": "vertical",
      "spacing": "sm",
      "contents": [
        {
          "type": "button",
          "style": "secondary",
          "height": "sm",
          "action": { "type": "message", "label": "🔍 物品不對？重新搜尋", "text": CMD_RETRY_SEARCH_SKU }
        },
        {
          "type": "button",
          "style": "secondary",
          "height": "sm",
          "action": { "type": "message", "label": "🚪 結束盤點", "text": CMD_EXIT_STOCKTAKE }
        }
      ]
    }
  };

  if (heroSection) bubble.hero = heroSection;

  sendToLine({
    replyToken: replyToken,
    messages: [{ "type": "flex", "altText": `🎯 已鎖定物品：${itemName}`, "contents": bubble }]
  });
}

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
    if (res.getResponseCode() !== 200) {
      writeDebugLog(`[LINE API 錯誤 ${res.getResponseCode()}]: ${res.getContentText()}`);
    }
  } catch (err) {
    writeDebugLog(`[LINE fetch 例外]: ${err.message}`);
  }
}