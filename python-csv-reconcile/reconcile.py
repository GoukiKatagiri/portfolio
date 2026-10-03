"""顧客リストと注文リストの CSV を突合し、紐づけ結果と未一致リストを書き出す。

使い方:
    python reconcile.py customers.csv orders.csv -o out

- 入力の文字コードは UTF-8（BOM 有無）と Shift_JIS（Excel 既定）を自動判別する
- 全角/半角、余分な空白、電話番号のハイフン・括弧、メールの大文字小文字を揃えてから照合する
- 照合はメールアドレス優先、無ければ電話番号
- 出力は Excel でそのまま開ける UTF-8（BOM 付き）
"""

import argparse
import csv
import re
import sys
import unicodedata
from pathlib import Path

ENCODINGS = ("utf-8-sig", "cp932")


def read_csv(path):
    raw = Path(path).read_bytes()
    for enc in ENCODINGS:
        try:
            text = raw.decode(enc)
        except UnicodeDecodeError:
            continue
        return list(csv.DictReader(text.splitlines()))
    raise ValueError(f"{path}: 文字コードを判別できません（UTF-8 / Shift_JIS 以外）")


def normalize_text(value):
    value = unicodedata.normalize("NFKC", value or "")
    return re.sub(r"\s+", " ", value).strip()


def normalize_email(value):
    return normalize_text(value).lower()


def normalize_phone(value):
    return re.sub(r"\D", "", normalize_text(value))


def build_index(customers):
    by_email, by_phone = {}, {}
    for c in customers:
        email = normalize_email(c.get("メール"))
        phone = normalize_phone(c.get("電話番号"))
        if email:
            by_email.setdefault(email, c)
        if phone:
            by_phone.setdefault(phone, c)
    return by_email, by_phone


def reconcile(customers, orders):
    by_email, by_phone = build_index(customers)
    matched, unmatched = [], []
    for o in orders:
        email = normalize_email(o.get("メール"))
        phone = normalize_phone(o.get("電話番号"))
        if email and email in by_email:
            customer, key = by_email[email], "メール"
        elif phone and phone in by_phone:
            customer, key = by_phone[phone], "電話番号"
        else:
            unmatched.append(o)
            continue
        matched.append({
            "注文ID": normalize_text(o.get("注文ID")),
            "顧客ID": normalize_text(customer.get("顧客ID")),
            "氏名": normalize_text(customer.get("氏名")),
            "商品": normalize_text(o.get("商品")),
            "金額": normalize_text(o.get("金額")),
            "照合キー": key,
        })
    return matched, unmatched


def write_csv(path, rows, fieldnames):
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main(argv=None):
    parser = argparse.ArgumentParser(description="顧客リストと注文リストの CSV を突合する")
    parser.add_argument("customers")
    parser.add_argument("orders")
    parser.add_argument("-o", "--out", default="out")
    args = parser.parse_args(argv)

    customers = read_csv(args.customers)
    orders = read_csv(args.orders)
    matched, unmatched = reconcile(customers, orders)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    write_csv(out / "matched.csv", matched,
              ["注文ID", "顧客ID", "氏名", "商品", "金額", "照合キー"])
    write_csv(out / "unmatched.csv", unmatched, list(orders[0].keys()) if orders else [])

    print(f"注文 {len(orders)} 件 / 紐づけ {len(matched)} 件 / 未一致 {len(unmatched)} 件")
    print(f"出力: {out / 'matched.csv'}, {out / 'unmatched.csv'}")


if __name__ == "__main__":
    sys.exit(main())
