"""
Serviço de Exportação
"""

import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

class ExportacaoServico:
    """
    Serviço para exportar dados em diferentes formatos
    """
    
    def __init__(self):
        self.export_dir = Path('exports')
        self.export_dir.mkdir(exist_ok=True)
    
    def gerar_arquivo(self, exercicio, mes, ug, formato):
        """
        Gera arquivo de exportação (por enquanto só retorna URL fake)
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        nome_arquivo = f"despesa_{exercicio}_{mes}_{timestamp}.{formato}"
        
        # Por enquanto, só retorna o nome do arquivo
        # TODO: Implementar geração real do arquivo
        logger.info(f"📁 Gerando arquivo: {nome_arquivo}")
        
        return f"/exports/{nome_arquivo}"