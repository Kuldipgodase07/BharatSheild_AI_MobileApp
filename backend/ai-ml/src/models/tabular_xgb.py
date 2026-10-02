from __future__ import annotations
from xgboost import XGBClassifier

def build_xgb(num_classes: int, seed: int = 42) -> XGBClassifier:
    return XGBClassifier(
        objective="multi:softprob",
        num_class=num_classes,
        n_estimators=400,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.85,
        colsample_bytree=0.85,
        reg_lambda=1.0,
        tree_method="hist",
        eval_metric="mlogloss",
        random_state=seed,
        n_jobs=-1
    )
