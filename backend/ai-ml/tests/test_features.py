import pandas as pd
from src.features.tabular import engineer_features

def test_feature_engineering():
    df=pd.DataFrame({
        "Fraud Category":["A"],
        "POLICY SUMASSURED":[100000],
        "Annual Income":[50000],
        "Premium":[5000],
        "POLICYRISKCOMMENCEMENTDATE":["2023-01-01"],
        "Date of Death":["2023-02-01"],
        "INTIMATIONDATE":["2023-02-10"],
    })
    out=engineer_features(df)
    assert "sum_assured_to_income" in out.columns
    assert "days_to_death" in out.columns
