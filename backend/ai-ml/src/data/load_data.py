from __future__ import annotations
from pathlib import Path
import pandas as pd

EXPECTED_TARGET = "Fraud Category"

def load_fraud_workbook(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {path}")
    df = pd.read_excel(path, sheet_name="Fraud data")
    if EXPECTED_TARGET not in df.columns:
        raise ValueError(f"Missing target column: {EXPECTED_TARGET}")
    return df

def basic_clean(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [str(c).strip() for c in out.columns]
    out = out.drop_duplicates()
    out[EXPECTED_TARGET] = out[EXPECTED_TARGET].astype("string").str.strip()
    out = out[out[EXPECTED_TARGET].notna() & (out[EXPECTED_TARGET] != "")]
    # Normalize duplicate capitalization/spacing in the supplied category labels.
    out[EXPECTED_TARGET] = (
        out[EXPECTED_TARGET].str.replace(r"\s+", " ", regex=True).str.strip()
    )
    return out
