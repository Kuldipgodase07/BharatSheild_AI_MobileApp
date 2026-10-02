from __future__ import annotations

def fuse_scores(tabular_prob, anomaly_score=None, document_score=None, graph_score=None):
    """
    Transparent risk-fusion layer. Weights are configuration choices, not trained
    probabilities. Keep each component on [0,1].
    """
    components = []
    weights = []
    for score, weight in [
        (tabular_prob, 0.55),
        (anomaly_score, 0.20),
        (document_score, 0.15),
        (graph_score, 0.10),
    ]:
        if score is not None:
            components.append(float(max(0, min(1, score))))
            weights.append(weight)
    if not components:
        return 0.0
    total = sum(weights[:len(components)])
    return sum(s*w for s,w in zip(components, weights)) / total
