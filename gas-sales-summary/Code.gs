/**
 * 「売上」シートの明細から、担当者 × 月の売上集計表を「月別集計」シートに作る。
 *
 * 売上シートの列: 日付 | 担当者 | 商品 | 数量 | 単価（1 行目は見出し）
 * スプレッドシートを開くとメニュー「集計 > 月別集計を更新」が出る。
 */

const SOURCE_SHEET = '売上';
const SUMMARY_SHEET = '月別集計';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('集計')
    .addItem('月別集計を更新', 'updateSummary')
    .addToUi();
}

function updateSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const source = ss.getSheetByName(SOURCE_SHEET);
  if (!source) {
    throw new Error(`「${SOURCE_SHEET}」という名前のシートが見つかりません。画面左下のタブの名前を「${SOURCE_SHEET}」に変えてください（ファイル名ではありません）`);
  }

  const rows = source.getDataRange().getValues().slice(1);
  const result = summarize(rows);
  const table = buildTable(result);

  const out = ss.getSheetByName(SUMMARY_SHEET) || ss.insertSheet(SUMMARY_SHEET);
  out.clear();
  out.getRange(1, 1, table.length, table[0].length).setValues(table);
  out.getRange(1, 1, 1, table[0].length).setFontWeight('bold').setBackground('#e8eef7');
  out.getRange(table.length, 1, 1, table[0].length).setFontWeight('bold');
  if (table[0].length > 1) {
    out.getRange(2, 2, table.length - 1, table[0].length - 1).setNumberFormat('#,##0');
  }
  out.autoResizeColumns(1, table[0].length);
  // 自動調整は日本語の幅を小さく見積もることがあるので、担当者列は最低幅を確保する
  if (out.getColumnWidth(1) < 100) out.setColumnWidth(1, 100);

  const message = result.skipped.length
    ? `集計しました。読み飛ばした行: ${result.skipped.join(', ')} 行目（日付・担当者・数量・単価を確認してください）`
    : '集計しました。';
  ss.toast(message, '月別集計', 10);
}

/**
 * 明細行を担当者 × 月に集計する。シートに依存しない純粋な関数。
 * @param {Array[]} rows 見出しを除いた明細行 [日付, 担当者, 商品, 数量, 単価]
 * @return {{totals: Object, months: string[], people: string[], skipped: number[]}}
 *   skipped はシート上の行番号（見出しが 1 行目）
 */
function summarize(rows) {
  const totals = {};
  const months = new Set();
  const people = new Set();
  const skipped = [];

  rows.forEach((row, i) => {
    const [date, person, , qty, price] = row;
    if (row.every((cell) => cell === '' || cell === null)) return;

    const month = toMonth(date);
    const name = String(person || '').trim();
    const amount = Number(qty) * Number(price);
    if (!month || !name || !isFinite(amount) || qty === '' || price === '') {
      skipped.push(i + 2);
      return;
    }

    months.add(month);
    people.add(name);
    totals[name] = totals[name] || {};
    totals[name][month] = (totals[name][month] || 0) + amount;
  });

  return {
    totals,
    months: [...months].sort(),
    people: [...people].sort((a, b) => a.localeCompare(b, 'ja')),
    skipped,
  };
}

/** 集計結果を、見出し行と合計行・合計列付きの 2 次元配列にする。 */
function buildTable({ totals, months, people }) {
  const header = ['担当者', ...months, '合計'];
  const body = people.map((name) => {
    const values = months.map((m) => totals[name][m] || 0);
    return [name, ...values, sum(values)];
  });
  const columnTotals = months.map((_, j) => sum(body.map((r) => r[j + 1])));
  const footer = ['合計', ...columnTotals, sum(columnTotals)];
  return [header, ...body, footer];
}

function toMonth(value) {
  let d = value;
  if (!(d instanceof Date)) {
    const s = String(value || '').trim().replace(/\//g, '-');
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return null;
    const [y, m, day] = s.split('-').map(Number);
    d = new Date(y, m - 1, day);
  }
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

// Node でのテスト用。GAS 上では module が無いので何もしない。
if (typeof module !== 'undefined') {
  module.exports = { summarize, buildTable, toMonth };
}
