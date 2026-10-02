from pathlib import Path
import argparse
import pandas as pd
from src.data.load_data import load_fraud_workbook, basic_clean

parser = argparse.ArgumentParser()
parser.add_argument("--input", default="Fraud_data_FY_2023-24.xlsx")
args = parser.parse_args()

df = basic_clean(load_fraud_workbook(args.input))
out = Path("data/processed/fraud_clean.csv")
out.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(out, index=False)
print(f"Saved {len(df)} rows to {out}")
print(df["Fraud Category"].value_counts())
