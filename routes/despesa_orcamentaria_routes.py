"""
Blueprint de rotas para Despesa Orçamentária
Define os endpoints da API e páginas web
"""

from flask import Blueprint, render_template, jsonify, request, send_file
from services.despesa_orcamentaria_service import DespesaOrcamentariaService
import logging

logger = logging.getLogger(__name__)

# Criar o Blueprint
despesa_orcamentaria_bp = Blueprint(
    'despesa_orcamentaria',
    __name__,
    url_prefix='/despesa-orcamentaria'
)

# Instanciar o serviço
despesa_service = DespesaOrcamentariaService()

# ==================== ROTAS DE PÁGINAS ====================

@despesa_orcamentaria_bp.route('/')
def index():
    """Página principal do módulo de despesa orçamentária"""
    return render_template('despesa_orcamentaria/index.html')

@despesa_orcamentaria_bp.route('/dashboard')
def dashboard():
    """Dashboard com visualizações de dados"""
    return render_template('despesa_orcamentaria/dashboard.html')

@despesa_orcamentaria_bp.route('/relatorio')
def relatorio():
    """Página de relatório detalhado"""
    return render_template('despesa_orcamentaria/relatorio.html')

# ==================== ROTAS DA API ====================

@despesa_orcamentaria_bp.route('/api/consultar', methods=['POST'])
def api_consultar():
    """
    Endpoint para executar consulta de despesa orçamentária
    
    Body JSON:
    {
        "exercicio_inicial": 2024,
        "exercicio_final": 2025,
        "mes_limite": 5,
        "use_cache": true
    }
    """
    try:
        data = request.get_json()
        
        # Parâmetros com valores padrão
        exercicio_inicial = data.get('exercicio_inicial', 2024)
        exercicio_final = data.get('exercicio_final', 2025)
        mes_limite = data.get('mes_limite', 5)
        use_cache = data.get('use_cache', True)
        
        # Executar consulta
        df = despesa_service.executar_consulta(
            exercicio_inicial=exercicio_inicial,
            exercicio_final=exercicio_final,
            mes_limite=mes_limite,
            use_cache=use_cache
        )
        
        if df is not None and not df.empty:
            # Obter resumo
            resumo = despesa_service.obter_resumo_financeiro(df)
            
            return jsonify({
                'success': True,
                'resumo': resumo,
                'message': f'{len(df)} registros encontrados'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Nenhum dado encontrado'
            }), 404
            
    except Exception as e:
        logger.error(f"Erro na consulta: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/dados', methods=['GET'])
def api_obter_dados():
    """
    Endpoint para obter dados paginados
    
    Query Params:
    - pagina: número da página (padrão: 1)
    - registros: registros por página (padrão: 100)
    - ug: código da unidade gestora (opcional)
    """
    try:
        # Parâmetros da query
        pagina = request.args.get('pagina', 1, type=int)
        registros_por_pagina = request.args.get('registros', 100, type=int)
        coug = request.args.get('ug', None)
        
        # Primeiro executar consulta básica (usando cache)
        df = despesa_service.executar_consulta()
        
        if df is None or df.empty:
            return jsonify({
                'success': False,
                'message': 'Nenhum dado disponível'
            }), 404
        
        # Filtrar por UG se necessário
        if coug:
            df = despesa_service.obter_dados_por_ug(df, coug)
        
        # Paginar dados
        df_paginado, info_paginacao = despesa_service.obter_dados_paginados(
            df, pagina, registros_por_pagina
        )
        
        # Converter DataFrame para dict
        dados = df_paginado.to_dict('records')
        
        return jsonify({
            'success': True,
            'dados': dados,
            'paginacao': info_paginacao
        })
        
    except Exception as e:
        logger.error(f"Erro ao obter dados: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/resumo', methods=['GET'])
def api_resumo():
    """Endpoint para obter apenas o resumo financeiro"""
    try:
        # Executar consulta (usando cache)
        df = despesa_service.executar_consulta()
        
        if df is None or df.empty:
            return jsonify({
                'success': False,
                'message': 'Nenhum dado disponível'
            }), 404
        
        resumo = despesa_service.obter_resumo_financeiro(df)
        
        return jsonify({
            'success': True,
            'resumo': resumo
        })
        
    except Exception as e:
        logger.error(f"Erro ao obter resumo: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/filtros', methods=['GET'])
def api_filtros():
    """Endpoint para obter filtros disponíveis"""
    try:
        # Executar consulta (usando cache)
        df = despesa_service.executar_consulta()
        
        if df is None or df.empty:
            return jsonify({
                'success': False,
                'message': 'Nenhum dado disponível'
            }), 404
        
        filtros = despesa_service.obter_filtros_disponiveis(df)
        
        return jsonify({
            'success': True,
            'filtros': filtros
        })
        
    except Exception as e:
        logger.error(f"Erro ao obter filtros: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/exportar', methods=['POST'])
def api_exportar():
    """
    Endpoint para exportar dados
    
    Body JSON:
    {
        "formato": "excel" ou "csv",
        "nome_arquivo": "opcional"
    }
    """
    try:
        data = request.get_json()
        formato = data.get('formato', 'excel')
        nome_arquivo = data.get('nome_arquivo', None)
        
        # Executar consulta (usando cache)
        df = despesa_service.executar_consulta()
        
        if df is None or df.empty:
            return jsonify({
                'success': False,
                'message': 'Nenhum dado para exportar'
            }), 404
        
        # Exportar
        filepath = despesa_service.exportar_dados(df, formato, nome_arquivo)
        
        if filepath:
            return send_file(filepath, as_attachment=True)
        else:
            return jsonify({
                'success': False,
                'message': 'Erro ao exportar arquivo'
            }), 500
            
    except Exception as e:
        logger.error(f"Erro ao exportar: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/cache/limpar', methods=['POST'])
def api_limpar_cache():
    """Endpoint para limpar o cache"""
    try:
        despesa_service.limpar_cache()
        return jsonify({
            'success': True,
            'message': 'Cache limpo com sucesso'
        })
    except Exception as e:
        logger.error(f"Erro ao limpar cache: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/por-ug', methods=['GET'])
def api_dados_por_ug():
    """Endpoint para obter dados agrupados por UG"""
    try:
        # Executar consulta (usando cache)
        df = despesa_service.executar_consulta()
        
        if df is None or df.empty:
            return jsonify({
                'success': False,
                'message': 'Nenhum dado disponível'
            }), 404
        
        # Agrupar por UG
        df_agrupado = despesa_service.obter_dados_por_ug(df)
        
        # Converter para dict
        dados = df_agrupado.to_dict('records')
        
        return jsonify({
            'success': True,
            'dados': dados,
            'total_ugs': len(dados)
        })
        
    except Exception as e:
        logger.error(f"Erro ao agrupar por UG: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500