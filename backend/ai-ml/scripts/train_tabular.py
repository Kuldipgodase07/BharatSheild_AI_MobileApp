from pathlib import Path
import json, joblib
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix
from src.features.tabular import engineer_features, make_preprocessor
from src.models.tabular_xgb import build_xgb
from src.evaluation.metrics import classification_metrics
from src.utils.common import seed_everything, save_json

SEED=42
seed_everything(SEED)
df=pd.read_csv("data/processed/fraud_clean.csv")
y_raw=df["Fraud Category"]
X=engineer_features(df.drop(columns=["Fraud Category"]))
le=LabelEncoder()
y=le.fit_transform(y_raw)

X_train, X_test, y_train, y_test = train_test_split(
    X,y,test_size=0.20,stratify=y,random_state=SEED
)
pre=make_preprocessor(X)
model=build_xgb(len(le.classes_), SEED)
pipe=Pipeline([("preprocessor",pre),("model",model)])
pipe.fit(X_train,y_train)

pred=pipe.predict(X_test)
metrics=classification_metrics(y_test,pred)
report=classification_report(y_test,pred,target_names=le.classes_,output_dict=True,zero_division=0)
cm=confusion_matrix(y_test,pred).tolist()

Path("models/tabular").mkdir(parents=True,exist_ok=True)
joblib.dump(pipe,"models/tabular/xgboost_fraud_pipeline.joblib")
Path("models/tabular/label_classes.json").write_text(json.dumps(le.classes_.tolist(),indent=2))
save_json({"metrics":metrics,"classification_report":report,"confusion_matrix":cm,
           "train_rows":len(X_train),"test_rows":len(X_test),"classes":le.classes_.tolist()},
          "reports/tabular_metrics.json")
print(json.dumps(metrics,indent=2))
