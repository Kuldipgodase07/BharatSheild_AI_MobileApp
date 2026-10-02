from __future__ import annotations
import networkx as nx
import pandas as pd

def build_relationship_graph(df: pd.DataFrame) -> nx.Graph:
    """
    Build an explainable policy/claim relationship graph from available identifiers.
    The supplied workbook does not expose every entity type; only available fields
    should be connected. Missing columns are skipped safely.
    """
    G = nx.Graph()
    policy = "Dummy Policy No"
    entity_columns = [
        ("state", "CORRESPONDENCESTATE"),
        ("city", "CORRESPONDENCECITY"),
        ("channel", "CHANNEL"),
        ("bank", "Bank code"),
        ("product", "Product Type"),
        ("occupation", "OCCUPATION"),
    ]
    for _, row in df.iterrows():
        if pd.isna(row.get(policy)):
            continue
        p = f"policy:{row[policy]}"
        G.add_node(p, type="policy")
        for kind, col in entity_columns:
            if col in df.columns and pd.notna(row.get(col)):
                n = f"{kind}:{row[col]}"
                G.add_node(n, type=kind)
                G.add_edge(p, n, relation=f"policy_to_{kind}")
    return G
