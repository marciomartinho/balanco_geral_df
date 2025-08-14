"""
Gerenciador de Cache para Despesa Orçamentária
Mantém cache diário dos dados para melhorar performance
"""

import pickle
import pandas as pd
import logging
from pathlib import Path
from datetime import datetime, date
from typing import Optional, Dict, Any
import hashlib
import json

logger = logging.getLogger(__name__)

class CacheManager:
    """Gerencia cache de dados em arquivo para melhorar performance"""
    
    def __init__(self, cache_dir: str = "cache"):
        """
        Inicializa o gerenciador de cache
        
        Args:
            cache_dir: Diretório onde os arquivos de cache serão armazenados
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Cache de dados completos (arquivo principal do dia)
        self.cache_file = self.cache_dir / f"despesa_orcamentaria_{date.today()}.pkl"
        
        # Arquivo de metadados do cache
        self.meta_file = self.cache_dir / f"cache_metadata_{date.today()}.json"
        
        # Limpar caches antigos ao inicializar
        self._limpar_caches_antigos()
    
    def _limpar_caches_antigos(self, dias_manter: int = 7):
        """
        Remove arquivos de cache antigos
        
        Args:
            dias_manter: Número de dias para manter os caches
        """
        try:
            hoje = datetime.now()
            for arquivo in self.cache_dir.glob("*.pkl"):
                # Extrair data do nome do arquivo
                try:
                    data_str = arquivo.stem.split('_')[-1]
                    data_arquivo = datetime.strptime(data_str, "%Y-%m-%d")
                    
                    # Remover se for mais antigo que o limite
                    dias_diferenca = (hoje - data_arquivo).days
                    if dias_diferenca > dias_manter:
                        arquivo.unlink()
                        logger.info(f"🗑️ Cache antigo removido: {arquivo.name}")
                        
                        # Remover metadados correspondentes
                        meta_arquivo = arquivo.with_suffix('.json')
                        if meta_arquivo.exists():
                            meta_arquivo.unlink()
                except:
                    pass  # Ignorar arquivos com formato incorreto
                    
        except Exception as e:
            logger.warning(f"Erro ao limpar caches antigos: {e}")
    
    def existe_cache_hoje(self) -> bool:
        """
        Verifica se existe cache válido para hoje
        
        Returns:
            True se existe cache válido, False caso contrário
        """
        return self.cache_file.exists() and self.meta_file.exists()
    
    def obter_cache(self) -> Optional[pd.DataFrame]:
        """
        Obtém dados do cache se existir e for válido
        
        Returns:
            DataFrame com os dados ou None se não houver cache válido
        """
        if not self.existe_cache_hoje():
            logger.info("📭 Nenhum cache encontrado para hoje")
            return None
        
        try:
            # Ler metadados
            with open(self.meta_file, 'r') as f:
                metadata = json.load(f)
            
            logger.info(f"📦 Cache encontrado: {metadata['total_registros']} registros")
            logger.info(f"⏰ Criado em: {metadata['data_criacao']}")
            
            # Ler dados
            with open(self.cache_file, 'rb') as f:
                df = pickle.load(f)
            
            logger.info(f"✅ Cache carregado com sucesso!")
            return df
            
        except Exception as e:
            logger.error(f"❌ Erro ao ler cache: {e}")
            # Remover cache corrompido
            self._remover_cache_atual()
            return None
    
    def salvar_cache(self, df: pd.DataFrame, info_adicional: Optional[Dict] = None):
        """
        Salva DataFrame no cache
        
        Args:
            df: DataFrame para salvar
            info_adicional: Informações adicionais para metadados
        """
        try:
            # Salvar dados em Pickle (mais eficiente)
            with open(self.cache_file, 'wb') as f:
                pickle.dump(df, f, protocol=pickle.HIGHEST_PROTOCOL)
            
            # Criar metadados (converter numpy types para Python nativos)
            metadata = {
                'data_criacao': datetime.now().isoformat(),
                'total_registros': len(df),
                'tamanho_mb': self.cache_file.stat().st_size / (1024 * 1024),
                'colunas': list(df.columns)
            }
            
            # Converter tipos numpy para tipos Python nativos
            if 'COEXERCICIO' in df.columns:
                metadata['exercicios'] = [int(x) for x in df['COEXERCICIO'].unique().tolist()]
            else:
                metadata['exercicios'] = []
                
            if 'INMES' in df.columns:
                metadata['meses'] = [int(x) for x in df['INMES'].unique().tolist()]
            else:
                metadata['meses'] = []
            
            if info_adicional:
                metadata.update(info_adicional)
            
            # Salvar metadados
            with open(self.meta_file, 'w') as f:
                json.dump(metadata, f, indent=2, default=str)
            
            logger.info(f"💾 Cache salvo: {metadata['total_registros']} registros ({metadata['tamanho_mb']:.2f} MB)")
            
        except Exception as e:
            logger.error(f"❌ Erro ao salvar cache: {e}")
            self._remover_cache_atual()
    
    def _remover_cache_atual(self):
        """Remove o cache atual se existir"""
        try:
            if self.cache_file.exists():
                self.cache_file.unlink()
            if self.meta_file.exists():
                self.meta_file.unlink()
            logger.info("🗑️ Cache atual removido")
        except Exception as e:
            logger.error(f"Erro ao remover cache: {e}")
    
    def obter_info_cache(self) -> Optional[Dict]:
        """
        Obtém informações sobre o cache atual
        
        Returns:
            Dicionário com metadados ou None
        """
        if not self.meta_file.exists():
            return None
        
        try:
            with open(self.meta_file, 'r') as f:
                return json.load(f)
        except:
            return None
    
    def criar_cache_filtrado(self, df: pd.DataFrame, filtros: Dict) -> pd.DataFrame:
        """
        Cria um subset do cache baseado em filtros
        
        Args:
            df: DataFrame completo
            filtros: Dicionário com filtros a aplicar
            
        Returns:
            DataFrame filtrado
        """
        df_filtrado = df.copy()
        
        if 'exercicio' in filtros and filtros['exercicio']:
            df_filtrado = df_filtrado[df_filtrado['COEXERCICIO'] == filtros['exercicio']]
        
        if 'mes_limite' in filtros and filtros['mes_limite']:
            df_filtrado = df_filtrado[df_filtrado['INMES'] <= filtros['mes_limite']]
        
        if 'coug' in filtros and filtros['coug']:
            df_filtrado = df_filtrado[df_filtrado['COUG'] == filtros['coug']]
        
        logger.info(f"🔍 Dados filtrados: {len(df_filtrado)} de {len(df)} registros")
        return df_filtrado

# Instância global do gerenciador de cache
_cache_manager = None

def get_cache_manager() -> CacheManager:
    """Obtém instância singleton do gerenciador de cache"""
    global _cache_manager
    if _cache_manager is None:
        _cache_manager = CacheManager()
    return _cache_manager