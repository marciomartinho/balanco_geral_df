"""
Aplicação Flask - Configuração principal
"""

from flask import Flask
from backend.api.despesas import api_v1
from backend.api.docs import docs_bp
from backend.paginas.rotas import paginas_bp
from backend.middleware.cors import configurar_cors
from backend.middleware.rate_limit import configurar_rate_limit
import logging

def criar_app(config='production'):
    """
    Factory para criar a aplicação Flask
    """
    app = Flask(__name__, 
                static_folder='../frontend/scripts',
                template_folder='../frontend/paginas')
    
    # Configurações
    app.config['JSON_SORT_KEYS'] = False
    app.config['JSON_AS_ASCII'] = False
    
    # Logging
    logging.basicConfig(
        level=logging.INFO if config == 'production' else logging.DEBUG,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Middleware
    configurar_cors(app)
    configurar_rate_limit(app)
    
    # Registrar blueprints
    app.register_blueprint(api_v1)
    app.register_blueprint(docs_bp)
    app.register_blueprint(paginas_bp)
    
    # Rota raiz da API
    @app.route('/api')
    def api_root():
        return {
            'message': 'API de Despesas Orçamentárias - GDF',
            'version': '1.0',
            'documentation': '/api/v1/docs/ui',
            'endpoints': {
                'v1': '/api/v1'
            }
        }
    
    return app

# Criar instância
app = criar_app()

if __name__ == '__main__':
    app.run(debug=True)