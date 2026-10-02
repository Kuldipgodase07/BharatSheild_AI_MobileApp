from pathlib import Path
import json

for p in Path("reports").glob("*metrics.json"):
    print(f"\n=== {p} ===")
    print(p.read_text())
print("\nEvaluation artifacts are stored in reports/. Run the model scripts before this step.")
