"""
Service Layer para Despesa Orçamentária
Contém toda a lógica de negócio para processamento de despesas
"""

import pandas as pd
import logging
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from config.database import get_db_manager

# Importar o cache simplificado se disponível
try:
    from services.simple_cache import get_cache
    USE_SIMPLE_CACHE = True
except ImportError:
    USE_SIMPLE_CACHE = False
    logging.info("Cache simplificado não disponível")

logger = logging.getLogger(__name__)

class DespesaOrcamentariaService:
    """Serviço para gerenciar operações de despesa orçamentária"""
    
    def __init__(self):
        self.db_manager = get_db_manager()
        self.query_path = Path(__file__).parent.parent / 'queries' / 'despesa_orcamentaria.sql'
        self._cache_memoria = {}
        
        # Usar cache simplificado se disponível
        self.cache = get_cache() if USE_SIMPLE_CACHE else None
        
    def _load_query(self) -> str:
        """Carrega a query SQL do arquivo"""
        try:
            with open(self.query_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            logger.error(f"Arquivo SQL não encontrado: {self.query_path}")
            raise
    
    def obter_parametros_atuais(self) -> Dict[str, int]:
        """
        Obtém os parâmetros baseados na data atual
        
        Returns:
            Dicionário com exercicio_inicial, exercicio_final e mes_limite
        """
        hoje = datetime.now()
        
        exercicio_final = hoje.year
        exercicio_inicial = exercicio_final - 1
        mes_limite = hoje.month
        
        logger.info(f"📅 Parâmetros automáticos: Exercícios {exercicio_inicial}-{exercicio_final}, Até mês {mes_limite}")
        
        return {
            'exercicio_inicial': exercicio_inicial,
            'exercicio_final': exercicio_final,
            'mes_limite': mes_limite
        }
    
    def _buscar_dados_banco(self) -> Optional[pd.DataFrame]:
        """Busca todos os dados do banco para cache"""
        try:
            query = self._load_query()
            
            # Pegar dados dos últimos 2 anos completos
            hoje = datetime.now()
            query = query.replace(':exercicio_inicial', str(hoje.year - 1))
            query = query.replace(':exercicio_final', str(hoje.year))
            query = query.replace(':mes_limite', '12')
            
            logger.info("🔌 Buscando dados do banco para cache...")
            logger.info("⏳ Primeira consulta do dia, pode demorar 1-2 minutos...")
            
            with self.db_manager.get_cursor() as cursor:
                cursor.execute(query)
                columns = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()
            
            logger.info(f"✅ {len(results)} registros obtidos do banco")
            
            df = pd.DataFrame(results, columns=columns)
            return df
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar dados: {e}")
            return None
    
    def _buscar_dados_filtrados(self, exercicio_inicial: int, exercicio_final: int, mes_limite: int) -> Optional[pd.DataFrame]:
        """Busca dados filtrados diretamente do banco"""
        try:
            query = self._load_query()
            query = query.replace(':exercicio_inicial', str(exercicio_inicial))
            query = query.replace(':exercicio_final', str(exercicio_final))
            query = query.replace(':mes_limite', str(mes_limite))
            
            logger.info(f"📊 Consultando: Exercícios {exercicio_inicial}-{exercicio_final}, Mês <= {mes_limite}")
            
            with self.db_manager.get_cursor() as cursor:
                cursor.execute(query)
                columns = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()
            
            logger.info(f"✅ {len(results)} registros encontrados")
            
            df = pd.DataFrame(results, columns=columns)
            return df
            
        except Exception as e:
            logger.error(f"❌ Erro na consulta: {e}")
            return None
    
    def obter_lista_ugs(self) -> List[Dict[str, str]]:
        """
        Busca lista de todas as UGs disponíveis no banco
        
        Returns:
            Lista de dicionários com código e nome das UGs
        """
        try:
            logger.info("🔍 Buscando lista de UGs do banco...")
            
            # Query simplificada para buscar apenas UGs únicas
            query = """
                SELECT DISTINCT 
                    T1.COUG,
                    T1.NOUG
                FROM MIL2025.UNIDADEGESTORA T1
                WHERE T1.COUG IS NOT NULL 
                  AND T1.NOUG IS NOT NULL
                ORDER BY T1.COUG
            """
            
            with self.db_manager.get_cursor() as cursor:
                cursor.execute(query)
                results = cursor.fetchall()
            
            # Converter para lista de dicionários
            ugs = []
            for row in results:
                if row[0] and row[1]:  # Verificar se código e nome existem
                    ugs.append({
                        'codigo': str(row[0]).strip(),
                        'nome': str(row[1]).strip()
                    })
            
            logger.info(f"✅ {len(ugs)} UGs encontradas")
            return ugs
            
        except Exception as e:
            logger.error(f"❌ Erro ao buscar lista de UGs: {e}")
            # Tentar obter do cache de dados se houver
            try:
                if self.cache:
                    df = self.cache.carregar()
                    if df is not None and 'COUG' in df.columns and 'NOUG' in df.columns:
                        ugs_df = df[['COUG', 'NOUG']].drop_duplicates().dropna()
                        ugs = []
                        for _, row in ugs_df.iterrows():
                            ugs.append({
                                'codigo': str(row['COUG']).strip(),
                                'nome': str(row['NOUG']).strip()
                            })
                        logger.info(f"✅ {len(ugs)} UGs obtidas do cache")
                        return sorted(ugs, key=lambda x: x['codigo'])
            except:
                pass
            
            return []
            
    def executar_consulta(
        self, 
        exercicio_inicial: Optional[int] = None,
        exercicio_final: Optional[int] = None,
        mes_limite: Optional[int] = None,
        use_cache: bool = True,
        usar_data_atual: bool = True
    ) -> Optional[pd.DataFrame]:
        """
        Executa a consulta de despesa orçamentária
        
        Args:
            exercicio_inicial: Ano inicial
            exercicio_final: Ano final
            mes_limite: Mês limite
            use_cache: Se deve usar cache
            usar_data_atual: Se deve usar data atual para parâmetros None
            
        Returns:
            DataFrame com os resultados
        """
        # Definir parâmetros
        if usar_data_atual:
            params = self.obter_parametros_atuais()
            if exercicio_inicial is None:
                exercicio_inicial = params['exercicio_inicial']
            if exercicio_final is None:
                exercicio_final = params['exercicio_final']
            if mes_limite is None:
                mes_limite = params['mes_limite']
        else:
            exercicio_inicial = exercicio_inicial or 2024
            exercicio_final = exercicio_final or 2025
            mes_limite = mes_limite or 12
        
        # Tentar usar cache
        df_completo = None
        
        if use_cache and self.cache:
            # Tentar carregar do cache
            df_completo = self.cache.carregar()
            
            if df_completo is None:
                # Cache não existe, buscar do banco
                logger.info("🔄 Criando cache do dia...")
                df_completo = self._buscar_dados_banco()
                
                if df_completo is not None:
                    # Salvar no cache
                    if self.cache.salvar(df_completo):
                        logger.info("✅ Cache criado com sucesso!")
                    else:
                        logger.warning("⚠️ Não foi possível salvar o cache")
        
        # Se não tem cache ou cache desabilitado, buscar direto
        if df_completo is None:
            logger.info("📊 Buscando dados diretamente do banco...")
            return self._buscar_dados_filtrados(exercicio_inicial, exercicio_final, mes_limite)
        
        # Filtrar dados do cache
        df_filtrado = df_completo.copy()
        
        if 'COEXERCICIO' in df_filtrado.columns:
            df_filtrado = df_filtrado[
                (df_filtrado['COEXERCICIO'] >= exercicio_inicial) & 
                (df_filtrado['COEXERCICIO'] <= exercicio_final)
            ]
        
        if 'INMES' in df_filtrado.columns:
            df_filtrado = df_filtrado[df_filtrado['INMES'] <= mes_limite]
        
        logger.info(f"📊 Dados filtrados: {len(df_filtrado)} de {len(df_completo)} registros")
        
        return df_filtrado
    
    def obter_resumo_financeiro(self, df: pd.DataFrame) -> Dict:
        """Calcula resumo financeiro dos dados"""
        if df is None or df.empty:
            return {}
            
        colunas_financeiras = [
            'DOTACAO_INICIAL', 'DOTACAO_ADICIONAL', 'CANCELAMENTO_DOTACAO',
            'CANCEL_REMANEJA_DOTACAO', 'DESPESA_EMPENHADA', 
            'DESPESA_LIQUIDADA', 'DESPESA_PAGA', 'SALDO_DOTACAO'
        ]
        
        resumo = {
            'total_registros': len(df),
            'exercicios': df['COEXERCICIO'].unique().tolist() if 'COEXERCICIO' in df.columns else [],
            'meses': sorted(df['INMES'].unique().tolist()) if 'INMES' in df.columns else [],
            'totais': {},
            'data_referencia': datetime.now().strftime('%d/%m/%Y %H:%M'),
            'usando_cache': self.cache and self.cache.existe() if USE_SIMPLE_CACHE else False
        }
        
        # Calcular totais
        for col in colunas_financeiras:
            if col in df.columns:
                resumo['totais'][col] = float(df[col].sum())
                
        # Estatísticas por exercício
        if 'COEXERCICIO' in df.columns:
            resumo['por_exercicio'] = {}
            for exercicio in resumo['exercicios']:
                df_exercicio = df[df['COEXERCICIO'] == exercicio]
                resumo['por_exercicio'][exercicio] = {
                    'registros': len(df_exercicio),
                    'totais': {}
                }
                for col in colunas_financeiras:
                    if col in df.columns:
                        resumo['por_exercicio'][exercicio]['totais'][col] = float(df_exercicio[col].sum())
                        
        return resumo
    
    def obter_dados_por_ug(self, df: pd.DataFrame, coug: Optional[str] = None) -> pd.DataFrame:
        """Filtra ou agrupa dados por Unidade Gestora"""
        if df is None or df.empty:
            return pd.DataFrame()
            
        if coug:
            return df[df['COUG'] == coug]
            
        colunas_financeiras = [col for col in df.columns if any(
            termo in col for termo in ['DOTACAO', 'DESPESA', 'SALDO', 'CANCEL']
        )]
        
        return df.groupby(['COUG', 'NOUG'])[colunas_financeiras].sum().reset_index()
    
    def obter_dados_paginados(
        self, 
        df: pd.DataFrame, 
        pagina: int = 1, 
        registros_por_pagina: int = 100
    ) -> Tuple[pd.DataFrame, Dict]:
        """Retorna dados paginados"""
        if df is None or df.empty:
            return pd.DataFrame(), {'total': 0, 'paginas': 0, 'pagina_atual': 1}
            
        total_registros = len(df)
        total_paginas = (total_registros + registros_por_pagina - 1) // registros_por_pagina
        
        pagina = max(1, min(pagina, total_paginas))
        
        inicio = (pagina - 1) * registros_por_pagina
        fim = inicio + registros_por_pagina
        
        df_paginado = df.iloc[inicio:fim]
        
        info_paginacao = {
            'total': total_registros,
            'paginas': total_paginas,
            'pagina_atual': pagina,
            'registros_por_pagina': registros_por_pagina,
            'inicio': inicio + 1,
            'fim': min(fim, total_registros)
        }
        
        return df_paginado, info_paginacao
    
    def exportar_dados(
        self, 
        df: pd.DataFrame, 
        formato: str = 'excel',
        nome_arquivo: Optional[str] = None
    ) -> Optional[str]:
        """Exporta dados para arquivo"""
        if df is None or df.empty:
            logger.warning("⚠️ Nenhum dado para exportar")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        export_dir = Path(__file__).parent.parent / 'exports' / formato
        export_dir.mkdir(parents=True, exist_ok=True)
        
        if not nome_arquivo:
            nome_arquivo = f"despesa_orcamentaria_{timestamp}"
            
        try:
            if formato == 'excel':
                filepath = export_dir / f"{nome_arquivo}.xlsx"
                df.to_excel(filepath, index=False, engine='openpyxl')
            else:
                filepath = export_dir / f"{nome_arquivo}.csv"
                df.to_csv(filepath, index=False, encoding='utf-8-sig')
                
            logger.info(f"📁 Arquivo exportado: {filepath}")
            return str(filepath)
            
        except Exception as e:
            logger.error(f"❌ Erro ao exportar: {e}")
            return None
    
    def limpar_cache(self):
        """Limpa o cache"""
        self._cache_memoria.clear()
        if self.cache:
            self.cache.limpar()
        logger.info("🧹 Cache limpo")
        
    def obter_filtros_disponiveis(self, df: pd.DataFrame = None) -> Dict:
        """
        Retorna filtros disponíveis baseados nos dados ou diretamente do banco
        
        Args:
            df: DataFrame opcional. Se não fornecido, busca UGs direto do banco
        """
        filtros = {
            'exercicios': [],
            'meses': [],
            'unidades_gestoras': [],
            'funcoes': [],
            'fontes': []
        }
        
        # Buscar UGs diretamente do banco (mais confiável)
        try:
            ugs = self.obter_lista_ugs()
            filtros['unidades_gestoras'] = ugs
        except Exception as e:
            logger.error(f"Erro ao buscar UGs: {e}")
            
            # Fallback: tentar obter do DataFrame se disponível
            if df is not None and not df.empty:
                if 'COUG' in df.columns and 'NOUG' in df.columns:
                    ugs_df = df[['COUG', 'NOUG']].drop_duplicates().dropna().sort_values('COUG')
                    filtros['unidades_gestoras'] = [
                        {'codigo': str(row['COUG']).strip(), 'nome': str(row['NOUG']).strip()} 
                        for _, row in ugs_df.iterrows()
                    ]
        
        # Outros filtros do DataFrame se disponível
        if df is not None and not df.empty:
            if 'COEXERCICIO' in df.columns:
                filtros['exercicios'] = sorted(df['COEXERCICIO'].unique().tolist())
            if 'INMES' in df.columns:
                filtros['meses'] = sorted(df['INMES'].unique().tolist())
            if 'COFUNCAO' in df.columns:
                filtros['funcoes'] = sorted(df['COFUNCAO'].dropna().unique().tolist())
            if 'COFONTE' in df.columns:
                filtros['fontes'] = sorted(df['COFONTE'].dropna().unique().tolist())
                
        return filtros