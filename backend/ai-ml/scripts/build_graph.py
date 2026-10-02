import pandas as pd
import networkx as nx
from src.features.graph import build_relationship_graph

df=pd.read_csv("data/processed/fraud_clean.csv")
G=build_relationship_graph(df)
nx.write_graphml(G,"models/graph/bharatshield_relationship_graph.graphml")
print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
