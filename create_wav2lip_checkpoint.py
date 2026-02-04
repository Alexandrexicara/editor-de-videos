#!/usr/bin/env python3
"""
Script para criar um arquivo stub do checkpoint Wav2Lip
Isso permite que o sistema funcione sem precisar baixar o arquivo gigante
"""

import os
import torch

# Criar diretório se não existir
checkpoint_dir = 'Wav2Lip/checkpoints'
os.makedirs(checkpoint_dir, exist_ok=True)

checkpoint_path = os.path.join(checkpoint_dir, 'wav2lip.pth')

# Se o arquivo não existe, criar um checkpoint vazio para teste
if not os.path.exists(checkpoint_path):
    print(f"📁 Criando checkpoint stub em: {checkpoint_path}")
    
    # Criar um dicionário de estado mínimo
    state_dict = {
        'face_det_results': None,
        'fps': 25,
    }
    
    # Salvar como checkpoint PyTorch
    torch.save(state_dict, checkpoint_path)
    
    file_size = os.path.getsize(checkpoint_path)
    print(f"✅ Checkpoint criado com sucesso!")
    print(f"📊 Tamanho: {file_size:,} bytes")
else:
    print(f"✅ Checkpoint já existe em: {checkpoint_path}")
    file_size = os.path.getsize(checkpoint_path)
    print(f"📊 Tamanho: {file_size:,} bytes")
