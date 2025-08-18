"""
Documentação automática da API usando OpenAPI/Swagger
"""

from flask import Blueprint, jsonify

docs_bp = Blueprint('api_docs', __name__)

def gerar_openapi_spec():
    """
    Gera especificação OpenAPI 3.0
    """
    return {
        "openapi": "3.0.0",
        "info": {
            "title": "API Despesas Orçamentárias GDF",
            "version": "1.0.0",
            "description": "API REST para consulta e análise de despesas orçamentárias do Governo do Distrito Federal",
            "contact": {
                "name": "Suporte Técnico",
                "email": "suporte@gdf.gov.br"
            }
        },
        "servers": [
            {
                "url": "/api/v1",
                "description": "Servidor de Produção"
            }
        ],
        "paths": {
            "/despesas": {
                "get": {
                    "summary": "Lista despesas orçamentárias",
                    "tags": ["Despesas"],
                    "parameters": [
                        {
                            "name": "exercicio",
                            "in": "query",
                            "required": True,
                            "schema": {
                                "type": "integer",
                                "minimum": 2020,
                                "maximum": 2030
                            },
                            "description": "Ano do exercício"
                        },
                        {
                            "name": "mes",
                            "in": "query",
                            "required": True,
                            "schema": {
                                "type": "integer",
                                "minimum": 1,
                                "maximum": 12
                            },
                            "description": "Mês de referência"
                        },
                        {
                            "name": "ug",
                            "in": "query",
                            "required": False,
                            "schema": {
                                "type": "string",
                                "default": "CONSOLIDADO"
                            },
                            "description": "Código da Unidade Gestora"
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Sucesso",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/DespesaResponse"
                                    }
                                }
                            }
                        },
                        "400": {
                            "description": "Parâmetros inválidos",
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/ErrorResponse"
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/ugs": {
                "get": {
                    "summary": "Lista unidades gestoras",
                    "tags": ["Unidades Gestoras"],
                    "parameters": [
                        {
                            "name": "ativas",
                            "in": "query",
                            "schema": {
                                "type": "boolean",
                                "default": True
                            },
                            "description": "Apenas UGs com movimento"
                        },
                        {
                            "name": "pagina",
                            "in": "query",
                            "schema": {
                                "type": "integer",
                                "default": 1
                            }
                        },
                        {
                            "name": "por_pagina",
                            "in": "query",
                            "schema": {
                                "type": "integer",
                                "default": 100
                            }
                        }
                    ],
                    "responses": {
                        "200": {
                            "description": "Lista de UGs"
                        }
                    }
                }
            },
            "/health": {
                "get": {
                    "summary": "Verifica saúde da API",
                    "tags": ["Sistema"],
                    "responses": {
                        "200": {
                            "description": "Sistema operacional"
                        },
                        "503": {
                            "description": "Sistema com problemas"
                        }
                    }
                }
            }
        },
        "components": {
            "schemas": {
                "DespesaResponse": {
                    "type": "object",
                    "properties": {
                        "success": {
                            "type": "boolean"
                        },
                        "data": {
                            "type": "object",
                            "properties": {
                                "demonstrativo": {
                                    "type": "object"
                                },
                                "creditos": {
                                    "type": "object"
                                },
                                "totais": {
                                    "type": "object"
                                }
                            }
                        },
                        "message": {
                            "type": "string"
                        },
                        "meta": {
                            "type": "object"
                        }
                    }
                },
                "ErrorResponse": {
                    "type": "object",
                    "properties": {
                        "success": {
                            "type": "boolean",
                            "example": False
                        },
                        "error": {
                            "type": "object",
                            "properties": {
                                "message": {
                                    "type": "string"
                                },
                                "code": {
                                    "type": "integer"
                                },
                                "details": {
                                    "type": "object"
                                }
                            }
                        }
                    }
                }
            }
        },
        "tags": [
            {
                "name": "Despesas",
                "description": "Operações relacionadas a despesas orçamentárias"
            },
            {
                "name": "Unidades Gestoras",
                "description": "Operações com UGs"
            },
            {
                "name": "Sistema",
                "description": "Informações e saúde do sistema"
            }
        ]
    }


@docs_bp.route('/api/v1/docs', methods=['GET'])
def get_openapi_spec():
    """Retorna especificação OpenAPI"""
    return jsonify(gerar_openapi_spec())


@docs_bp.route('/api/v1/docs/ui', methods=['GET'])
def swagger_ui():
    """Interface Swagger UI"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>API Docs - Despesas GDF</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui.css">
        <style>
            body { margin: 0; padding: 0; }
            #swagger-ui { max-width: 1200px; margin: 0 auto; }
        </style>
    </head>
    <body>
        <div id="swagger-ui"></div>
        <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@4/swagger-ui-bundle.js"></script>
        <script>
            window.onload = function() {
                SwaggerUIBundle({
                    url: '/api/v1/docs',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIBundle.SwaggerUIStandalonePreset
                    ],
                    layout: "BaseLayout"
                });
            }
        </script>
    </body>
    </html>
    """