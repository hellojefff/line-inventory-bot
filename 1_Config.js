/**
 * 模組 1：全域設定與系統常數 (1_Config.js)
 * 說明：採用結構化命名空間，同時保留全域別名以確保相容現有 Controller 與 FlexTemplates。
 */

// ==================== 1. 環境變數讀取與核心配置 ====================
const scriptProperties = PropertiesService.getScriptProperties();

const CONFIG = {
  SPREADSHEET_ID: scriptProperties.getProperty('SPREADSHEET_ID') || '13J32Ewv0PVL8o6hEoJUCuK2Ur5pBEnHO90tdG7XxtC8',
  LINE_ACCESS_TOKEN: scriptProperties.getProperty('LINE_ACCESS_TOKEN'),
  GEMINI_API_KEY: scriptProperties.getProperty('GEMINI_API_KEY'),
  INBOUND_IMG_FOLDER_ID: scriptProperties.getProperty('INBOUND_IMG_FOLDER_ID'),
  WEB_APP_URL: scriptProperties.getProperty('WEB_APP_URL')
};

// ==================== 2. 視覺與圖示資源配置 ====================
const UI = {
  BTN_BACK_PREFIX: '↩️ 返回',
  MONK_IMG_URL: 'https://raw.githubusercontent.com/hellojefff/line-inventory-bot/main/assets/monk_stocktake.png',
  FINISH_IMG_URL: 'https://raw.githubusercontent.com/hellojefff/line-inventory-bot/main/assets/finish.png'
};

// ==================== 3. 系統控制指令常數 ====================
const CMD = {
  TRIGGER_PHOTO_INBOUND: 'CMD_TRIGGER_PHOTO_INBOUND',
  NEXT_SKU_SAME_CELL: 'CMD_NEXT_SKU_SAME_CELL',
  CHANGE_SHELF_SAME_BOX: 'CMD_CHANGE_SHELF_SAME_BOX',
  CHANGE_BOX_SAME_ROOM: 'CMD_CHANGE_BOX_SAME_ROOM',
  CHANGE_SITE: 'CMD_CHANGE_SITE',
  RETRY_SEARCH_SKU: 'CMD_RETRY_SEARCH_SKU',
  EXIT_STOCKTAKE: 'CMD_EXIT_STOCKTAKE',
  START_CORRECTION: 'CMD_START_CORRECTION',
  CORRECT_NAME: 'CMD_CORRECT_NAME',
  CORRECT_QTY: 'CMD_CORRECT_QTY',
  DELETE_LAST_LOG: 'CMD_DELETE_LAST_LOG'
};

// ==================== 4. 盤點流程狀態常數 ====================
const STATE = {
  BINDING_NAME: 'STATE_BINDING_NAME',
  BINDING_PHONE: 'STATE_BINDING_PHONE',
  CHOOSE_SITE: 'STATE_CHOOSE_SITE',
  CHOOSE_FLOOR: 'STATE_CHOOSE_FLOOR',
  CHOOSE_LOC: 'STATE_CHOOSE_LOC',
  CHOOSE_ZONE: 'STATE_CHOOSE_ZONE',
  CHOOSE_BOX: 'STATE_CHOOSE_BOX',
  CHOOSE_CELL: 'STATE_CHOOSE_CELL',
  INPUT_SKU: 'STATE_INPUT_SKU',
  INPUT_QTY: 'STATE_INPUT_QTY',
  CORRECT_ITEM_NAME: 'STATE_CORRECT_ITEM_NAME',
  CORRECT_QTY: 'STATE_CORRECT_QTY',
  POST_STOCKTAKE: 'STATE_POST_STOCKTAKE'
};

// ==================== 5. 向後相容全域匯出 (相容 3_Controllers 與 5_FlexTemplates) ====================
const SPREADSHEET_ID = CONFIG.SPREADSHEET_ID;
const LINE_ACCESS_TOKEN = CONFIG.LINE_ACCESS_TOKEN;
const GEMINI_API_KEY = CONFIG.GEMINI_API_KEY;
const INBOUND_IMG_FOLDER_ID = CONFIG.INBOUND_IMG_FOLDER_ID;
const WEB_APP_URL = CONFIG.WEB_APP_URL;

const BTN_BACK_PREFIX = UI.BTN_BACK_PREFIX;
const MONK_IMG_URL = UI.MONK_IMG_URL;
const FINISH_IMG_URL = UI.FINISH_IMG_URL;

const CMD_TRIGGER_PHOTO_INBOUND = CMD.TRIGGER_PHOTO_INBOUND;
const CMD_NEXT_SKU_SAME_CELL = CMD.NEXT_SKU_SAME_CELL;
const CMD_CHANGE_SHELF_SAME_BOX = CMD.CHANGE_SHELF_SAME_BOX;
const CMD_CHANGE_BOX_SAME_ROOM = CMD.CHANGE_BOX_SAME_ROOM;
const CMD_CHANGE_SITE = CMD.CHANGE_SITE;
const CMD_RETRY_SEARCH_SKU = CMD.RETRY_SEARCH_SKU;
const CMD_EXIT_STOCKTAKE = CMD.EXIT_STOCKTAKE;
const CMD_START_CORRECTION = CMD.START_CORRECTION;
const CMD_CORRECT_NAME = CMD.CORRECT_NAME;
const CMD_CORRECT_QTY = CMD.CORRECT_QTY;
const CMD_DELETE_LAST_LOG = CMD.DELETE_LAST_LOG;