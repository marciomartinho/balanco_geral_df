"""
Serviço de Despesas - SIMPLIFICADO!
Não faz cálculos, apenas formata dados das views
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from decimal import Decimal

from backend.dados.repositorio_despesa import RepositorioDespesa
from backend.servicos.cache_servico import CacheService

logger = logging.getLogger(__name__)

class DespesaServico:
    """
    Serviço simplificado - não faz cálculos!
    Apenas coordena repositório e cache
    """
    
    # Mapeamento de categorias (única lógica que fica aqui)
    CATEGORIAS = {
        '3': 'DESPESAS CORRENTES',
        '4': 'DESPESAS DE CAPITAL',
        '9': 'RESERVA DE CONTINGÊNCIA'
    }
    
    GRUPOS = {
        '1': 'PESSOAL E ENCARGOS SOCIAIS',
        '2': 'JUROS E ENCARGOS DA DÍVIDA',
        '3': 'OUTRAS DESPESAS CORRENTES',
        '4': 'INVESTIMENTOS',
        '5': 'INVERSÕES FINANCEIRAS',
        '6': 'AMORTIZAÇÃO DA DÍVIDA'
    }
    
    def __init__(self):
        self.repositorio = RepositorioDespesa()
        self.cache = CacheService()
    
    def obter_demonstrativo_comparativo(
        self,
        exercicio: int,
        mes: int,
        ug: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retorna demonstrativo comparativo COMPLETO
        Dados já vêm agregados das views!
        """
        
        # Chave do cache
        cache_key = f"demonstrativo_{exercicio}_{mes}_{ug or 'todas'}"
        
        # Tentar pegar do cache
        dados_cache = self.cache.obter(cache_key)
        if dados_cache:
            logger.info(f"✅ Dados obtidos do cache: {cache_key}")
            return dados_cache
        
        logger.info(f"🔄 Buscando dados do banco para {exercicio}/{mes}")
        
        try:
            # 1. Buscar comparativo anual (já com variações!)
            comparativo = self.repositorio.obter_comparativo_anual(
                exercicio, mes, ug
            )
            
            # 2. Buscar detalhes por grupo
            grupos = self.repositorio.obter_resumo_grupo(
                exercicio, mes, ug
            )
            
            # 3. Buscar créditos adicionais
            creditos = self.repositorio.obter_creditos_adicionais(
                exercicio, mes, ug
            )
            
            # 4. Montar estrutura para o frontend
            resultado = self._montar_estrutura_demonstrativo(
                comparativo, grupos, creditos, exercicio
            )
            
            # 5. Salvar no cache
            self.cache.salvar(cache_key, resultado)
            
            logger.info(f"✅ Demonstrativo montado com sucesso")
            return resultado
            
        except Exception as e:
            logger.error(f"❌ Erro ao obter demonstrativo: {e}")
            return self._estrutura_erro(str(e))
    
    def _montar_estrutura_demonstrativo(
        self,
        comparativo: List[Dict],
        grupos: List[Dict],
        creditos: List[Dict],
        exercicio: int
    ) -> Dict[str, Any]:
        """
        Monta estrutura esperada pelo frontend
        APENAS FORMATA, não calcula!
        """
        
        # Estrutura base
        resultado = {
            'success': True,
            'exercicio_atual': exercicio,
            'exercicio_anterior': exercicio - 1,
            'demonstrativo': {
                'categorias': [],
                'total_geral': None
            },
            'creditos': {
                'categorias': [],
                'total_geral': None
            },
            'totais': {}
        }
        
        # Totalizadores (virão do banco!)
        total_geral = {
            'dotacao_inicial': 0,
            'dotacao_atualizada': 0,
            'despesa_empenhada': 0,
            'despesa_liquidada': 0,
            'despesa_paga': 0,
            'despesa_empenhada_anterior': 0,
            'despesa_liquidada_anterior': 0,
            'despesa_paga_anterior': 0,
            'saldo_dotacao': 0
        }
        
        # Processar dados do comparativo (categorias)
        for cat_data in comparativo:
            categoria_id = str(cat_data['CATEGORIA'])
            
            # Somar totais
            for campo in total_geral.keys():
                if campo.upper() in cat_data:
                    total_geral[campo] += float(cat_data[campo.upper()] or 0)
            
            # Montar categoria
            categoria = {
                'id': categoria_id,
                'nome': self.CATEGORIAS.get(categoria_id, cat_data.get('NOME_CATEGORIA', '')),
                'valores_atual': {
                    'dotacao_inicial': float(cat_data.get('DOTACAO_INICIAL', 0)),
                    'dotacao_atualizada': float(cat_data.get('DOTACAO_ATUALIZADA', 0)),
                    'despesa_empenhada': float(cat_data.get('DESPESA_EMPENHADA', 0)),
                    'despesa_liquidada': float(cat_data.get('DESPESA_LIQUIDADA', 0)),
                    'despesa_paga': float(cat_data.get('DESPESA_PAGA', 0)),
                    'saldo_dotacao': float(cat_data.get('SALDO_DOTACAO', 0))
                },
                'valores_anterior': {
                    'despesa_empenhada': float(cat_data.get('DESPESA_EMPENHADA_ANTERIOR', 0)),
                    'despesa_liquidada': float(cat_data.get('DESPESA_LIQUIDADA_ANTERIOR', 0)),
                    'despesa_paga': float(cat_data.get('DESPESA_PAGA_ANTERIOR', 0))
                },
                'grupos': []
            }
            
            # Adicionar grupos desta categoria
            grupos_categoria = [g for g in grupos if str(g['CATEGORIA']) == categoria_id]
            
            for grupo_data in grupos_categoria:
                grupo = {
                    'id': str(grupo_data['GRUPO']),
                    'nome': self.GRUPOS.get(
                        str(grupo_data['GRUPO']), 
                        grupo_data.get('NOME_GRUPO', '')
                    ),
                    'valores_atual': {
                        'dotacao_inicial': float(grupo_data.get('DOTACAO_INICIAL', 0)),
                        'dotacao_atualizada': float(grupo_data.get('DOTACAO_ATUALIZADA', 0)),
                        'despesa_empenhada': float(grupo_data.get('DESPESA_EMPENHADA', 0)),
                        'despesa_liquidada': float(grupo_data.get('DESPESA_LIQUIDADA', 0)),
                        'despesa_paga': float(grupo_data.get('DESPESA_PAGA', 0)),
                        'saldo_dotacao': float(grupo_data.get('SALDO_DOTACAO', 0))
                    },
                    'valores_anterior': {
                        # Aqui precisaria de outro JOIN ou query
                        # Por enquanto, deixar zerado ou buscar separadamente
                        'despesa_empenhada': 0,
                        'despesa_liquidada': 0,
                        'despesa_paga': 0
                    }
                }
                categoria['grupos'].append(grupo)
            
            resultado['demonstrativo']['categorias'].append(categoria)
        
        # Total geral
        resultado['demonstrativo']['total_geral'] = {
            'valores_atual': {
                'dotacao_inicial': total_geral['dotacao_inicial'],
                'dotacao_atualizada': total_geral['dotacao_atualizada'],
                'despesa_empenhada': total_geral['despesa_empenhada'],
                'despesa_liquidada': total_geral['despesa_liquidada'],
                'despesa_paga': total_geral['despesa_paga'],
                'saldo_dotacao': total_geral['saldo_dotacao']
            },
            'valores_anterior': {
                'despesa_empenhada': total_geral['despesa_empenhada_anterior'],
                'despesa_liquidada': total_geral['despesa_liquidada_anterior'],
                'despesa_paga': total_geral['despesa_paga_anterior']
            }
        }
        
        # Processar créditos (similar mas mais simples)
        self._processar_creditos(resultado, creditos)
        
        # Totais para cards
        resultado['totais'] = {
            'atual': resultado['demonstrativo']['total_geral']['valores_atual'],
            'anterior': resultado['demonstrativo']['total_geral']['valores_anterior'],
            'registros_atual': len(comparativo),
            'registros_anterior': len(comparativo)  # Ajustar se necessário
        }
        
        return resultado
    
    def _processar_creditos(self, resultado: Dict, creditos: List[Dict]):
        """Processa dados de créditos adicionais"""
        
        if not creditos:
            return
        
        total_creditos = {
            'credito_suplementar': 0,
            'credito_especial_aberto': 0,
            'credito_especial_reaberto': 0,
            'credito_extraordinario_reaberto': 0,
            'cancel_credito_suplementar': 0,
            'remanejamento_veto_lei': 0,
            'cancel_credito_especial': 0,
            'total_alteracoes': 0
        }
        
        # Agrupar por categoria
        categorias_creditos = {}
        
        for cred in creditos:
            cat_id = str(cred['CATEGORIA'])
            
            if cat_id not in categorias_creditos:
                categorias_creditos[cat_id] = {
                    'id': cat_id,
                    'nome': self.CATEGORIAS.get(cat_id, ''),
                    'valores': {k: 0 for k in total_creditos.keys()},
                    'grupos': []
                }
            
            # Somar valores
            for campo in total_creditos.keys():
                valor = float(cred.get(campo.upper(), 0))
                categorias_creditos[cat_id]['valores'][campo] += valor
                total_creditos[campo] += valor
        
        # Adicionar ao resultado
        resultado['creditos']['categorias'] = list(categorias_creditos.values())
        resultado['creditos']['total_geral'] = total_creditos
    
    def obter_ugs_disponiveis(self) -> List[Dict]:
        """Retorna lista de UGs com movimento"""
        
        cache_key = "ugs_disponiveis"
        
        # Tentar cache
        ugs_cache = self.cache.obter(cache_key)
        if ugs_cache:
            return ugs_cache
        
        # Buscar do banco
        ugs = self.repositorio.obter_ugs_com_movimento()
        
        # Formatar
        resultado = [
            {
                'codigo': ug['COUG'],
                'nome': ug['NOUG'],
                'tem_movimento': True
            }
            for ug in ugs
        ]
        
        # Cachear por 24 horas
        self.cache.salvar(cache_key, resultado, timeout_horas=24)
        
        return resultado
    
    def limpar_cache(self):
        """Limpa todo o cache"""
        self.cache.limpar_tudo()
        logger.info("🧹 Cache limpo com sucesso")
    
    def _estrutura_erro(self, mensagem: str) -> Dict:
        """Retorna estrutura de erro"""
        return {
            'success': False,
            'message': mensagem,
            'demonstrativo': {'categorias': [], 'total_geral': None},
            'creditos': {'categorias': [], 'total_geral': None},
            'totais': None
        }