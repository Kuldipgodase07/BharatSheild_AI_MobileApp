from __future__ import annotations

def load_layout_model(model_name="microsoft/layoutlmv3-base"):
    """Load only when document OCR/layout training data is available."""
    from transformers import AutoProcessor, AutoModel
    processor = AutoProcessor.from_pretrained(model_name, apply_ocr=True)
    model = AutoModel.from_pretrained(model_name)
    return processor, model
