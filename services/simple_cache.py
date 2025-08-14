"""
Sistema de Cache Simplificado para Despesa Orçamentária
Usa apenas Pickle para evitar problemas de serialização
"""

import pickle
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime, date
from typing import Optional

logger = logging.getLogger(__name__)

class SimpleCache:
    """Cache simplificado usando apenas Pickle"""
    
    def __init__(self):
        self.cache_dir = Path("cache")
        self.cache_dir.mkdir(exist_ok=True)
        
        # Um único arquivo de cache por dia
        self.cache_file = self.cache_dir / f"dados_{date.today()}.pkl"
        
        # Limpar caches antigos
        self.limpar_antigos()
    
    def limpar_antigos(self):
        """Remove caches com mais de 7 dias"""
        try:
            from datetime import timedelta
            limite = datetime.now() - timedelta(days=7)
            
            for arquivo in self.cache_dir.glob("dados_*.pkl"):
                try:
                    # Extrair data do nome
                    data_str = arquivo.stem.replace('dados_', '')
                    data_arquivo = datetime.strptime(data_str, "%Y-%m-%d")
                    
                    if data_arquivo < limite:
                        arquivo.unlink()
                        logger.info(f"🗑️ Cache antigo removido: {arquivo.name}")
                except:
                    pass
        except Exception as e:
            logger.debug(f"Erro ao limpar caches: {e}")
    
    def existe(self) -> bool:
        """Verifica se existe cache para hoje"""
        return self.cache_file.exists()
    
    def carregar(self) -> Optional[pd.DataFrame]:
        """Carrega dados do cache"""
        if not self.existe():
            logger.info("📭 Nenhum cache encontrado para hoje")
            return None
        
        try:
            with open(self.cache_file, 'rb') as f:
                df = pickle.load(f)
            
            logger.info(f"📦 Cache carregado: {len(df)} registros")
            return df
        except Exception as e:
            logger.error(f"❌ Erro ao carregar cache: {e}")
            # Remover cache corrompido
            try:
                self.cache_file.unlink()
            except:
                pass
            return None
    
    def salvar(self, df: pd.DataFrame) -> bool:
        """Salva dados no cache"""
        try:
            with open(self.cache_file, 'wb') as f:
                pickle.dump(df, f, protocol=pickle.HIGHEST_PROTOCOL)
            
            tamanho_mb = self.cache_file.stat().st_size / (1024 * 1024)
            logger.info(f"💾 Cache salvo: {len(df)} registros ({tamanho_mb:.2f} MB)")
            return True
        except Exception as e:
            logger.error(f"❌ Erro ao salvar cache: {e}")
            return False
    
    def limpar(self):
        """Remove o cache atual"""
        try:
            if self.cache_file.exists():
                self.cache_file.unlink()
                logger.info("🗑️ Cache limpo")
        except Exception as e:
            logger.error(f"Erro ao limpar cache: {e}")

# Instância global
_cache = None

def get_cache() -> SimpleCache:
    global _cache
    if _cache is None:
        _cache = SimpleCache()
    return _cache