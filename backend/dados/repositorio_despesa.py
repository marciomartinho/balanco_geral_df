"""
Repositório de Despesas - Acessa as VIEWS do banco
Não faz cálculos, apenas consultas
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

try:
    # Tentar usar a conexão do sistema EXISTENTE
    from config.database import get_db_manager
    
    def get_connection():
        db = get_db_manager()
        return db.get_connection()
        
    print("✅ Usando conexão do sistema existente")
    
except ImportError:
    print("❌ Criar nova conexão")

logger = logging.getLogger(__name__)

class RepositorioDespesa:
    """
    Acessa os dados através das VIEWS criadas no banco
    Toda agregação e cálculo já vem pronto do Oracle
    """
    
    def __init__(self):
        self.conn = None
    
    def _executar_query(self, query: str, params: Dict = None) -> List[Dict]:
        """Executa query e retorna lista de dicionários"""
        try:
            with get_connection() as conn:
                cursor = conn.cursor()
                
                # Log da query para debug
                logger.debug(f"Executando query: {query[:100]}...")
                logger.debug(f"Parâmetros: {params}")
                
                cursor.execute(query, params or {})
                
                # Pegar nomes das colunas
                columns = [col[0] for col in cursor.description]
                
                # Converter para lista de dicionários
                results = []
                for row in cursor.fetchall():
                    results.append(dict(zip(columns, row)))
                
                logger.info(f"✅ Query retornou {len(results)} registros")
                return results
                
        except Exception as e:
            logger.error(f"❌ Erro ao executar query: {e}")
            raise
    
    # ========================================
    # MÉTODOS QUE USAM AS VIEWS
    # ========================================
    
    def obter_resumo_categoria(
        self, 
        exercicio: int, 
        mes: int, 
        ug: Optional[str] = None
    ) -> List[Dict]:
        """
        Busca dados da VIEW VW_DESPESA_RESUMO_CATEGORIA
        Já vem agregado por categoria!
        """
        query = """
            SELECT 
                EXERCICIO,
                MES,
                CATEGORIA,
                NOME_CATEGORIA,
                COUG,
                NOUG,
                DOTACAO_INICIAL,
                DOTACAO_ADICIONAL,
                DOTACAO_ATUALIZADA,
                DESPESA_EMPENHADA,
                DESPESA_LIQUIDADA,
                DESPESA_PAGA,
                SALDO_DOTACAO,
                QTD_REGISTROS
            FROM VW_DESPESA_RESUMO_CATEGORIA
            WHERE EXERCICIO = :exercicio
              AND MES <= :mes
        """
        
        params = {'exercicio': exercicio, 'mes': mes}
        
        if ug and ug != 'CONSOLIDADO':
            query += " AND COUG = :ug"
            params['ug'] = ug
        
        query += " ORDER BY CATEGORIA"
        
        return self._executar_query(query, params)
    
    def obter_resumo_grupo(
        self, 
        exercicio: int, 
        mes: int, 
        ug: Optional[str] = None
    ) -> List[Dict]:
        """
        Busca dados da VIEW VW_DESPESA_RESUMO_GRUPO
        Já vem agregado por grupo!
        """
        query = """
            SELECT 
                EXERCICIO,
                MES,
                CATEGORIA,
                GRUPO,
                NOME_GRUPO,
                COUG,
                NOUG,
                DOTACAO_INICIAL,
                DOTACAO_ADICIONAL,
                DOTACAO_ATUALIZADA,
                DESPESA_EMPENHADA,
                DESPESA_LIQUIDADA,
                DESPESA_PAGA,
                SALDO_DOTACAO,
                QTD_REGISTROS
            FROM VW_DESPESA_RESUMO_GRUPO
            WHERE EXERCICIO = :exercicio
              AND MES <= :mes
        """
        
        params = {'exercicio': exercicio, 'mes': mes}
        
        if ug and ug != 'CONSOLIDADO':
            query += " AND COUG = :ug"
            params['ug'] = ug
        
        query += " ORDER BY CATEGORIA, GRUPO"
        
        return self._executar_query(query, params)
    
    def obter_comparativo_anual(
        self, 
        exercicio: int, 
        mes: int, 
        ug: Optional[str] = None
    ) -> List[Dict]:
        """
        Busca dados da VIEW VW_COMPARATIVO_ANUAL
        Já vem com comparação e variações calculadas!
        """
        query = """
            SELECT 
                EXERCICIO,
                MES,
                CATEGORIA,
                NOME_CATEGORIA,
                DOTACAO_INICIAL,
                DOTACAO_ATUALIZADA,
                DESPESA_EMPENHADA,
                DESPESA_LIQUIDADA,
                DESPESA_PAGA,
                DESPESA_EMPENHADA_ANTERIOR,
                DESPESA_LIQUIDADA_ANTERIOR,
                DESPESA_PAGA_ANTERIOR,
                VAR_PCT_EMPENHADA,
                VAR_PCT_LIQUIDADA,
                VAR_PCT_PAGA,
                SALDO_DOTACAO
            FROM VW_COMPARATIVO_ANUAL
            WHERE EXERCICIO = :exercicio
              AND MES = :mes
        """
        
        params = {'exercicio': exercicio, 'mes': mes}
        
        if ug and ug != 'CONSOLIDADO':
            query += " AND COUG = :ug"
            params['ug'] = ug
        
        query += " ORDER BY CATEGORIA"
        
        return self._executar_query(query, params)
    
    def obter_creditos_adicionais(
        self, 
        exercicio: int, 
        mes: int, 
        ug: Optional[str] = None
    ) -> List[Dict]:
        """
        Busca dados da VIEW VW_CREDITOS_ADICIONAIS
        Detalhamento dos créditos já agregado!
        """
        query = """
            SELECT 
                EXERCICIO,
                MES,
                CATEGORIA,
                GRUPO,
                CREDITO_SUPLEMENTAR,
                CREDITO_ESPECIAL_ABERTO,
                CREDITO_ESPECIAL_REABERTO,
                CREDITO_EXTRAORD_REABERTO,
                CANCEL_CREDITO_SUPLEMENTAR,
                REMANEJAMENTO_VETO_LEI,
                CANCEL_CREDITO_ESPECIAL,
                TOTAL_ALTERACOES
            FROM VW_CREDITOS_ADICIONAIS
            WHERE EXERCICIO = :exercicio
              AND MES <= :mes
        """
        
        params = {'exercicio': exercicio, 'mes': mes}
        
        if ug and ug != 'CONSOLIDADO':
            query += " AND COUG = :ug"
            params['ug'] = ug
        
        query += " ORDER BY CATEGORIA, GRUPO"
        
        return self._executar_query(query, params)
    
    def obter_ugs_com_movimento(self) -> List[Dict]:
        """
        Busca UGs que têm movimento financeiro
        Usa a VIEW VW_UGS_COM_MOVIMENTO
        """
        query = """
            SELECT 
                COUG,
                NOUG,
                ULTIMO_EXERCICIO,
                TOTAL_DOTACAO,
                TOTAL_EMPENHADO
            FROM VW_UGS_COM_MOVIMENTO
            ORDER BY COUG
        """
        
        return self._executar_query(query)
    
    def obter_detalhes_natureza(
        self,
        exercicio: int,
        mes: int,
        categoria: str,
        grupo: str,
        ug: Optional[str] = None
    ) -> List[Dict]:
        """
        Para detalhamento por natureza (quando expandir grupo)
        Usa a query original, mas filtrada
        """
        query = """
            SELECT 
                CONATUREZA AS NATUREZA,
                SUM(CASE WHEN COCONTACONTABIL BETWEEN 522110000 AND 522119999 
                    THEN VADEBITO - VACREDITO ELSE 0 END) AS DOTACAO_INICIAL,
                SUM(CASE WHEN COCONTACONTABIL BETWEEN 522120000 AND 522129999 
                    THEN VADEBITO - VACREDITO ELSE 0 END) AS DOTACAO_ADICIONAL,
                SUM(CASE WHEN COCONTACONTABIL BETWEEN 622130000 AND 622139999 
                    THEN VACREDITO - VADEBITO ELSE 0 END) AS DESPESA_EMPENHADA,
                SUM(CASE WHEN COCONTACONTABIL IN (622130300, 622130400, 622130700) 
                    THEN VACREDITO - VADEBITO ELSE 0 END) AS DESPESA_LIQUIDADA,
                SUM(CASE WHEN COCONTACONTABIL IN (622920104) 
                    THEN VACREDITO - VADEBITO ELSE 0 END) AS DESPESA_PAGA
            FROM MIL2001.SALDOCONTABIL_EX
            WHERE COEXERCICIO = :exercicio
              AND INMES <= :mes
              AND SUBSTR(CONATUREZA, 1, 1) = :categoria
              AND SUBSTR(CONATUREZA, 2, 1) = :grupo
        """
        
        params = {
            'exercicio': exercicio,
            'mes': mes,
            'categoria': categoria,
            'grupo': grupo
        }
        
        if ug and ug != 'CONSOLIDADO':
            query += " AND COUG = :ug"
            params['ug'] = ug
        
        query += " GROUP BY CONATUREZA ORDER BY CONATUREZA"
        
        return self._executar_query(query, params)