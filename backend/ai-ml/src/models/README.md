# Model registry

Expected artifacts:
- `tabular/` — XGBoost classifier + label encoder
- `anomaly/` — Isolation Forest
- `cv/` — PyTorch ResNet, Siamese model checkpoints, TensorFlow EfficientNet
- `nlp/` — Hugging Face model checkpoints/configuration
- `graph/` — GraphML and optional PyTorch Geometric checkpoints

Keep raw model binaries out of source control if repository policy requires Git LFS/object storage.
