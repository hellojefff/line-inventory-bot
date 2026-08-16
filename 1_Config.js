/**
 * 模組 1：全域設定與系統常數 (1_Config.js)
 */

// ==================== 全局配置 ====================
const SPREADSHEET_ID = '13J32Ewv0PVL8o6hEoJUCuK2Ur5pBEnHO90tdG7XxtC8'; 
const LINE_ACCESS_TOKEN = 'fstqDcGULaFwMfSL2jm1cTFgCo8Qewut0IeKvyHAwfsaL0Qd869L00YFJiHnpU7J1+oNistrv81ZAI4CrV8QeMJl3BXmm13ZEOHDqOoviFCVW17H3ObQdKFAJS54sGGA/4IFoLQUwh41EDRN36bg+wdB04t89/1O/w1cDnyilFU='; 
const BTN_BACK_PREFIX = '↩️ 返回';

// 🌟 GitHub Raw 圖片直連網址配置
const MONK_IMG_URL = 'https://raw.githubusercontent.com/hellojefff/line-inventory-bot/main/assets/monk_stocktake.png'; 
const FINISH_IMG_URL = 'https://raw.githubusercontent.com/hellojefff/line-inventory-bot/main/assets/finish.png'; 

// 系統核心控制指令常數
const CMD_NEXT_SKU_SAME_CELL = 'CMD_NEXT_SKU_SAME_CELL';
const CMD_CHANGE_SHELF_SAME_BOX = 'CMD_CHANGE_SHELF_SAME_BOX';
const CMD_CHANGE_BOX_SAME_ROOM = 'CMD_CHANGE_BOX_SAME_ROOM';
const CMD_CHANGE_SITE = 'CMD_CHANGE_SITE';
const CMD_CREATE_SKU_CONFIRM = 'CMD_CREATE_SKU_CONFIRM';
const CMD_INPUT_DETAILED_SKU = 'CMD_INPUT_DETAILED_SKU';
const CMD_RETRY_SEARCH_SKU = 'CMD_RETRY_SEARCH_SKU';
const CMD_EXIT_STOCKTAKE = 'CMD_EXIT_STOCKTAKE';

// 補救更正指令常數
const CMD_START_CORRECTION = 'CMD_START_CORRECTION';
const CMD_CORRECT_NAME = 'CMD_CORRECT_NAME';
const CMD_CORRECT_QTY = 'CMD_CORRECT_QTY';
const CMD_DELETE_LAST_LOG = 'CMD_DELETE_LAST_LOG';