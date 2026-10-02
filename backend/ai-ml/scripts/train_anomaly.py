from pathlib import Path
import joblib, json
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from src.features.tabular import engineer_features
from src.models.anomaly import build_isolation_forest
from src.utils.common import seed_everything, save_json

seed_everything(42)
df=pd.read_csv("data/processed/fraud_clean.csv")
X=engineer_features(df.drop(columns=["Fraud Category"]))
X=X.select_dtypes(include="number")
pipe=Pipeline([
    ("imputer",SimpleImputer(strategy="median")),
    ("scaler",StandardScaler()),
    ("model",build_isolation_forest())
])
pipe.fit(X)
scores=-pipe.decision_function(X)
pred=pipe.predict(X)
Path("models/anomaly").mkdir(parents=True,exist_ok=True)
joblib.dump(pipe,"models/anomaly/isolation_forest.joblib")
save_json({"rows":len(X),"anomaly_count":int((pred==-1).sum()),
           "anomaly_rate":float((pred==-1).mean()),
           "score_min":float(scores.min()),"score_max":float(scores.max())},
          "reports/anomaly_metrics.json")
print("Anomaly model trained.")
