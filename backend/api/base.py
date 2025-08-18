"""
Base da API - Configurações e utilitários comuns
"""

from flask import jsonify, request
from functools import wraps
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class ApiResponse:
    """Padroniza todas as respostas da API"""
    
    @staticmethod
    def sucesso(dados=None, mensagem=None, meta=None):
        """
        Resposta de sucesso padronizada
        
        Retorna:
        {
            "success": true,
            "data": {...},
            "message": "...",
            "meta": {
                "timestamp": "2025-01-01T12:00:00",
                "version": "1.0"
            }
        }
        """
        response = {
            'success': True,
            'data': dados,
            'message': mensagem,
            'meta': {
                'timestamp': datetime.now().isoformat(),
                'version': '1.0'
            }
        }
        
        if meta:
            response['meta'].update(meta)
        
        return jsonify(response), 200
    
    @staticmethod
    def erro(mensagem, codigo=400, detalhes=None):
        """
        Resposta de erro padronizada
        
        Retorna:
        {
            "success": false,
            "error": {
                "message": "...",
                "code": 400,
                "details": {...}
            },
            "meta": {...}
        }
        """
        response = {
            'success': False,
            'error': {
                'message': mensagem,
                'code': codigo,
                'details': detalhes
            },
            'meta': {
                'timestamp': datetime.now().isoformat(),
                'version': '1.0'
            }
        }
        
        return jsonify(response), codigo
    
    @staticmethod
    def lista(items, total=None, pagina=1, por_pagina=50, mensagem=None):
        """
        Resposta para listagens com paginação
        
        Retorna:
        {
            "success": true,
            "data": {
                "items": [...],
                "pagination": {
                    "total": 100,
                    "page": 1,
                    "per_page": 50,
                    "pages": 2
                }
            },
            "message": "...",
            "meta": {...}
        }
        """
        total = total or len(items)
        total_paginas = (total + por_pagina - 1) // por_pagina
        
        response = {
            'success': True,
            'data': {
                'items': items,
                'pagination': {
                    'total': total,
                    'page': pagina,
                    'per_page': por_pagina,
                    'pages': total_paginas
                }
            },
            'message': mensagem,
            'meta': {
                'timestamp': datetime.now().isoformat(),
                'version': '1.0'
            }
        }
        
        return jsonify(response), 200


def validar_parametros(**parametros_esperados):
    """
    Decorator para validar parâmetros da requisição
    
    Uso:
    @validar_parametros(
        exercicio={'tipo': int, 'obrigatorio': True, 'min': 2020, 'max': 2030},
        mes={'tipo': int, 'obrigatorio': True, 'min': 1, 'max': 12}
    )
    def minha_rota():
        ...
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            erros = []
            
            for param_nome, regras in parametros_esperados.items():
                # Pegar valor do request
                valor = request.args.get(param_nome) if request.method == 'GET' else \
                        request.json.get(param_nome) if request.json else None
                
                # Verificar obrigatório
                if regras.get('obrigatorio') and valor is None:
                    erros.append(f"Parâmetro '{param_nome}' é obrigatório")
                    continue
                
                if valor is not None:
                    # Verificar tipo
                    tipo_esperado = regras.get('tipo', str)
                    try:
                        if tipo_esperado == int:
                            valor = int(valor)
                        elif tipo_esperado == float:
                            valor = float(valor)
                        elif tipo_esperado == bool:
                            valor = str(valor).lower() in ['true', '1', 'yes']
                    except (ValueError, TypeError):
                        erros.append(f"Parâmetro '{param_nome}' deve ser do tipo {tipo_esperado.__name__}")
                        continue
                    
                    # Verificar min/max
                    if 'min' in regras and valor < regras['min']:
                        erros.append(f"Parâmetro '{param_nome}' deve ser >= {regras['min']}")
                    
                    if 'max' in regras and valor > regras['max']:
                        erros.append(f"Parâmetro '{param_nome}' deve ser <= {regras['max']}")
                    
                    # Verificar opções válidas
                    if 'opcoes' in regras and valor not in regras['opcoes']:
                        erros.append(f"Parâmetro '{param_nome}' deve ser um de: {regras['opcoes']}")
                    
                    # Adicionar ao kwargs
                    kwargs[param_nome] = valor
                elif not regras.get('obrigatorio'):
                    # Usar valor padrão se não obrigatório
                    kwargs[param_nome] = regras.get('padrao')
            
            # Se houver erros, retornar resposta de erro
            if erros:
                return ApiResponse.erro(
                    mensagem='Parâmetros inválidos',
                    codigo=400,
                    detalhes={'erros': erros}
                )
            
            return f(*args, **kwargs)
        
        return decorated_function
    return decorator


def log_requisicao(f):
    """
    Decorator para logar requisições
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Log da requisição
        logger.info(f"📥 {request.method} {request.path}")
        
        if request.args:
            logger.debug(f"Query params: {dict(request.args)}")
        
        if request.json:
            logger.debug(f"Body: {request.json}")
        
        # Executar função
        resultado = f(*args, **kwargs)
        
        # Log da resposta
        if isinstance(resultado, tuple):
            status_code = resultado[1]
            logger.info(f"📤 Resposta: {status_code}")
        
        return resultado
    
    return decorated_function


def tratar_erros(f):
    """
    Decorator para tratamento global de erros
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.error(f"Erro de validação: {e}")
            return ApiResponse.erro(str(e), 400)
        except KeyError as e:
            logger.error(f"Chave não encontrada: {e}")
            return ApiResponse.erro(f"Campo obrigatório ausente: {e}", 400)
        except Exception as e:
            logger.error(f"Erro não tratado: {e}", exc_info=True)
            return ApiResponse.erro(
                mensagem="Erro interno do servidor",
                codigo=500,
                detalhes={'erro': str(e)} if logger.level == logging.DEBUG else None
            )
    
    return decorated_function