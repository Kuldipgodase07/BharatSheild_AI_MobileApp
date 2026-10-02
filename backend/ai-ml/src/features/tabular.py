from __future__ import annotations
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

DROP_COLUMNS = [
    "Dummy Policy No", "Fraud Category",
    "Date of Death", "INTIMATIONDATE",
    "POLICYRISKCOMMENCEMENTDATE"
]

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    x = df.copy()
    for c in ["POLICYRISKCOMMENCEMENTDATE","Date of Death","INTIMATIONDATE"]:
        if c in x.columns:
            x[c] = pd.to_datetime(x[c], errors="coerce")
    if {"POLICYRISKCOMMENCEMENTDATE","Date of Death"}.issubset(x.columns):
        x["days_to_death"] = (x["Date of Death"] - x["POLICYRISKCOMMENCEMENTDATE"]).dt.days
    if {"Date of Death","INTIMATIONDATE"}.issubset(x.columns):
        x["days_death_to_intimation"] = (x["INTIMATIONDATE"] - x["Date of Death"]).dt.days
    if {"POLICY SUMASSURED","Annual Income"}.issubset(x.columns):
        x["sum_assured_to_income"] = x["POLICY SUMASSURED"] / x["Annual Income"].replace(0, np.nan)
    if {"Premium","Annual Income"}.issubset(x.columns):
        x["premium_to_income"] = x["Premium"] / x["Annual Income"].replace(0, np.nan)
    return x.drop(columns=[c for c in DROP_COLUMNS if c in x.columns], errors="ignore")

def make_preprocessor(X: pd.DataFrame):
    numeric = X.select_dtypes(include=["number"]).columns.tolist()
    categorical = [c for c in X.columns if c not in numeric]
    num_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler())
    ])
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore"))
    ])
    return ColumnTransformer([
        ("num", num_pipe, numeric),
        ("cat", cat_pipe, categorical)
    ])
