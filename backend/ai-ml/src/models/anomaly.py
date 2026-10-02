from __future__ import annotations
from sklearn.ensemble import IsolationForest

def build_isolation_forest(seed: int = 42) -> IsolationForest:
    return IsolationForest(
        n_estimators=300,
        contamination="auto",
        random_state=seed,
        n_jobs=-1
    )
