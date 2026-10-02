from pathlib import Path
import json, datetime

report=Path("reports/lab_report.md")
lines=[
"# BharatShield AI — AI/ML Laboratory Report",
f"Generated: {datetime.datetime.now().isoformat(timespec='seconds')}",
"",
"## 1. Experimental Scope",
"- Structured insurance fraud classification using XGBoost.",
"- Unknown-pattern discovery using Isolation Forest.",
"- CV-ready document/signature forgery pipelines using PyTorch and TensorFlow.",
"- Hugging Face document intelligence pipeline.",
"- NetworkX relationship graph for explainable entity analysis.",
"",
"## 2. Dataset",
"Source: Fraud_data_FY_2023-24.xlsx, sheet `Fraud data`.",
"Target: `Fraud Category`.",
"",
"## 3. Results",
]
for p in Path("reports").glob("*metrics.json"):
    data=json.loads(p.read_text())
    lines += [f"### {p.name}", "```json", json.dumps(data,indent=2), "```", ""]
lines += [
"## 4. Interpretation",
"Metrics must be interpreted with class imbalance in mind. Macro-F1 and per-class recall should be reported alongside accuracy.",
"",
"## 5. Limitations",
"- The supplied workbook is tabular; CV/NLP performance cannot be measured until labeled document/image data is supplied.",
"- Synthetic or limited data may not represent production fraud prevalence.",
"- Model thresholds must be calibrated on a validation set before deployment.",
"",
"## 6. Reproducibility",
"Record dataset version, random seed, package versions, model parameters and split metadata for every lab run."
]
report.write_text("\n".join(lines),encoding="utf-8")
print(report)
