// 集計ロジックのテスト。実行: node test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Code.gs を CommonJS モジュールとして読み込む
const code = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const mod = { exports: {} };
new Function('module', code)(mod);
const { summarize, buildTable, toMonth } = mod.exports;

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('日付の表記ゆれを月に揃える', () => {
  assert.equal(toMonth('2026/9/3'), '2026-09');
  assert.equal(toMonth('2026-10-01'), '2026-10');
  assert.equal(toMonth(new Date(2026, 8, 30)), '2026-09');
  assert.equal(toMonth('9月3日'), null);
  assert.equal(toMonth(''), null);
});

test('担当者 × 月で合計し、不正な行は行番号を返す', () => {
  const rows = [
    ['2026/09/01', '佐藤', 'A', 2, 1000],
    ['2026/09/15', '佐藤', 'B', 1, 500],
    ['2026/10/02', '佐藤', 'A', 1, 1000],
    ['2026/09/20', '山田', 'A', 3, 1000],
    ['', '', '', '', ''],             // 空行は黙って飛ばす
    ['2026/10/05', '', 'A', 1, 1000], // 担当者なし -> 7 行目
    ['2026/10/06', '山田', 'A', 'x', 1000], // 数量が数値でない -> 8 行目
  ];
  const r = summarize(rows);
  assert.deepEqual(r.months, ['2026-09', '2026-10']);
  assert.deepEqual(r.totals['佐藤'], { '2026-09': 2500, '2026-10': 1000 });
  assert.deepEqual(r.totals['山田'], { '2026-09': 3000 });
  assert.deepEqual(r.skipped, [7, 8]);
});

test('合計行・合計列付きの表を作る', () => {
  const table = buildTable(summarize([
    ['2026/09/01', '佐藤', 'A', 2, 1000],
    ['2026/10/02', '山田', 'A', 1, 500],
  ]));
  assert.deepEqual(table[0], ['担当者', '2026-09', '2026-10', '合計']);
  assert.deepEqual(table.at(-1), ['合計', 2000, 500, 2500]);
  assert.equal(table.length, 4);
});

test('同梱サンプルを集計できる', () => {
  const csv = fs.readFileSync(path.join(__dirname, 'sample-data.csv'), 'utf8').trim().split('\n');
  const rows = csv.slice(1).map((line) => {
    const [date, person, item, qty, price] = line.split(',');
    return [date, person, item, Number(qty), Number(price)];
  });
  const table = buildTable(summarize(rows));
  const grand = table.at(-1).at(-1);
  const expected = rows.reduce((s, r) => s + r[3] * r[4], 0);
  assert.equal(grand, expected);
});

console.log(`\n${passed} tests passed`);
