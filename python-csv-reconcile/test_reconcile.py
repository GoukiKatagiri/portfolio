import csv
import tempfile
import unittest
from pathlib import Path

import reconcile

SAMPLE = Path(__file__).parent / "sample"


class NormalizeTest(unittest.TestCase):
    def test_phone(self):
        self.assertEqual(reconcile.normalize_phone("０９０－１２３４－５６７８"), "09012345678")
        self.assertEqual(reconcile.normalize_phone("(03) 1234-5678"), "0312345678")

    def test_email(self):
        self.assertEqual(reconcile.normalize_email(" Taro@Example.COM "), "taro@example.com")
        self.assertEqual(reconcile.normalize_email("ｔａｒｏ＠example.com"), "taro@example.com")

    def test_text(self):
        self.assertEqual(reconcile.normalize_text("　山田　　太郎 "), "山田 太郎")


class ReconcileTest(unittest.TestCase):
    def test_email_first_then_phone(self):
        customers = [
            {"顧客ID": "C1", "氏名": "A", "メール": "a@example.com", "電話番号": "090-0000-0001"},
            {"顧客ID": "C2", "氏名": "B", "メール": "", "電話番号": "090-0000-0002"},
        ]
        orders = [
            {"注文ID": "O1", "メール": "A@EXAMPLE.COM", "電話番号": "", "商品": "x", "金額": "100"},
            {"注文ID": "O2", "メール": "", "電話番号": "09000000002", "商品": "y", "金額": "200"},
            {"注文ID": "O3", "メール": "z@example.com", "電話番号": "", "商品": "z", "金額": "300"},
        ]
        matched, unmatched = reconcile.reconcile(customers, orders)
        self.assertEqual([(m["注文ID"], m["顧客ID"], m["照合キー"]) for m in matched],
                         [("O1", "C1", "メール"), ("O2", "C2", "電話番号")])
        self.assertEqual([u["注文ID"] for u in unmatched], ["O3"])

    def test_sample_end_to_end(self):
        """同梱サンプル（顧客は Shift_JIS、注文は UTF-8 BOM 付き）で CLI を通す"""
        with tempfile.TemporaryDirectory() as tmp:
            reconcile.main([str(SAMPLE / "customers.csv"), str(SAMPLE / "orders.csv"), "-o", tmp])
            with open(Path(tmp) / "matched.csv", encoding="utf-8-sig") as f:
                matched = list(csv.DictReader(f))
            with open(Path(tmp) / "unmatched.csv", encoding="utf-8-sig") as f:
                unmatched = list(csv.DictReader(f))
        self.assertEqual(len(matched), 5)
        self.assertEqual(len(unmatched), 2)
        self.assertEqual({u["注文ID"] for u in unmatched}, {"A-1006", "A-1007"})


if __name__ == "__main__":
    unittest.main()
