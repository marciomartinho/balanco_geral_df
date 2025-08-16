"""
Serviço de Despesa Orçamentária - Versão 2.0
Centraliza TODA a lógica de negócio no backend
"""

import pandas as pd
import numpy as np
import logging
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime
from decimal import Decimal
from config.database import get_db_manager

# Cache simplificado
try:
    from services.simple_cache import get_cache
    USE_CACHE = True
except ImportError:
    USE_CACHE = False

logger = logging.getLogger(__name__)

class DespesaOrcamentariaService:
    """
    Serviço centralizado para despesa orçamentária
    TODA a lógica de agregação e cálculo fica aqui
    """
    
    # Estrutura das categorias (não deve ficar no JS!)
    ESTRUTURA_CATEGORIAS = {
        '3': {
            'nome': 'DESPESAS CORRENTES',
            'grupos': {
                '1': 'PESSOAL E ENCARGOS SOCIAIS',
                '2': 'JUROS E ENCARGOS DA DÍVIDA', 
                '3': 'OUTRAS DESPESAS CORRENTES'
            }
        },
        '4': {
            'nome': 'DESPESAS DE CAPITAL',
            'grupos': {
                '4': 'INVESTIMENTOS',
                '5': 'INVERSÕES FINANCEIRAS',
                '6': 'AMORTIZAÇÃO DA DÍVIDA'
            }
        },
        '9': {
            'nome': 'RESERVA DE CONTINGÊNCIA',
            'grupos': {}
        }
    }
    
    def __init__(self):
        self.db_manager = get_db_manager()
        self.query_path = Path(__file__).parent.parent / 'queries' / 'despesa_orcamentaria.sql'
        self.cache = get_cache() if USE_CACHE else None
        self._dados_cache = None
    
    def _load_query(self) -> str:
        """Carrega query SQL"""
        with open(self.query_path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _buscar_dados_completos(self) -> pd.DataFrame:
        """Busca dados completos do banco ou cache"""
        # Tentar cache primeiro
        if self.cache:
            df = self.cache.carregar()
            if df is not None:
                logger.info(f"✅ {len(df)} registros carregados do cache")
                # Debug: mostrar primeiras linhas
                if not df.empty:
                    logger.debug(f"Colunas disponíveis: {df.columns.tolist()}")
                    logger.debug(f"Primeiros registros:\n{df.head()}")
                return df
        
        # Buscar do banco
        logger.info("🔄 Buscando dados do banco (cache vazio ou não disponível)...")
        query = self._load_query()
        hoje = datetime.now()
        
        # Buscar 2 anos de dados (ano atual e anterior)
        exercicio_atual = hoje.year
        exercicio_anterior = exercicio_atual - 1
        
        logger.info(f"📅 Buscando exercícios {exercicio_anterior} e {exercicio_atual}")
        
        # Substituir parâmetros na query
        query = query.replace(':exercicio_inicial', str(exercicio_anterior))
        query = query.replace(':exercicio_final', str(exercicio_atual))
        query = query.replace(':mes_limite', '12')  # Buscar todos os meses
        
        try:
            with self.db_manager.get_cursor() as cursor:
                logger.info("⏳ Executando query (pode demorar 1-2 minutos)...")
                cursor.execute(query)
                columns = [desc[0] for desc in cursor.description]
                results = cursor.fetchall()
                logger.info(f"✅ Query executada: {len(results)} registros retornados")
        except Exception as e:
            logger.error(f"❌ Erro ao executar query: {e}")
            return pd.DataFrame()
        
        if not results:
            logger.warning("⚠️ Nenhum resultado retornado do banco")
            return pd.DataFrame()
        
        df = pd.DataFrame(results, columns=columns)
        
        logger.info(f"📊 DataFrame criado com {len(df)} registros e {len(df.columns)} colunas")
        
        # Debug: verificar estrutura
        if not df.empty:
            logger.info(f"📋 Colunas: {df.columns.tolist()}")
            if 'COEXERCICIO' in df.columns:
                logger.info(f"📅 Exercícios únicos: {sorted(df['COEXERCICIO'].unique())}")
            if 'INMES' in df.columns:
                logger.info(f"📅 Meses únicos: {sorted(df['INMES'].unique())}")
            if 'COUG' in df.columns:
                n_ugs = df['COUG'].nunique()
                logger.info(f"🏢 Total de UGs únicas: {n_ugs}")
        
        # Salvar no cache
        if self.cache and not df.empty:
            sucesso = self.cache.salvar(df)
            if sucesso:
                logger.info(f"💾 Cache salvo com {len(df)} registros")
            else:
                logger.warning("⚠️ Falha ao salvar cache")
        
        return df
    
    def processar_dados_comparativo(
        self,
        exercicio: int,
        mes: int,
        ug: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processa TODOS os dados para comparação entre anos
        Retorna estrutura completa pronta para o frontend
        """
        logger.info(f"📊 Processando: Exercício {exercicio}, Mês {mes}, UG {ug or 'CONSOLIDADO'}")
        
        # Buscar dados completos
        df = self._buscar_dados_completos()
        
        if df is None or df.empty:
            logger.warning("⚠️ DataFrame vazio ou None retornado")
            return self._estrutura_vazia()
        
        logger.info(f"📁 Total de registros no cache/banco: {len(df)}")
        
        # Debug: verificar estrutura dos dados
        logger.info(f"📋 Colunas disponíveis: {df.columns.tolist()}")
        
        # Verificar e converter tipos de dados
        if 'COEXERCICIO' in df.columns:
            # Ver tipo atual e valores únicos
            logger.info(f"Tipo de COEXERCICIO: {df['COEXERCICIO'].dtype}")
            exercicios_unicos = df['COEXERCICIO'].unique()
            logger.info(f"Exercícios únicos (primeiros 10): {sorted(exercicios_unicos)[:10]}")
            
            # Converter para int se necessário
            df['COEXERCICIO'] = pd.to_numeric(df['COEXERCICIO'], errors='coerce').fillna(0).astype(int)
            
        if 'INMES' in df.columns:
            logger.info(f"Tipo de INMES: {df['INMES'].dtype}")
            meses_unicos = df['INMES'].unique()
            logger.info(f"Meses únicos: {sorted(meses_unicos)}")
            
            # Converter para int se necessário
            df['INMES'] = pd.to_numeric(df['INMES'], errors='coerce').fillna(0).astype(int)
            
        if 'COUG' in df.columns:
            logger.info(f"Tipo de COUG: {df['COUG'].dtype}")
            # Converter para string e limpar espaços
            df['COUG'] = df['COUG'].astype(str).str.strip()
            
            # Mostrar algumas UGs de exemplo
            ugs_exemplo = df['COUG'].unique()[:5]
            logger.info(f"Exemplos de COUG: {ugs_exemplo}")
        
        # Agora filtrar com tipos corretos
        logger.info(f"🔍 Filtrando para exercício {exercicio} (tipo: {type(exercicio)})")
        
        # Filtrar dados do ano atual
        mask_atual = (df['COEXERCICIO'] == exercicio) & (df['INMES'] <= mes)
        df_atual = df[mask_atual].copy()
        
        logger.info(f"📊 Após filtro exercício {exercicio} e mês <= {mes}: {len(df_atual)} registros")
        
        # Se ainda tem 0 registros, verificar se o problema é o exercício
        if len(df_atual) == 0:
            # Verificar quantos registros tem para o exercício independente do mês
            df_teste = df[df['COEXERCICIO'] == exercicio]
            logger.warning(f"⚠️ Registros para exercício {exercicio} (qualquer mês): {len(df_teste)}")
            
            # Se não tem dados para o exercício, mostrar quais exercícios existem
            if len(df_teste) == 0:
                exercicios_disponiveis = sorted(df['COEXERCICIO'].unique())
                logger.warning(f"⚠️ Exercício {exercicio} não encontrado! Disponíveis: {exercicios_disponiveis}")
        
        # Filtrar dados do ano anterior
        mask_anterior = (df['COEXERCICIO'] == (exercicio - 1)) & (df['INMES'] <= mes)
        df_anterior = df[mask_anterior].copy()
        
        logger.info(f"📊 Após filtro exercício {exercicio - 1} e mês <= {mes}: {len(df_anterior)} registros")
        
        # Filtrar por UG se especificado
        if ug and ug != 'CONSOLIDADO':
            ug_str = str(ug).strip()
            logger.info(f"🏢 Filtrando por UG: '{ug_str}'")
            
            # Verificar se a UG existe
            if ug_str not in df['COUG'].values:
                ugs_similares = df[df['COUG'].str.contains(ug_str[:3], na=False)]['COUG'].unique()[:5]
                logger.warning(f"⚠️ UG '{ug_str}' não encontrada! UGs similares: {ugs_similares}")
            
            df_atual = df_atual[df_atual['COUG'] == ug_str].copy()
            df_anterior = df_anterior[df_anterior['COUG'] == ug_str].copy()
            
            logger.info(f"📊 Após filtro UG {ug}: Atual {len(df_atual)}, Anterior {len(df_anterior)}")
        
        logger.info(f"📈 Final - Atual: {len(df_atual)} registros | Anterior: {len(df_anterior)} registros")
        
        # Se não tem dados, retornar estrutura vazia mas com informação
        if len(df_atual) == 0 and len(df_anterior) == 0:
            logger.warning("⚠️ Nenhum dado encontrado após filtros!")
            resultado = self._estrutura_vazia()
            resultado['message'] = f'Nenhum dado encontrado para exercício {exercicio}, mês {mes}'
            return resultado
        
        # Processar demonstrativo comparativo
        demonstrativo = self._processar_demonstrativo(df_atual, df_anterior)
        
        # Processar créditos adicionais
        creditos = self._processar_creditos(df_atual)
        
        # Calcular totais para cards
        totais = self._calcular_totais_cards(df_atual, df_anterior)
        
        return {
            'success': True,
            'exercicio_atual': exercicio,
            'exercicio_anterior': exercicio - 1,
            'mes': mes,
            'ug': ug or 'CONSOLIDADO',
            'demonstrativo': demonstrativo,
            'creditos': creditos,
            'totais': totais,
            'total_registros_atual': len(df_atual),
            'total_registros_anterior': len(df_anterior)
        }
        
        # Processar demonstrativo comparativo
        demonstrativo = self._processar_demonstrativo(df_atual, df_anterior)
        
        # Processar créditos adicionais
        creditos = self._processar_creditos(df_atual)
        
        # Calcular totais para cards
        totais = self._calcular_totais_cards(df_atual, df_anterior)
        
        return {
            'success': True,
            'exercicio_atual': exercicio,
            'exercicio_anterior': exercicio - 1,
            'mes': mes,
            'ug': ug or 'CONSOLIDADO',
            'demonstrativo': demonstrativo,
            'creditos': creditos,
            'totais': totais,
            'total_registros_atual': len(df_atual),
            'total_registros_anterior': len(df_anterior)
        }
    
    def _processar_demonstrativo(
        self, 
        df_atual: pd.DataFrame, 
        df_anterior: pd.DataFrame
    ) -> Dict[str, Any]:
        """
        Processa demonstrativo comparativo com hierarquia completa
        Categoria -> Grupo -> Detalhes (Natureza)
        """
        demonstrativo = {
            'categorias': [],
            'total_geral': None
        }
        
        # Totalizadores gerais
        total_atual = self._criar_valores_zerados()
        total_anterior = self._criar_valores_zerados()
        
        # Processar cada categoria
        for cat_id, cat_info in self.ESTRUTURA_CATEGORIAS.items():
            # Filtrar dados da categoria
            df_cat_atual = df_atual[df_atual['CATEGORIA'] == cat_id]
            df_cat_anterior = df_anterior[df_anterior['CATEGORIA'] == cat_id]
            
            if df_cat_atual.empty and df_cat_anterior.empty:
                continue
            
            # Calcular totais da categoria
            valores_cat_atual = self._somar_valores(df_cat_atual)
            valores_cat_anterior = self._somar_valores(df_cat_anterior)
            
            # Somar ao total geral
            total_atual = self._somar_dicts(total_atual, valores_cat_atual)
            total_anterior = self._somar_dicts(total_anterior, valores_cat_anterior)
            
            categoria = {
                'id': cat_id,
                'nome': cat_info['nome'],
                'valores_atual': valores_cat_atual,
                'valores_anterior': valores_cat_anterior,
                'grupos': []
            }
            
            # Processar grupos da categoria
            for grupo_id, grupo_nome in cat_info['grupos'].items():
                df_grupo_atual = df_cat_atual[df_cat_atual['GRUPO'] == grupo_id]
                df_grupo_anterior = df_cat_anterior[df_cat_anterior['GRUPO'] == grupo_id]
                
                if df_grupo_atual.empty and df_grupo_anterior.empty:
                    continue
                
                valores_grupo_atual = self._somar_valores(df_grupo_atual)
                valores_grupo_anterior = self._somar_valores(df_grupo_anterior)
                
                # Processar detalhes do grupo (por natureza)
                detalhes = self._processar_detalhes_grupo(
                    df_grupo_atual, 
                    df_grupo_anterior
                )
                
                grupo = {
                    'id': grupo_id,
                    'nome': grupo_nome,
                    'valores_atual': valores_grupo_atual,
                    'valores_anterior': valores_grupo_anterior,
                    'detalhes': detalhes  # Lista de naturezas com seus valores
                }
                
                categoria['grupos'].append(grupo)
            
            demonstrativo['categorias'].append(categoria)
        
        # Total geral
        demonstrativo['total_geral'] = {
            'valores_atual': total_atual,
            'valores_anterior': total_anterior
        }
        
        return demonstrativo
    
    def _processar_detalhes_grupo(
        self, 
        df_atual: pd.DataFrame, 
        df_anterior: pd.DataFrame
    ) -> List[Dict]:
        """
        Processa detalhes do grupo por natureza
        Aqui que estava o problema - agora centralizado!
        """
        detalhes = []
        
        # Obter todas as naturezas únicas de ambos os anos
        naturezas_atual = set(df_atual['CONATUREZA'].unique()) if not df_atual.empty else set()
        naturezas_anterior = set(df_anterior['CONATUREZA'].unique()) if not df_anterior.empty else set()
        todas_naturezas = naturezas_atual.union(naturezas_anterior)
        
        for natureza in sorted(todas_naturezas):
            # Filtrar por natureza
            df_nat_atual = df_atual[df_atual['CONATUREZA'] == natureza]
            df_nat_anterior = df_anterior[df_anterior['CONATUREZA'] == natureza]
            
            # Calcular valores
            valores_atual = self._somar_valores(df_nat_atual) if not df_nat_atual.empty else self._criar_valores_zerados()
            valores_anterior = self._somar_valores(df_nat_anterior) if not df_nat_anterior.empty else self._criar_valores_zerados()
            
            detalhes.append({
                'natureza': str(natureza),
                'valores_atual': valores_atual,
                'valores_anterior': valores_anterior
            })
        
        return detalhes
    
    def _processar_creditos(self, df: pd.DataFrame) -> Dict[str, Any]:
        """
        Processa quadro de créditos adicionais
        """
        creditos = {
            'categorias': [],
            'total_geral': None
        }
        
        total = self._criar_valores_creditos_zerados()
        
        for cat_id, cat_info in self.ESTRUTURA_CATEGORIAS.items():
            df_cat = df[df['CATEGORIA'] == cat_id]
            
            if df_cat.empty:
                continue
            
            valores_cat = self._somar_valores_creditos(df_cat)
            total = self._somar_dicts(total, valores_cat)
            
            categoria = {
                'id': cat_id,
                'nome': cat_info['nome'],
                'valores': valores_cat,
                'grupos': []
            }
            
            # Processar grupos
            for grupo_id, grupo_nome in cat_info['grupos'].items():
                df_grupo = df_cat[df_cat['GRUPO'] == grupo_id]
                
                if df_grupo.empty:
                    continue
                
                valores_grupo = self._somar_valores_creditos(df_grupo)
                
                grupo = {
                    'id': grupo_id,
                    'nome': grupo_nome,
                    'valores': valores_grupo
                }
                
                categoria['grupos'].append(grupo)
            
            creditos['categorias'].append(categoria)
        
        creditos['total_geral'] = total
        
        return creditos
    
    def _somar_valores(self, df: pd.DataFrame) -> Dict[str, float]:
        """Soma valores de despesa do DataFrame"""
        if df.empty:
            return self._criar_valores_zerados()
        
        valores = {
            'dotacao_inicial': float(df['DOTACAO_INICIAL'].sum()),
            'dotacao_adicional': float(df['DOTACAO_ADICIONAL'].sum()),
            'cancelamento_dotacao': float(df['CANCELAMENTO_DOTACAO'].sum()),
            'cancel_remaneja_dotacao': float(df['CANCEL_REMANEJA_DOTACAO'].sum()),
            'despesa_empenhada': float(df['DESPESA_EMPENHADA'].sum()),
            'despesa_liquidada': float(df['DESPESA_LIQUIDADA'].sum()),
            'despesa_paga': float(df['DESPESA_PAGA'].sum())
        }
        
        # Calcular dotação atualizada e saldo
        valores['dotacao_atualizada'] = (
            valores['dotacao_inicial'] + 
            valores['dotacao_adicional'] + 
            valores['cancelamento_dotacao'] + 
            valores['cancel_remaneja_dotacao']
        )
        
        valores['saldo_dotacao'] = (
            valores['dotacao_atualizada'] - 
            valores['despesa_empenhada']
        )
        
        return valores
    
    def _somar_valores_creditos(self, df: pd.DataFrame) -> Dict[str, float]:
        """Soma valores de créditos do DataFrame"""
        if df.empty:
            return self._criar_valores_creditos_zerados()
        
        valores = {
            'credito_suplementar': float(df['CREDITO_SUPLEMENTAR'].sum()),
            'credito_especial_aberto': float(df['CREDITO_ESPECIAL_ABERTO'].sum()),
            'credito_especial_reaberto': float(df['CREDITO_ESPECIAL_REABERTO'].sum()),
            'credito_extraordinario_reaberto': float(df['CREDITO_EXTRAORD_REABERTO'].sum()),
            'cancel_credito_suplementar': float(df['CANCEL_CREDITO_SUPLEMENTAR'].sum()),
            'remanejamento_veto_lei': float(df['REMANEJAMENTO_VETO_LEI'].sum()),
            'cancel_credito_especial': float(df['CANCEL_CREDITO_ESPECIAL'].sum())
        }
        
        valores['total_alteracoes'] = sum(valores.values())
        
        return valores
    
    def _criar_valores_zerados(self) -> Dict[str, float]:
        """Cria dicionário com valores zerados"""
        return {
            'dotacao_inicial': 0.0,
            'dotacao_adicional': 0.0,
            'cancelamento_dotacao': 0.0,
            'cancel_remaneja_dotacao': 0.0,
            'dotacao_atualizada': 0.0,
            'despesa_empenhada': 0.0,
            'despesa_liquidada': 0.0,
            'despesa_paga': 0.0,
            'saldo_dotacao': 0.0
        }
    
    def _criar_valores_creditos_zerados(self) -> Dict[str, float]:
        """Cria dicionário de créditos zerados"""
        return {
            'credito_suplementar': 0.0,
            'credito_especial_aberto': 0.0,
            'credito_especial_reaberto': 0.0,
            'credito_extraordinario_reaberto': 0.0,
            'cancel_credito_suplementar': 0.0,
            'remanejamento_veto_lei': 0.0,
            'cancel_credito_especial': 0.0,
            'total_alteracoes': 0.0
        }
    
    def _somar_dicts(self, dict1: Dict, dict2: Dict) -> Dict:
        """Soma valores de dois dicionários"""
        resultado = dict1.copy()
        for key, value in dict2.items():
            if key in resultado:
                resultado[key] = resultado[key] + value
            else:
                resultado[key] = value
        return resultado
    
    def _calcular_totais_cards(
        self, 
        df_atual: pd.DataFrame, 
        df_anterior: pd.DataFrame
    ) -> Dict:
        """Calcula totais para os cards do dashboard"""
        totais_atual = self._somar_valores(df_atual)
        totais_anterior = self._somar_valores(df_anterior)
        
        return {
            'atual': totais_atual,
            'anterior': totais_anterior,
            'registros_atual': len(df_atual),
            'registros_anterior': len(df_anterior)
        }
    
    def _estrutura_vazia(self) -> Dict:
        """Retorna estrutura vazia quando não há dados"""
        return {
            'success': False,
            'message': 'Nenhum dado disponível',
            'demonstrativo': {'categorias': [], 'total_geral': None},
            'creditos': {'categorias': [], 'total_geral': None},
            'totais': None
        }
    
    def obter_ugs_disponiveis(self, apenas_com_movimento: bool = True) -> List[Dict]:
        """
        Retorna lista de UGs disponíveis
        """
        df = self._buscar_dados_completos()
        
        if df.empty:
            return []
        
        if apenas_com_movimento:
            # Filtrar UGs com movimento financeiro
            colunas_financeiras = [
                'DOTACAO_INICIAL', 'DESPESA_EMPENHADA', 
                'DESPESA_LIQUIDADA', 'DESPESA_PAGA'
            ]
            
            df_agrupado = df.groupby(['COUG', 'NOUG'])[colunas_financeiras].sum()
            df_agrupado['tem_movimento'] = df_agrupado.sum(axis=1) > 0
            
            ugs_com_movimento = df_agrupado[df_agrupado['tem_movimento']].reset_index()
            
            return [
                {
                    'codigo': str(row['COUG']).strip(),
                    'nome': str(row['NOUG']).strip()
                }
                for _, row in ugs_com_movimento.iterrows()
            ]
        else:
            # Todas as UGs
            ugs = df[['COUG', 'NOUG']].drop_duplicates().sort_values('COUG')
            return [
                {
                    'codigo': str(row['COUG']).strip(),
                    'nome': str(row['NOUG']).strip()
                }
                for _, row in ugs.iterrows()
            ]
    
    def exportar_dados_processados(
        self,
        exercicio: int,
        mes: int,
        ug: Optional[str] = None,
        formato: str = 'excel'
    ) -> Optional[str]:
        """
        Exporta dados processados para arquivo
        """
        # Processar dados
        dados = self.processar_dados_comparativo(exercicio, mes, ug)
        
        if not dados['success']:
            return None
        
        # Criar DataFrame para exportação
        linhas = []
        
        # Adicionar dados do demonstrativo
        for categoria in dados['demonstrativo']['categorias']:
            # Linha da categoria
            linhas.append({
                'TIPO': 'CATEGORIA',
                'DESCRICAO': categoria['nome'],
                'DOTACAO_INICIAL': categoria['valores_atual']['dotacao_inicial'],
                'DOTACAO_ATUALIZADA': categoria['valores_atual']['dotacao_atualizada'],
                'EMPENHADA_ANTERIOR': categoria['valores_anterior']['despesa_empenhada'],
                'EMPENHADA_ATUAL': categoria['valores_atual']['despesa_empenhada'],
                'LIQUIDADA_ANTERIOR': categoria['valores_anterior']['despesa_liquidada'],
                'LIQUIDADA_ATUAL': categoria['valores_atual']['despesa_liquidada'],
                'PAGA_ANTERIOR': categoria['valores_anterior']['despesa_paga'],
                'PAGA_ATUAL': categoria['valores_atual']['despesa_paga'],
                'SALDO': categoria['valores_atual']['saldo_dotacao']
            })
            
            # Linhas dos grupos
            for grupo in categoria['grupos']:
                linhas.append({
                    'TIPO': 'GRUPO',
                    'DESCRICAO': f"  {grupo['nome']}",
                    'DOTACAO_INICIAL': grupo['valores_atual']['dotacao_inicial'],
                    'DOTACAO_ATUALIZADA': grupo['valores_atual']['dotacao_atualizada'],
                    'EMPENHADA_ANTERIOR': grupo['valores_anterior']['despesa_empenhada'],
                    'EMPENHADA_ATUAL': grupo['valores_atual']['despesa_empenhada'],
                    'LIQUIDADA_ANTERIOR': grupo['valores_anterior']['despesa_liquidada'],
                    'LIQUIDADA_ATUAL': grupo['valores_atual']['despesa_liquidada'],
                    'PAGA_ANTERIOR': grupo['valores_anterior']['despesa_paga'],
                    'PAGA_ATUAL': grupo['valores_atual']['despesa_paga'],
                    'SALDO': grupo['valores_atual']['saldo_dotacao']
                })
                
                # Linhas dos detalhes (naturezas)
                for detalhe in grupo['detalhes']:
                    linhas.append({
                        'TIPO': 'DETALHE',
                        'DESCRICAO': f"    Natureza: {detalhe['natureza']}",
                        'DOTACAO_INICIAL': detalhe['valores_atual']['dotacao_inicial'],
                        'DOTACAO_ATUALIZADA': detalhe['valores_atual']['dotacao_atualizada'],
                        'EMPENHADA_ANTERIOR': detalhe['valores_anterior']['despesa_empenhada'],
                        'EMPENHADA_ATUAL': detalhe['valores_atual']['despesa_empenhada'],
                        'LIQUIDADA_ANTERIOR': detalhe['valores_anterior']['despesa_liquidada'],
                        'LIQUIDADA_ATUAL': detalhe['valores_atual']['despesa_liquidada'],
                        'PAGA_ANTERIOR': detalhe['valores_anterior']['despesa_paga'],
                        'PAGA_ATUAL': detalhe['valores_atual']['despesa_paga'],
                        'SALDO': detalhe['valores_atual']['saldo_dotacao']
                    })
        
        # Linha do total geral
        total = dados['demonstrativo']['total_geral']
        linhas.append({
            'TIPO': 'TOTAL',
            'DESCRICAO': 'TOTAL GERAL',
            'DOTACAO_INICIAL': total['valores_atual']['dotacao_inicial'],
            'DOTACAO_ATUALIZADA': total['valores_atual']['dotacao_atualizada'],
            'EMPENHADA_ANTERIOR': total['valores_anterior']['despesa_empenhada'],
            'EMPENHADA_ATUAL': total['valores_atual']['despesa_empenhada'],
            'LIQUIDADA_ANTERIOR': total['valores_anterior']['despesa_liquidada'],
            'LIQUIDADA_ATUAL': total['valores_atual']['despesa_liquidada'],
            'PAGA_ANTERIOR': total['valores_anterior']['despesa_paga'],
            'PAGA_ATUAL': total['valores_atual']['despesa_paga'],
            'SALDO': total['valores_atual']['saldo_dotacao']
        })
        
        # Criar DataFrame
        df_export = pd.DataFrame(linhas)
        
        # Criar diretório de exportação
        export_dir = Path(__file__).parent.parent / 'exports'
        export_dir.mkdir(exist_ok=True)
        
        # Nome do arquivo
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        nome_base = f"despesa_{exercicio}_mes{mes}"
        if ug and ug != 'CONSOLIDADO':
            nome_base += f"_ug{ug}"
        
        # Exportar
        if formato == 'excel':
            filepath = export_dir / f"{nome_base}_{timestamp}.xlsx"
            df_export.to_excel(filepath, index=False)
        else:
            filepath = export_dir / f"{nome_base}_{timestamp}.csv"
            df_export.to_csv(filepath, index=False, encoding='utf-8-sig')
        
        logger.info(f"📁 Arquivo exportado: {filepath}")
        return str(filepath)
    
    def limpar_cache(self):
        """Limpa o cache"""
        self._dados_cache = None
        if self.cache:
            self.cache.limpar()
        logger.info("🧹 Cache limpo com sucesso")
    
    def recriar_cache(self):
        """Força recriação do cache buscando dados novos do banco"""
        logger.info("🔄 Recriando cache...")
        
        # Limpar cache existente
        self.limpar_cache()
        
        # Buscar dados novos
        df = self._buscar_dados_completos()
        
        if df is not None and not df.empty:
            logger.info(f"✅ Cache recriado com {len(df)} registros")
            return True
        else:
            logger.error("❌ Falha ao recriar cache")
            return False