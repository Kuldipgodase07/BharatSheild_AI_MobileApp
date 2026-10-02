from __future__ import annotations
import torch
from torch import nn
from torchvision.models import resnet18, ResNet18_Weights

class SiameseResNet(nn.Module):
    """Signature/document similarity model. Train with genuine/forged pairs."""
    def __init__(self, embedding_dim: int = 128):
        super().__init__()
        backbone = resnet18(weights=ResNet18_Weights.DEFAULT)
        in_features = backbone.fc.in_features
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.projection = nn.Linear(in_features, embedding_dim)

    def encode(self, x):
        return nn.functional.normalize(self.projection(self.backbone(x)), dim=1)

    def forward(self, left, right):
        return self.encode(left), self.encode(right)

def contrastive_distance(z1, z2):
    return torch.linalg.vector_norm(z1 - z2, dim=1)
