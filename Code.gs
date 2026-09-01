const APP_VERSION = '0.1.0';
const SHEET_NAME = '回答データ';
const PROPERTY_SPREADSHEET_ID = 'SURVEY_SPREADSHEET_ID';

const ROLES = [
  'リノベーション事業者・工務店・施工会社',
  'メーカー',
  '建材店・商社・流通',
  '設計・デザイン',
  'その他'
];

const CATEGORIES = [
  '顧客との相談・ヒアリング',
  '見積・価格判断',
  '設計・仕様決定',
  '商品・技術情報を探す',
  '発注・納期確認',
  '工程・現場管理',
  '社内情報・過去案件を探す',
  '問い合わせ対応'
];

/**
 * 初回セットアップ。
 * 回答保存用スプレッドシートを自動作成し、Script Properties にIDを保存する。
 * Apps Script エディタから最初に1回だけ実行する。
 */
function setup() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(PROPERTY_SPREADSHEET_ID);

  if (existingId) {
    try {
      const existing = SpreadsheetApp.openById(existingId);
      initializeResponseSheet_(existing);
      return {
        spreadsheetId: existing.getId(),
        spreadsheetUrl: existing.getUrl(),
        reused: true
      };
    } catch (error) {
      // 既存IDが無効な場合は新規作成へ進む
    }
  }

  const spreadsheet = SpreadsheetApp.create(
    'リノベ業界AI課題アンケート_回答データ'
  );

  properties.setProperty(
    PROPERTY_SPREADSHEET_ID,
    spreadsheet.getId()
  );

  initializeResponseSheet_(spreadsheet);

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    reused: false
  };
}

function doGet(e) {
  const mode = e && e.parameter ? e.parameter.mode : '';
  const fileName = mode === 'dashboard' ? 'Dashboard' : 'Index';
  const title = mode === 'dashboard'
    ? 'リアルタイム集計｜リノベ業界 × AI'
    : '30秒｜リノベ業界 × AI';

  const template = HtmlService.createTemplateFromFile(fileName);
  template.appVersion = APP_VERSION;

  return template
    .evaluate()
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * 参加者の回答を保存する。
 */
function submitResponse(data) {
  validateResponse_(data);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getResponseSheet_();

    const roles = normalizeArray_(data.roles);
    const dependent = normalizeArray_(data.dependent);
    const repetitive = normalizeArray_(data.repetitive);

    sheet.appendRow([
      new Date(),
      sanitizeText_(data.company, 100),
      sanitizeText_(data.name, 100),
      roles.join(' / '),
      dependent.join(' / '),
      repetitive.join(' / '),
      sanitizeText_(data.aiChoice, 100),
      APP_VERSION
    ]);

    return {
      success: true,
      totalResponses: Math.max(0, sheet.getLastRow() - 1)
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ダッシュボード用の集計データを返す。
 * 回答者名・会社名は返さない。
 */
function getDashboardData() {
  const sheet = getResponseSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return createEmptyDashboardData_();
  }

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  const result = {
    total: values.length,
    roles: createCounter_(ROLES),
    dependent: createCounter_(CATEGORIES),
    repetitive: createCounter_(CATEGORIES),
    aiChoice: createCounter_(CATEGORIES),
    roleBreakdown: {}
  };

  ROLES.forEach(role => {
    result.roleBreakdown[role] = {
      respondents: 0,
      dependent: createCounter_(CATEGORIES),
      repetitive: createCounter_(CATEGORIES),
      aiChoice: createCounter_(CATEGORIES)
    };
  });

  values.forEach(row => {
    const roles = splitStoredValues_(row[3]);
    const dependent = splitStoredValues_(row[4]);
    const repetitive = splitStoredValues_(row[5]);
    const aiChoice = String(row[6] || '').trim();

    incrementItems_(result.roles, roles);
    incrementItems_(result.dependent, dependent);
    incrementItems_(result.repetitive, repetitive);

    if (Object.prototype.hasOwnProperty.call(result.aiChoice, aiChoice)) {
      result.aiChoice[aiChoice] += 1;
    }

    roles.forEach(role => {
      const bucket = result.roleBreakdown[role];
      if (!bucket) return;

      bucket.respondents += 1;
      incrementItems_(bucket.dependent, dependent);
      incrementItems_(bucket.repetitive, repetitive);

      if (Object.prototype.hasOwnProperty.call(bucket.aiChoice, aiChoice)) {
        bucket.aiChoice[aiChoice] += 1;
      }
    });
  });

  result.topDependent = getTopItems_(result.dependent, 3);
  result.topRepetitive = getTopItems_(result.repetitive, 3);
  result.topAi = getTopItems_(result.aiChoice, 3);

  result.overlap = CATEGORIES.map(category => ({
    category,
    dependent: result.dependent[category],
    repetitive: result.repetitive[category],
    ai: result.aiChoice[category],
    score:
      result.dependent[category] +
      result.repetitive[category] +
      result.aiChoice[category]
  })).sort((a, b) => b.score - a.score);

  return result;
}

/**
 * 管理用。保存先スプレッドシートのURLを確認する。
 */
function getSpreadsheetInfo() {
  const spreadsheet = getSpreadsheet_();
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function getSpreadsheet_() {
  const id = PropertiesService
    .getScriptProperties()
    .getProperty(PROPERTY_SPREADSHEET_ID);

  if (!id) {
    throw new Error(
      '初期設定が未完了です。Apps Scriptエディタで setup() を1回実行してください。'
    );
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (error) {
    throw new Error(
      '回答保存用スプレッドシートを開けません。setup() を再実行してください。'
    );
  }
}

function getResponseSheet_() {
  const spreadsheet = getSpreadsheet_();
  initializeResponseSheet_(spreadsheet);
  return spreadsheet.getSheetByName(SHEET_NAME);
}

function initializeResponseSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    const firstSheet = spreadsheet.getSheets()[0];

    if (
      spreadsheet.getSheets().length === 1 &&
      firstSheet.getLastRow() === 0
    ) {
      sheet = firstSheet;
      sheet.setName(SHEET_NAME);
    } else {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }
  }

  const headers = [
    '回答日時',
    '会社名',
    '名前',
    '立場',
    '属人化している仕事',
    '繰り返している仕事',
    'AIで楽にしたい仕事',
    'アプリバージョン'
  ];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

    [160, 180, 130, 300, 320, 320, 280, 120]
      .forEach((width, index) => sheet.setColumnWidth(index + 1, width));
  }
}

function validateResponse_(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('回答データがありません。');
  }

  const company = sanitizeText_(data.company, 100);
  const name = sanitizeText_(data.name, 100);
  const roles = normalizeArray_(data.roles);
  const dependent = normalizeArray_(data.dependent);
  const repetitive = normalizeArray_(data.repetitive);
  const aiChoice = sanitizeText_(data.aiChoice, 100);

  if (!company) throw new Error('会社名を入力してください。');
  if (!name) throw new Error('お名前を入力してください。');

  if (roles.length < 1) {
    throw new Error('普段の立場を1つ以上選んでください。');
  }

  if (dependent.length < 1 || dependent.length > 2) {
    throw new Error('属人化している仕事を1〜2つ選んでください。');
  }

  if (repetitive.length < 1 || repetitive.length > 2) {
    throw new Error('繰り返している仕事を1〜2つ選んでください。');
  }

  if (!aiChoice) {
    throw new Error('AIで楽にしたい仕事を1つ選んでください。');
  }

  if (roles.some(role => !ROLES.includes(role))) {
    throw new Error('立場の回答に不正な値があります。');
  }

  if (dependent.some(item => !CATEGORIES.includes(item))) {
    throw new Error('属人化の回答に不正な値があります。');
  }

  if (repetitive.some(item => !CATEGORIES.includes(item))) {
    throw new Error('繰り返しの回答に不正な値があります。');
  }

  if (!CATEGORIES.includes(aiChoice)) {
    throw new Error('AIで楽にしたい仕事の回答に不正な値があります。');
  }
}

function sanitizeText_(value, maxLength) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, maxLength || 100);
}

function normalizeArray_(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item || '').trim()).filter(Boolean))];
}

function splitStoredValues_(value) {
  if (!value) return [];
  return String(value)
    .split(' / ')
    .map(item => item.trim())
    .filter(Boolean);
}

function createCounter_(items) {
  return items.reduce((counter, item) => {
    counter[item] = 0;
    return counter;
  }, {});
}

function incrementItems_(counter, items) {
  items.forEach(item => {
    if (Object.prototype.hasOwnProperty.call(counter, item)) {
      counter[item] += 1;
    }
  });
}

function getTopItems_(counter, limit) {
  return Object.entries(counter)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function createEmptyDashboardData_() {
  return {
    total: 0,
    roles: createCounter_(ROLES),
    dependent: createCounter_(CATEGORIES),
    repetitive: createCounter_(CATEGORIES),
    aiChoice: createCounter_(CATEGORIES),
    roleBreakdown: {},
    topDependent: [],
    topRepetitive: [],
    topAi: [],
    overlap: []
  };
}
