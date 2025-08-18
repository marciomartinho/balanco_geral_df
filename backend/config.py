"""
Configuração para conectar sistema novo com banco existente
"""

import sys
import os
from pathlib import Path

# Adicionar paths necessários
root_dir = Path(__file__).parent.parent
sys.path.append(str(root_dir))

# Importar configuração de banco EXISTENTE
try:
    from config.database import get_db_manager
    DB_MANAGER = get_db_manager()
    print("✅ Usando configuração de banco existente")
except ImportError:
    print("❌ Não foi possível importar config de banco")
    DB_MANAGER = None

# Configurações
CACHE_DIR = root_dir / "cache"
EXPORT_DIR = root_dir / "exports"
VIEWS_PREFIXO = "VW_"  # Prefixo das views Oracle

# Garantir que diretórios existem
CACHE_DIR.mkdir(exist_ok=True)
EXPORT_DIR.mkdir(exist_ok=True)