from __future__ import annotations
import torch
from torch import nn
from torchvision.models import resnet18, ResNet18_Weights

def build_resnet_binary(pretrained: bool = True) -> nn.Module:
    weights = ResNet18_Weights.DEFAULT if pretrained else None
    model = resnet18(weights=weights)
    model.fc = nn.Linear(model.fc.in_features, 2)
    return model
