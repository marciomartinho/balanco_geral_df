"""
API de Despesas v2 - Padronizada e documentada
Endpoints RESTful para consulta de despesas orçamentárias
"""

from flask import Blueprint, request
from backend.api.base import (
    ApiResponse, 
    validar_parametros, 
    log_requisicao, 
    tratar_erros
)
from backend.servicos.despesa_servico import DespesaServico
from backend.servicos.exportacao_servico import ExportacaoServico
import logging

logger = logging.getLogger(__name__)

# Blueprint com versionamento
api_v1 = Blueprint('api_v1_despesas', __name__, url_prefix='/api/v1')

# Instâncias dos serviços
despesa_servico = DespesaServico()
exportacao_servico = ExportacaoServico()


# ============================================
# ENDPOINTS DE CONSULTA
# ============================================

@api_v1.route('/despesas', methods=['GET'])
@log_requisicao
@tratar_erros
@validar_parametros(
    exercicio={'tipo': int, 'obrigatorio': True, 'min': 2020, 'max': 2030},
    mes={'tipo': int, 'obrigatorio': True, 'min': 1, 'max': 12},
    ug={'tipo': str, 'obrigatorio': False, 'padrao': 'CONSOLIDADO'},
    formato={'tipo': str, 'obrigatorio': False, 'padrao': 'resumido', 'opcoes': ['resumido', 'detalhado']}
)
def listar_despesas(**kwargs):
    """
    Lista despesas orçamentárias
    
    Query Parameters:
        exercicio (int): Ano do exercício [2020-2030] *obrigatório
        mes (int): Mês [1-12] *obrigatório
        ug (str): Código da UG ou 'CONSOLIDADO' (padrão: CONSOLIDADO)
        formato (str): 'resumido' ou 'detalhado' (padrão: resumido)
    
    Retorna:
        200: Dados das despesas
        400: Parâmetros inválidos
        500: Erro interno
    
    Exemplo:
        GET /api/v1/despesas?exercicio=2025&mes=8&ug=110101
    """
    exercicio = kwargs['exercicio']
    mes = kwargs['mes']
    ug = kwargs['ug']
    formato = kwargs['formato']
    
    # Buscar dados
    resultado = despesa_servico.obter_demonstrativo_comparativo(
        exercicio=exercicio,
        mes=mes,
        ug=ug if ug != 'CONSOLIDADO' else None
    )
    
    if not resultado['success']:
        return ApiResponse.erro(
            mensagem=resultado.get('message', 'Erro ao buscar dados'),
            codigo=404
        )
    
    # Meta informações
    meta = {
        'exercicio': exercicio,
        'mes': mes,
        'ug': ug,
        'formato': formato,
        'total_categorias': len(resultado['demonstrativo']['categorias']),
        'total_registros': resultado['totais'].get('registros_atual', 0)
    }
    
    return ApiResponse.sucesso(
        dados=resultado,
        mensagem='Dados recuperados com sucesso',
        meta=meta
    )


@api_v1.route('/despesas/comparativo', methods=['GET'])
@log_requisicao
@tratar_erros
@validar_parametros(
    exercicio={'tipo': int, 'obrigatorio': True, 'min': 2020, 'max': 2030},
    mes={'tipo': int, 'obrigatorio': True, 'min': 1, 'max': 12},
    ug={'tipo': str, 'obrigatorio': False, 'padrao': 'CONSOLIDADO'}
)
def obter_comparativo(**kwargs):
    """
    Obtém análise comparativa entre exercícios
    
    Query Parameters:
        exercicio (int): Ano base para comparação
        mes (int): Mês limite
        ug (str): Código da UG ou 'CONSOLIDADO'
    
    Retorna:
        Análise comparativa com variações percentuais
    """
    resultado = despesa_servico.obter_analise_comparativa(
        exercicio=kwargs['exercicio'],
        mes=kwargs['mes'],
        ug=kwargs['ug'] if kwargs['ug'] != 'CONSOLIDADO' else None
    )
    
    if not resultado:
        return ApiResponse.erro('Dados não disponíveis', 404)
    
    return ApiResponse.sucesso(
        dados=resultado,
        mensagem='Análise comparativa gerada'
    )


@api_v1.route('/despesas/creditos', methods=['GET'])
@log_requisicao
@tratar_erros
@validar_parametros(
    exercicio={'tipo': int, 'obrigatorio': True, 'min': 2020, 'max': 2030},
    mes={'tipo': int, 'obrigatorio': True, 'min': 1, 'max': 12},
    ug={'tipo': str, 'obrigatorio': False, 'padrao': 'CONSOLIDADO'}
)
def obter_creditos(**kwargs):
    """
    Obtém detalhamento de créditos adicionais
    """
    resultado = despesa_servico.obter_creditos_detalhados(
        exercicio=kwargs['exercicio'],
        mes=kwargs['mes'],
        ug=kwargs['ug'] if kwargs['ug'] != 'CONSOLIDADO' else None
    )
    
    return ApiResponse.sucesso(
        dados=resultado,
        mensagem='Créditos adicionais recuperados'
    )


# ============================================
# ENDPOINTS DE UNIDADES GESTORAS
# ============================================

@api_v1.route('/ugs', methods=['GET'])
@log_requisicao
@tratar_erros
@validar_parametros(
    ativas={'tipo': bool, 'obrigatorio': False, 'padrao': True},
    pagina={'tipo': int, 'obrigatorio': False, 'padrao': 1, 'min': 1},
    por_pagina={'tipo': int, 'obrigatorio': False, 'padrao': 100, 'min': 10, 'max': 500}
)
def listar_ugs(**kwargs):
    """
    Lista unidades gestoras disponíveis
    
    Query Parameters:
        ativas (bool): Apenas UGs com movimento (padrão: true)
        pagina (int): Número da página (padrão: 1)
        por_pagina (int): Itens por página (padrão: 100)
    
    Retorna:
        Lista paginada de UGs
    """
    ugs = despesa_servico.obter_ugs_disponiveis(
        apenas_ativas=kwargs['ativas']
    )
    
    # Paginar
    inicio = (kwargs['pagina'] - 1) * kwargs['por_pagina']
    fim = inicio + kwargs['por_pagina']
    ugs_pagina = ugs[inicio:fim]
    
    return ApiResponse.lista(
        items=ugs_pagina,
        total=len(ugs),
        pagina=kwargs['pagina'],
        por_pagina=kwargs['por_pagina'],
        mensagem=f"{len(ugs)} UGs encontradas"
    )


@api_v1.route('/ugs/<codigo>', methods=['GET'])
@log_requisicao
@tratar_erros
def obter_ug(codigo):
    """
    Obtém detalhes de uma UG específica
    
    Path Parameters:
        codigo (str): Código da UG
    
    Retorna:
        Detalhes da UG
    """
    ug = despesa_servico.obter_detalhes_ug(codigo)
    
    if not ug:
        return ApiResponse.erro(f'UG {codigo} não encontrada', 404)
    
    return ApiResponse.sucesso(
        dados=ug,
        mensagem='UG encontrada'
    )


# ============================================
# ENDPOINTS DE EXPORTAÇÃO
# ============================================

@api_v1.route('/exportar', methods=['POST'])
@log_requisicao
@tratar_erros
@validar_parametros(
    exercicio={'tipo': int, 'obrigatorio': True, 'min': 2020, 'max': 2030},
    mes={'tipo': int, 'obrigatorio': True, 'min': 1, 'max': 12},
    ug={'tipo': str, 'obrigatorio': False, 'padrao': 'CONSOLIDADO'},
    formato={'tipo': str, 'obrigatorio': True, 'opcoes': ['excel', 'csv', 'pdf']}
)
def exportar_dados(**kwargs):
    """
    Exporta dados em diferentes formatos
    
    Body Parameters:
        exercicio (int): Ano do exercício
        mes (int): Mês
        ug (str): Código da UG
        formato (str): 'excel', 'csv' ou 'pdf'
    
    Retorna:
        URL do arquivo gerado ou arquivo direto
    """
    # Gerar arquivo
    arquivo_url = exportacao_servico.gerar_arquivo(
        exercicio=kwargs['exercicio'],
        mes=kwargs['mes'],
        ug=kwargs['ug'] if kwargs['ug'] != 'CONSOLIDADO' else None,
        formato=kwargs['formato']
    )
    
    if not arquivo_url:
        return ApiResponse.erro('Erro ao gerar arquivo', 500)
    
    return ApiResponse.sucesso(
        dados={'url': arquivo_url, 'formato': kwargs['formato']},
        mensagem=f'Arquivo {kwargs["formato"].upper()} gerado com sucesso'
    )


# ============================================
# ENDPOINTS DE CACHE
# ============================================

@api_v1.route('/cache/status', methods=['GET'])
@log_requisicao
@tratar_erros
def status_cache():
    """
    Retorna status e estatísticas do cache
    
    Retorna:
        Informações sobre o cache
    """
    stats = despesa_servico.cache.estatisticas()
    
    return ApiResponse.sucesso(
        dados=stats,
        mensagem='Status do cache'
    )


@api_v1.route('/cache/limpar', methods=['DELETE'])
@log_requisicao
@tratar_erros
@validar_parametros(
    confirmacao={'tipo': bool, 'obrigatorio': True}
)
def limpar_cache(**kwargs):
    """
    Limpa o cache do sistema
    
    Body Parameters:
        confirmacao (bool): Deve ser true para confirmar
    
    Retorna:
        Status da operação
    """
    if not kwargs['confirmacao']:
        return ApiResponse.erro('Confirmação necessária', 400)
    
    despesa_servico.limpar_cache()
    
    return ApiResponse.sucesso(
        mensagem='Cache limpo com sucesso'
    )


# ============================================
# ENDPOINTS DE SAÚDE E INFORMAÇÕES
# ============================================

@api_v1.route('/health', methods=['GET'])
def health_check():
    """
    Verifica saúde da API
    
    Retorna:
        Status dos componentes
    """
    from backend.dados.conexao import testar_conexao
    
    # Verificar componentes
    status = {
        'api': 'ok',
        'database': 'ok' if testar_conexao() else 'erro',
        'cache': 'ok' if despesa_servico.cache else 'desabilitado',
        'versao': '1.0.0'
    }
    
    # Determinar status geral
    if status['database'] == 'erro':
        return ApiResponse.erro(
            mensagem='Sistema com problemas',
            codigo=503,
            detalhes=status
        )
    
    return ApiResponse.sucesso(
        dados=status,
        mensagem='Sistema operacional'
    )


@api_v1.route('/info', methods=['GET'])
def api_info():
    """
    Informações sobre a API
    
    Retorna:
        Versão e endpoints disponíveis
    """
    info = {
        'versao': '1.0.0',
        'titulo': 'API de Despesas Orçamentárias - GDF',
        'descricao': 'API REST para consulta de despesas do Governo do Distrito Federal',
        'endpoints': {
            'consultas': [
                'GET /api/v1/despesas',
                'GET /api/v1/despesas/comparativo',
                'GET /api/v1/despesas/creditos'
            ],
            'ugs': [
                'GET /api/v1/ugs',
                'GET /api/v1/ugs/{codigo}'
            ],
            'exportacao': [
                'POST /api/v1/exportar'
            ],
            'cache': [
                'GET /api/v1/cache/status',
                'DELETE /api/v1/cache/limpar'
            ],
            'sistema': [
                'GET /api/v1/health',
                'GET /api/v1/info'
            ]
        },
        'documentacao': '/api/v1/docs'
    }
    
    return ApiResponse.sucesso(dados=info)