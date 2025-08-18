"""
Serviço de Cache - Gerencia cache das views
"""

import os
import pickle
import logging
from pathlib import Path
from datetime import datetime, timedelta
from typing import Any, Optional, Dict

logger = logging.getLogger(__name__)

class CacheService:
    """
    Cache simples baseado em arquivos
    Guarda resultados das views para evitar queries repetidas
    """
    
    def __init__(self, cache_dir: str = "cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True)
        self.timeout_padrao = timedelta(hours=12)
        
        logger.info(f"📁 Cache inicializado em: {self.cache_dir}")
    
    def _get_cache_path(self, key: str) -> Path:
        """Retorna caminho do arquivo de cache"""
        # Sanitizar key para nome de arquivo válido
        safe_key = key.replace('/', '_').replace('\\', '_')
        return self.cache_dir / f"{safe_key}.pkl"
    
    def obter(self, key: str) -> Optional[Any]:
        """
        Obtém dados do cache se ainda válidos
        Retorna None se não existe ou expirou
        """
        cache_path = self._get_cache_path(key)
        
        # Verificar se existe
        if not cache_path.exists():
            logger.debug(f"❌ Cache miss: {key}")
            return None
        
        # Verificar idade do arquivo
        idade = datetime.now() - datetime.fromtimestamp(cache_path.stat().st_mtime)
        
        if idade > self.timeout_padrao:
            logger.debug(f"⏰ Cache expirado: {key} ({idade.total_seconds():.0f}s)")
            cache_path.unlink()  # Deletar arquivo expirado
            return None
        
        # Carregar dados
        try:
            with open(cache_path, 'rb') as f:
                dados = pickle.load(f)
                logger.debug(f"✅ Cache hit: {key}")
                return dados
        except Exception as e:
            logger.error(f"Erro ao ler cache {key}: {e}")
            return None
    
    def salvar(
        self, 
        key: str, 
        dados: Any, 
        timeout_horas: Optional[int] = None
    ) -> bool:
        """
        Salva dados no cache
        """
        cache_path = self._get_cache_path(key)
        
        try:
            with open(cache_path, 'wb') as f:
                pickle.dump(dados, f)
            
            logger.debug(f"💾 Cache salvo: {key}")
            
            # Se especificou timeout diferente, anotar em arquivo separado
            if timeout_horas:
                timeout_path = cache_path.with_suffix('.timeout')
                timeout_path.write_text(str(timeout_horas))
            
            return True
            
        except Exception as e:
            logger.error(f"Erro ao salvar cache {key}: {e}")
            return False
    
    def invalidar(self, key: str) -> bool:
        """Remove item específico do cache"""
        cache_path = self._get_cache_path(key)
        
        if cache_path.exists():
            cache_path.unlink()
            logger.info(f"🗑️ Cache removido: {key}")
            
            # Remover arquivo de timeout se existir
            timeout_path = cache_path.with_suffix('.timeout')
            if timeout_path.exists():
                timeout_path.unlink()
            
            return True
        
        return False
    
    def limpar_tudo(self):
        """Remove todos os arquivos de cache"""
        contador = 0
        
        for arquivo in self.cache_dir.glob("*.pkl"):
            arquivo.unlink()
            contador += 1
        
        # Limpar arquivos de timeout também
        for arquivo in self.cache_dir.glob("*.timeout"):
            arquivo.unlink()
        
        logger.info(f"🧹 Cache limpo: {contador} arquivos removidos")
    
    def limpar_expirados(self):
        """Remove apenas caches expirados"""
        contador = 0
        agora = datetime.now()
        
        for arquivo in self.cache_dir.glob("*.pkl"):
            # Verificar timeout customizado
            timeout_path = arquivo.with_suffix('.timeout')
            
            if timeout_path.exists():
                timeout_horas = int(timeout_path.read_text())
                timeout = timedelta(hours=timeout_horas)
            else:
                timeout = self.timeout_padrao
            
            # Verificar idade
            idade = agora - datetime.fromtimestamp(arquivo.stat().st_mtime)
            
            if idade > timeout:
                arquivo.unlink()
                if timeout_path.exists():
                    timeout_path.unlink()
                contador += 1
        
        if contador > 0:
            logger.info(f"🧹 {contador} caches expirados removidos")
    
    def estatisticas(self) -> Dict:
        """Retorna estatísticas do cache"""
        arquivos = list(self.cache_dir.glob("*.pkl"))
        
        if not arquivos:
            return {
                'total_arquivos': 0,
                'tamanho_total_mb': 0,
                'cache_mais_antigo': None,
                'cache_mais_recente': None
            }
        
        tamanho_total = sum(f.stat().st_size for f in arquivos)
        datas = [datetime.fromtimestamp(f.stat().st_mtime) for f in arquivos]
        
        return {
            'total_arquivos': len(arquivos),
            'tamanho_total_mb': round(tamanho_total / (1024 * 1024), 2),
            'cache_mais_antigo': min(datas).isoformat(),
            'cache_mais_recente': max(datas).isoformat(),
            'diretorio': str(self.cache_dir)
        }