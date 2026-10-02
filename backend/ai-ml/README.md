# BharatShield AI — AI/ML Laboratory

Industry-oriented AI/ML workspace for the BharatShield AI insurance fraud detection platform.

## Objectives
1. Structured/tabular fraud classification from the supplied FY 2023-24 insurance fraud workbook.
2. Unknown/emerging fraud discovery with anomaly detection.
3. Document and signature forgery analysis using computer vision.
4. Document text/layout intelligence with Hugging Face models.
5. Entity/relationship fraud-ring analysis using graph analytics/GNN-ready data.
6. Reproducible training, testing, evaluation and report generation.

## Important data note
The supplied workbook contains 1,321 fraud records and 24 columns. The `Fraud Category` field is used as the supervised target for the classification experiment. The CV/NLP modules are scaffolded and require document/image files before they can be trained. No fabricated CV metrics are included.

## Recommended lab execution
```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt

python scripts/prepare_data.py --input ../../Fraud_data_FY_2023-24.xlsx
python scripts/train_tabular.py
python scripts/train_anomaly.py
python scripts/evaluate_all.py
python scripts/generate_report.py
```

For document/CV experiments, place labeled files under:
- `data/raw/documents/genuine/`
- `data/raw/documents/forged/`
- `data/raw/signatures/genuine/`
- `data/raw/signatures/forged/`

Then run the corresponding scripts.

## Model strategy
- XGBoost: primary structured fraud classifier.
- PyTorch: deep anomaly/representation learning and future GNN models.
- TensorFlow/Keras: CV baseline and optional image model training.
- Hugging Face Transformers: document/NLP intelligence (LayoutLM-family/ViT-compatible workflows).
- OpenCV: document preprocessing and image integrity features.
- NetworkX: relationship graph construction and graph analytics.
- PyTorch Geometric: optional GNN training when graph-labeled data is available.

## Reproducibility
All experiments should save:
- configuration
- train/validation/test split metadata
- metrics JSON
- confusion matrix / classification report
- model artifact
- feature schema
- timestamp and random seed

Never report a metric unless it was produced by an executed experiment.
