const APP_VERSION = '0.4.0';
const SHEET_NAME = '回答データ';
const PROPERTY_SPREADSHEET_ID = 'SURVEY_SPREADSHEET_ID';
const SPREADSHEET_NAME = 'リノベ業界タイプ診断_回答データ';
const DEFAULT_EVENT_ID = 'general';

const ROLES = {
  reno: 'リノベ・施工・設計',
  maker: 'メーカー',
  sales: '販売・流通'
};

const PURPOSE = {
  deal: '商談・仕事につながる相手を見つけたい',
  info: '新しい商品・技術・事例を仕入れたい',
  people: '人脈を広げたい・久しぶりの人に会いたい',
  trend: '業界の動きや他社の話を聞きたい',
  fun: 'なんとなく面白そうだった',
  sent: '会社・上司に行ってこいと言われた',
  none: '特に目的はない。来てから考える'
};

const EXCITE = {
  win: '案件や提案が決まった',
  discover: 'いい商品・技術を見つけた',
  solve: '難しい問題を解決した',
  happy: 'お客さんに喜ばれた',
  connect: '新しい人とつながった'
};

const GROWTH = {
  sales: '営業・受注',
  proposal: '提案力',
  knowledge: '商品・技術知識',
  network: '人脈・協業',
  system: '業務効率・仕組み化'
};

const OFFER = {
  job: '案件・仕事',
  product: '商品・技術情報',
  price: '価格・調達力',
  knowhow: '施工・設計ノウハウ',
  intro: '人や会社の紹介'
};

const TYPES = {
  hunter: {
    name: 'ゴリゴリ開拓タイプ',
    emoji: '🔥',
    copy: 'チャンスを見つけたら前へ。商談・受注・次の一手をつくる行動派。',
    hint: '交流会では「今どんな案件を探してます？」から入ると強い。'
  },
  scout: {
    name: '新商品ハンタータイプ',
    emoji: '🔍',
    copy: '新しい商品・技術・事例を集めて、使える形に変える探索派。',
    hint: 'メーカー担当者に「最近いちばん面白い商品は？」と聞いてみよう。'
  },
  connector: {
    name: 'つなぐ人タイプ',
    emoji: '🤝',
    copy: '人と人、会社と会社をつなぐことで価値をつくるネットワーカー。',
    hint: '「誰か紹介できそうな人いません？」が今日の魔法の言葉。'
  },
  strategist: {
    name: '現場の軍師タイプ',
    emoji: '🧠',
    copy: '情報を整理して、最適な組み合わせや判断をつくる分析・提案派。',
    hint: '違う立場の人に「その判断、何を基準にしてます？」と聞くと面白い。'
  },
  solver: {
    name: '解決屋タイプ',
    emoji: '🛠️',
    copy: '困りごとを見ると放っておけない。現場の詰まりをほどく実務派。',
    hint: '「最近いちばん困った現場って何でした？」から話すと盛り上がる。'
  },
  observer: {
    name: '様子見スカウトタイプ',
    emoji: '👀',
    copy: '最初から決め打ちせず、場を見て面白いものを拾う観察派。',
    hint: 'せっかく来たので、今日は一人だけ「予想外に面白い人」を見つけて帰ろう。'
  }
};

function setup() {
  const properties = PropertiesService.getScriptProperties();
  const existingId = properties.getProperty(PROPERTY_SPREADSHEET_ID);

  if (existingId) {
    try {
      const existing = SpreadsheetApp.openById(existingId);
      initializeResponseSheet_(existing);
      return { spreadsheetId: existing.getId(), spreadsheetUrl: existing.getUrl(), reused: true };
    } catch (error) {}
  }

  const spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
  properties.setProperty(PROPERTY_SPREADSHEET_ID, spreadsheet.getId());
  initializeResponseSheet_(spreadsheet);
  return { spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl(), reused: false };
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const mode = params.mode || '';
  const eventId = normalizeEventId_(params.event || (mode === 'dashboard' ? '' : DEFAULT_EVENT_ID));
  const fileName = mode === 'dashboard' ? 'Dashboard' : 'Index';
  const title = mode === 'dashboard' ? '会場全体のリアルタイム集計' : '1分｜リノベ業界タイプ診断';
  const template = HtmlService.createTemplateFromFile(fileName);
  template.appVersion = APP_VERSION;
  template.eventId = eventId;
  template.eventInfo = getEventInfo_(eventId);
  return template.evaluate()
    .setTitle(title)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function submitResponse(data) {
  validateResponse_(data);
  const eventId = normalizeEventId_(data.eventId || DEFAULT_EVENT_ID);
  const eventInfo = getEventInfo_(eventId);
  const typeKey = diagnoseType_(data);
  const type = TYPES[typeKey];
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getResponseSheet_();
    sheet.appendRow([
      new Date(),
      sanitizeText_(data.company, 100),
      sanitizeText_(data.name, 100),
      data.role,
      ROLES[data.role],
      data.purpose,
      PURPOSE[data.purpose],
      data.excite,
      EXCITE[data.excite],
      data.growth,
      GROWTH[data.growth],
      data.offer,
      OFFER[data.offer],
      typeKey,
      type.name,
      APP_VERSION,
      eventInfo.id,
      eventInfo.location,
      eventInfo.date,
      eventInfo.session
    ]);

    return {
      success: true,
      totalResponses: countEventResponses_(sheet, eventId),
      typeKey,
      type,
      event: eventInfo
    };
  } finally {
    lock.releaseLock();
  }
}

function getDashboardData(eventId) {
  const normalizedEventId = normalizeEventId_(eventId || '');
  const sheet = getResponseSheet_();
  const lastRow = sheet.getLastRow();
  const result = createEmptyDashboardData_(normalizedEventId);
  if (lastRow <= 1) return result;

  const rows = sheet.getRange(2, 1, lastRow - 1, 20).getValues();
  const filteredRows = normalizedEventId ? rows.filter(row => String(row[16] || '') === normalizedEventId) : rows;
  result.total = filteredRows.length;

  filteredRows.forEach(row => {
    const role = String(row[3] || '');
    const purpose = String(row[5] || '');
    const growth = String(row[9] || '');
    const offer = String(row[11] || '');
    const typeKey = String(row[13] || '');

    increment_(result.typeCounts, typeKey);
    increment_(result.roleCounts, role);
    increment_(result.purposeCounts, purpose);
    increment_(result.growthCounts, growth);
    increment_(result.offerCounts, offer);

    if (result.roleBreakdown[role]) {
      result.roleBreakdown[role].count += 1;
      increment_(result.roleBreakdown[role].types, typeKey);
      increment_(result.roleBreakdown[role].purposes, purpose);
      increment_(result.roleBreakdown[role].growths, growth);
      increment_(result.roleBreakdown[role].offers, offer);
    }
  });

  result.typeRanking = ranking_(result.typeCounts, TYPES, result.total, 6);
  result.purposeRanking = ranking_(result.purposeCounts, PURPOSE, result.total, 5);
  result.growthRanking = ranking_(result.growthCounts, GROWTH, result.total, 5);
  result.offerRanking = ranking_(result.offerCounts, OFFER, result.total, 5);

  Object.keys(result.roleBreakdown).forEach(role => {
    const bucket = result.roleBreakdown[role];
    bucket.typeRanking = ranking_(bucket.types, TYPES, bucket.count, 3);
    bucket.purposeRanking = ranking_(bucket.purposes, PURPOSE, bucket.count, 3);
    bucket.growthRanking = ranking_(bucket.growths, GROWTH, bucket.count, 3);
  });

  return result;
}

function getSpreadsheetInfo() {
  const spreadsheet = getSpreadsheet_();
  return { spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl() };
}

function diagnoseType_(data) {
  const score = { hunter: 0, scout: 0, connector: 0, strategist: 0, solver: 0, observer: 0 };

  if (data.purpose === 'deal') score.hunter += 3;
  if (data.purpose === 'info' || data.purpose === 'trend') score.scout += 2;
  if (data.purpose === 'people') score.connector += 3;
  if (data.purpose === 'sent' || data.purpose === 'none' || data.purpose === 'fun') score.observer += 3;

  if (data.excite === 'win') score.hunter += 2;
  if (data.excite === 'discover') score.scout += 3;
  if (data.excite === 'solve') score.solver += 3;
  if (data.excite === 'happy') { score.solver += 1; score.strategist += 1; }
  if (data.excite === 'connect') score.connector += 3;

  if (data.growth === 'sales') score.hunter += 2;
  if (data.growth === 'proposal') score.strategist += 3;
  if (data.growth === 'knowledge') score.scout += 2;
  if (data.growth === 'network') score.connector += 2;
  if (data.growth === 'system') { score.strategist += 2; score.solver += 1; }

  if (data.offer === 'job') score.hunter += 2;
  if (data.offer === 'product') score.scout += 2;
  if (data.offer === 'price') score.strategist += 2;
  if (data.offer === 'knowhow') score.solver += 2;
  if (data.offer === 'intro') score.connector += 2;

  return Object.entries(score).sort((a, b) => b[1] - a[1])[0][0];
}

function initializeResponseSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    const first = spreadsheet.getSheets()[0];
    if (spreadsheet.getSheets().length === 1 && first.getLastRow() === 0) {
      sheet = first;
      sheet.setName(SHEET_NAME);
    } else {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }
  }

  const headers = ['回答日時','会社名','名前','立場キー','立場','参加理由キー','参加理由','高揚ポイントキー','高揚ポイント','伸ばしたいことキー','伸ばしたいこと','提供できることキー','提供できること','タイプキー','診断タイプ','アプリバージョン','イベントID','開催地','開催日','セッション'];
  const widths = [160,180,130,90,170,110,320,120,240,120,170,120,190,100,190,120,210,110,110,100];

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
    headers.forEach((header, index) => {
      if (currentHeaders[index] !== header) sheet.getRange(1, index + 1).setValue(header);
    });
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

function validateResponse_(data) {
  if (!data || typeof data !== 'object') throw new Error('回答データがありません。');
  if (!sanitizeText_(data.company, 100)) throw new Error('会社名を入力してください。');
  if (!sanitizeText_(data.name, 100)) throw new Error('お名前を入力してください。');
  if (!ROLES[data.role]) throw new Error('立場を選んでください。');
  if (!PURPOSE[data.purpose]) throw new Error('今日ここに来た理由を選んでください。');
  if (!EXCITE[data.excite]) throw new Error('テンションが上がる瞬間を選んでください。');
  if (!GROWTH[data.growth]) throw new Error('会社として伸ばしたいことを選んでください。');
  if (!OFFER[data.offer]) throw new Error('提供できるものを選んでください。');
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty(PROPERTY_SPREADSHEET_ID);
  if (!id) throw new Error('初期設定が未完了です。Apps Scriptエディタで setup() を1回実行してください。');
  return SpreadsheetApp.openById(id);
}

function getResponseSheet_() {
  const spreadsheet = getSpreadsheet_();
  initializeResponseSheet_(spreadsheet);
  return spreadsheet.getSheetByName(SHEET_NAME);
}

function createEmptyDashboardData_(eventId) {
  const roleBreakdown = {};
  Object.keys(ROLES).forEach(key => {
    roleBreakdown[key] = { label: ROLES[key], count: 0, types: {}, purposes: {}, growths: {}, offers: {}, typeRanking: [], purposeRanking: [], growthRanking: [] };
  });
  return {
    total: 0,
    event: eventId ? getEventInfo_(eventId) : { id: '', label: '全イベント', location: '', date: '', session: '' },
    typeCounts: {},
    roleCounts: {},
    purposeCounts: {},
    growthCounts: {},
    offerCounts: {},
    typeRanking: [],
    purposeRanking: [],
    growthRanking: [],
    offerRanking: [],
    roleBreakdown,
    types: TYPES,
    roles: ROLES,
    purpose: PURPOSE,
    growth: GROWTH,
    offer: OFFER,
    appVersion: APP_VERSION
  };
}

function countEventResponses_(sheet, eventId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 0;
  const values = sheet.getRange(2, 17, lastRow - 1, 1).getValues();
  return values.reduce((count, row) => count + (String(row[0] || '') === eventId ? 1 : 0), 0);
}

function normalizeEventId_(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').substring(0, 80);
}

function getEventInfo_(eventId) {
  const id = normalizeEventId_(eventId);
  if (!id) return { id: '', label: '全イベント', location: '', date: '', session: '' };
  if (id === DEFAULT_EVENT_ID) return { id, label: '一般利用', location: '', date: '', session: '' };

  const match = id.match(/^([a-z0-9]+)-(\d{4})-(\d{2})-(\d{2})(?:-([a-z0-9]+))?$/);
  if (!match) return { id, label: id, location: '', date: '', session: '' };

  const locationMap = {
    sendai: '仙台',
    sapporo: '札幌',
    tokyo: '東京',
    fukuoka: '福岡',
    hiroshima: '広島',
    osaka: '大阪',
    nagoya: '名古屋'
  };
  const sessionMap = { am: '午前', pm: '午後', eve: '夜' };
  const location = locationMap[match[1]] || match[1];
  const date = `${match[2]}-${match[3]}-${match[4]}`;
  const session = sessionMap[match[5]] || (match[5] || '');
  const label = [location, date, session].filter(Boolean).join(' ');
  return { id, label, location, date, session };
}

function increment_(obj, key) {
  if (!key) return;
  obj[key] = (obj[key] || 0) + 1;
}

function ranking_(counter, labels, total, limit) {
  return Object.entries(counter)
    .map(([key, value]) => ({ key, value, percent: total ? Math.round(value / total * 100) : 0, label: labels[key] && labels[key].name ? labels[key].name : labels[key] || key, emoji: labels[key] && labels[key].emoji ? labels[key].emoji : '' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit || 5);
}

function sanitizeText_(value, maxLength) {
  return String(value || '').replace(/[<>]/g, '').trim().substring(0, maxLength || 100);
}
