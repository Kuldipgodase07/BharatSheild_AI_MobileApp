"""
Train a binary document/signature image classifier.
Expected:
data/raw/documents/genuine/*.jpg|png
data/raw/documents/forged/*.jpg|png
"""
from pathlib import Path
import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms
from src.models.cv_resnet import build_resnet_binary

root=Path("data/raw/documents")
if not root.exists() or not any(root.glob("*/*")):
    raise SystemExit("No CV dataset found. Add genuine/ and forged/ images first.")

device="cuda" if torch.cuda.is_available() else "cpu"
tfm=transforms.Compose([
    transforms.Resize((224,224)), transforms.ToTensor(),
    transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225])
])
ds=datasets.ImageFolder(root,transform=tfm)
loader=DataLoader(ds,batch_size=32,shuffle=True,num_workers=0)
model=build_resnet_binary().to(device)
opt=torch.optim.AdamW(model.parameters(),lr=2e-4,weight_decay=1e-4)
loss_fn=nn.CrossEntropyLoss()
model.train()
for epoch in range(20):
    running=0.0
    for x,y in loader:
        x,y=x.to(device),y.to(device)
        opt.zero_grad()
        loss=loss_fn(model(x),y)
        loss.backward(); opt.step()
        running += loss.item()*len(y)
    print(f"epoch={epoch+1:02d} loss={running/len(ds):.4f}")
Path("models/cv").mkdir(parents=True,exist_ok=True)
torch.save({"state_dict":model.state_dict(),"classes":ds.classes},"models/cv/resnet_document_forgery.pt")
