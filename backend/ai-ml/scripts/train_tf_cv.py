"""
TensorFlow/Keras alternative CV baseline.
Expected data/raw/documents/{genuine,forged}/...
"""
from pathlib import Path
import tensorflow as tf
from src.models.tf_cv import build_efficientnet_binary

root="data/raw/documents"
if not Path(root).exists():
    raise SystemExit("Create the document image dataset first.")
train=tf.keras.utils.image_dataset_from_directory(
    root, image_size=(224,224), batch_size=32, validation_split=0.2, subset="training", seed=42
)
val=tf.keras.utils.image_dataset_from_directory(
    root, image_size=(224,224), batch_size=32, validation_split=0.2, subset="validation", seed=42
)
model=build_efficientnet_binary()
model.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
              loss="binary_crossentropy",metrics=["accuracy",tf.keras.metrics.AUC(name="auc")])
model.fit(train,validation_data=val,epochs=20)
Path("models/cv").mkdir(parents=True,exist_ok=True)
model.save("models/cv/efficientnet_document_forgery.keras")
