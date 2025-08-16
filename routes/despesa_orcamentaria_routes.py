"""
Rotas para Despesa Orçamentária - Versão 2.0
Endpoints simplificados que apenas chamam o serviço
"""

from flask import Blueprint, render_template, jsonify, request, send_file
from services.despesa_orcamentaria_service import DespesaOrcamentariaService
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Blueprint
despesa_orcamentaria_bp = Blueprint(
    'despesa_orcamentaria',
    __name__,
    url_prefix='/despesa-orcamentaria'
)

# Instância única do serviço
despesa_service = DespesaOrcamentariaService()

# ============================================
# ROTAS DE PÁGINAS (Views)
# ============================================

@despesa_orcamentaria_bp.route('/')
def index():
    """Página principal com tabelas comparativas"""
    return render_template('despesa_orcamentaria/index.html')

@despesa_orcamentaria_bp.route('/dashboard')
def dashboard():
    """Dashboard com gráficos"""
    return render_template('despesa_orcamentaria/dashboard.html')

@despesa_orcamentaria_bp.route('/relatorio')
def relatorio():
    """Relatório detalhado"""
    return render_template('despesa_orcamentaria/relatorio.html')

# ============================================
# API PRINCIPAL - Endpoint único para dados
# ============================================

@despesa_orcamentaria_bp.route('/api/dados-completos', methods=['POST'])
def api_dados_completos():
    """
    Endpoint PRINCIPAL - retorna TODOS os dados processados
    
    Recebe:
    {
        "exercicio": 2025,
        "mes": 8,
        "ug": "110101" ou "CONSOLIDADO"
    }
    
    Retorna:
    {
        "success": true,
        "exercicio_atual": 2025,
        "exercicio_anterior": 2024,
        "demonstrativo": {
            "categorias": [...],
            "total_geral": {...}
        },
        "creditos": {
            "categorias": [...],
            "total_geral": {...}
        },
        "totais": {...}
    }
    """
    try:
        # Pegar parâmetros do request
        data = request.get_json() or {}
        
        # Debug: log dos dados recebidos
        logger.info(f"📥 Dados recebidos: {data}")
        
        exercicio = data.get('exercicio')
        mes = data.get('mes')
        ug = data.get('ug', 'CONSOLIDADO')
        
        # Converter para int se vier como string
        if isinstance(exercicio, str):
            exercicio = int(exercicio)
        if isinstance(mes, str):
            mes = int(mes)
        
        # Valores padrão se não vieram
        if exercicio is None:
            exercicio = 2025
        if mes is None:
            mes = 12
            
        # Validar parâmetros
        if not isinstance(exercicio, int) or exercicio < 2000 or exercicio > 2050:
            logger.error(f"❌ Exercício inválido: {exercicio}")
            return jsonify({
                'success': False,
                'message': f'Exercício inválido: {exercicio}'
            }), 400
        
        if not isinstance(mes, int) or mes < 1 or mes > 12:
            logger.error(f"❌ Mês inválido: {mes}")
            return jsonify({
                'success': False,
                'message': f'Mês inválido: {mes}'
            }), 400
        
        logger.info(f"📊 Processando: Exercício {exercicio}, Mês {mes}, UG {ug}")
        
        # Chamar o serviço que faz TUDO
        resultado = despesa_service.processar_dados_comparativo(
            exercicio=exercicio,
            mes=mes,
            ug=ug if ug != 'CONSOLIDADO' else None
        )
        
        # Log do resultado
        if resultado.get('success'):
            logger.info(f"✅ Processamento OK - {resultado.get('total_registros_atual', 0)} registros")
        else:
            logger.warning(f"⚠️ Processamento com problemas: {resultado.get('message', 'Sem mensagem')}")
        
        # Retornar resultado
        return jsonify(resultado)
        
    except Exception as e:
        logger.error(f"❌ Erro ao processar dados: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': f'Erro ao processar dados: {str(e)}'
        }), 500

# ============================================
# API - Endpoints auxiliares
# ============================================

@despesa_orcamentaria_bp.route('/api/ugs', methods=['GET'])
def api_listar_ugs():
    """
    Lista UGs disponíveis
    
    Query params:
    - todas: 'true' para listar todas, 'false' para apenas com movimento
    """
    try:
        mostrar_todas = request.args.get('todas', 'false').lower() == 'true'
        
        logger.info(f"🔍 Buscando UGs (todas={mostrar_todas})")
        
        ugs = despesa_service.obter_ugs_disponiveis(
            apenas_com_movimento=not mostrar_todas
        )
        
        return jsonify({
            'success': True,
            'unidades_gestoras': ugs,
            'total': len(ugs),
            'filtrado': not mostrar_todas
        })
        
    except Exception as e:
        logger.error(f"❌ Erro ao buscar UGs: {e}")
        return jsonify({
            'success': False,
            'message': str(e),
            'unidades_gestoras': []
        }), 500

@despesa_orcamentaria_bp.route('/api/exportar', methods=['POST'])
def api_exportar():
    """
    Exporta dados processados
    
    Recebe:
    {
        "exercicio": 2025,
        "mes": 8,
        "ug": "110101",
        "formato": "excel" ou "csv"
    }
    """
    try:
        data = request.get_json() or {}
        
        exercicio = data.get('exercicio', 2025)
        mes = data.get('mes', 12)
        ug = data.get('ug', 'CONSOLIDADO')
        formato = data.get('formato', 'excel')
        
        logger.info(f"📁 Exportando: {formato.upper()} - Exercício {exercicio}, Mês {mes}, UG {ug}")
        
        # Chamar serviço de exportação
        filepath = despesa_service.exportar_dados_processados(
            exercicio=exercicio,
            mes=mes,
            ug=ug if ug != 'CONSOLIDADO' else None,
            formato=formato
        )
        
        if filepath and Path(filepath).exists():
            return send_file(
                filepath,
                as_attachment=True,
                download_name=Path(filepath).name
            )
        else:
            return jsonify({
                'success': False,
                'message': 'Erro ao gerar arquivo'
            }), 500
            
    except Exception as e:
        logger.error(f"❌ Erro ao exportar: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/cache/limpar', methods=['POST'])
def api_limpar_cache():
    """Limpa o cache de dados"""
    try:
        despesa_service.limpar_cache()
        
        return jsonify({
            'success': True,
            'message': 'Cache limpo com sucesso'
        })
        
    except Exception as e:
        logger.error(f"❌ Erro ao limpar cache: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@despesa_orcamentaria_bp.route('/api/cache/status', methods=['GET'])
def api_cache_status():
    """Verifica status do cache"""
    try:
        tem_cache = False
        tamanho_cache = 0
        
        if despesa_service.cache:
            tem_cache = despesa_service.cache.existe()
            if tem_cache:
                df = despesa_service.cache.carregar()
                if df is not None:
                    tamanho_cache = len(df)
        
        return jsonify({
            'success': True,
            'cache_ativo': tem_cache,
            'registros_em_cache': tamanho_cache
        })
        
    except Exception as e:
        logger.error(f"❌ Erro ao verificar cache: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ============================================
# API - Endpoints de compatibilidade (legado)
# ============================================

@despesa_orcamentaria_bp.route('/api/dados', methods=['GET'])
def api_dados_legado():
    """
    Endpoint legado para compatibilidade
    Redireciona para o novo endpoint
    """
    try:
        # Pegar parâmetros e converter para o novo formato
        exercicio = int(request.args.get('exercicio', 2025))
        mes = int(request.args.get('mes', 12))
        ug = request.args.get('ug', 'CONSOLIDADO')
        
        # Chamar o serviço
        resultado = despesa_service.processar_dados_comparativo(
            exercicio=exercicio,
            mes=mes,
            ug=ug if ug != 'CONSOLIDADO' else None
        )
        
        # Adaptar resposta para formato legado (simplificado)
        if resultado['success']:
            # Extrair apenas dados do ano atual para compatibilidade
            dados_simplificados = []
            
            for categoria in resultado['demonstrativo']['categorias']:
                # Adicionar categoria
                dados_simplificados.append({
                    'CATEGORIA': categoria['id'],
                    'NOCATEGORIA': categoria['nome'],
                    'TIPO': 'CATEGORIA',
                    **categoria['valores_atual']
                })
                
                # Adicionar grupos
                for grupo in categoria['grupos']:
                    dados_simplificados.append({
                        'CATEGORIA': categoria['id'],
                        'GRUPO': grupo['id'],
                        'NOGRUPO': grupo['nome'],
                        'TIPO': 'GRUPO',
                        **grupo['valores_atual']
                    })
            
            return jsonify({
                'success': True,
                'dados': dados_simplificados,
                'total': len(dados_simplificados)
            })
        else:
            return jsonify(resultado), 404
            
    except Exception as e:
        logger.error(f"❌ Erro no endpoint legado: {e}")
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

# ============================================
# Tratamento de erros
# ============================================

@despesa_orcamentaria_bp.errorhandler(404)
def not_found(error):
    """Tratamento para rotas não encontradas"""
    return jsonify({
        'success': False,
        'message': 'Endpoint não encontrado'
    }), 404

@despesa_orcamentaria_bp.errorhandler(500)
def internal_error(error):
    """Tratamento para erros internos"""
    logger.error(f"Erro interno: {error}")
    return jsonify({
        'success': False,
        'message': 'Erro interno do servidor'
    }), 500

# ============================================
# Healthcheck
# ============================================

@despesa_orcamentaria_bp.route('/api/health', methods=['GET'])
def api_health():
    """Verifica saúde do serviço"""
    try:
        # Testar conexão com banco
        from config.database import get_db_manager
        db = get_db_manager()
        
        with db.get_cursor() as cursor:
            cursor.execute("SELECT 1 FROM DUAL")
            cursor.fetchone()
        
        return jsonify({
            'success': True,
            'status': 'healthy',
            'service': 'despesa_orcamentaria',
            'database': 'connected'
        })
        
    except Exception as e:
        logger.error(f"Healthcheck falhou: {e}")
        return jsonify({
            'success': False,
            'status': 'unhealthy',
            'error': str(e)
        }), 503