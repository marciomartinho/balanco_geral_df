"""
Aplicação Flask Principal - Sistema de Balanço Geral DF
"""

from flask import Flask, render_template, jsonify
from flask_cors import CORS
import logging
from pathlib import Path
import os

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Factory function para criar a aplicação Flask"""
    
    # Criar aplicação Flask
    app = Flask(__name__)
    
    # Configurações
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    app.config['JSON_AS_ASCII'] = False  # Para suportar UTF-8 no JSON
    app.config['JSON_SORT_KEYS'] = False  # Manter ordem dos campos no JSON
    
    # Habilitar CORS com configurações específicas
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:5000", "http://127.0.0.1:5000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "supports_credentials": True
        }
    })
    
    # Registrar Blueprints
    try:
        from routes.despesa_orcamentaria_routes import despesa_orcamentaria_bp
        app.register_blueprint(despesa_orcamentaria_bp)
        logger.info("✅ Blueprint de Despesa Orçamentária registrado")
    except ImportError as e:
        logger.warning(f"⚠️ Não foi possível importar blueprint de despesa: {e}")
    
    # Rota principal
    @app.route('/')
    def index():
        """Página inicial do sistema"""
        try:
            return render_template('index.html')
        except Exception as e:
            logger.error(f"Erro ao renderizar index.html: {e}")
            return jsonify({"error": "Template não encontrado"}), 500
    
    # Rota de health check
    @app.route('/health')
    def health():
        """Endpoint para verificar se a aplicação está funcionando"""
        return jsonify({
            'status': 'healthy', 
            'message': 'Sistema funcionando',
            'timestamp': datetime.now().isoformat()
        }), 200
    
    # API de status
    @app.route('/api/status')
    def api_status():
        """Status da API com informações do sistema"""
        return jsonify({
            'status': 'online',
            'version': '1.0.0',
            'modules': {
                'despesa_orcamentaria': 'active',
                'receita_orcamentaria': 'in_development',
                'patrimonio': 'in_development'
            }
        }), 200
    
    # Tratamento de erros
    @app.errorhandler(404)
    def not_found(error):
        """Página de erro 404"""
        # Verificar se é uma requisição de API
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Endpoint não encontrado'}), 404
        
        # Tentar renderizar template 404, senão retornar mensagem simples
        try:
            return render_template('404.html'), 404
        except:
            return """
            <html>
                <head><title>404 - Página não encontrada</title></head>
                <body>
                    <h1>404 - Página não encontrada</h1>
                    <p>A página que você está procurando não existe.</p>
                    <a href="/">Voltar ao início</a>
                </body>
            </html>
            """, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        """Página de erro 500"""
        logger.error(f"Erro interno: {error}")
        
        # Verificar se é uma requisição de API
        if request.path.startswith('/api/'):
            return jsonify({'error': 'Erro interno do servidor'}), 500
        
        # Tentar renderizar template 500, senão retornar mensagem simples
        try:
            return render_template('500.html'), 500
        except:
            return """
            <html>
                <head><title>500 - Erro interno</title></head>
                <body>
                    <h1>500 - Erro interno do servidor</h1>
                    <p>Ocorreu um erro ao processar sua requisição.</p>
                    <a href="/">Voltar ao início</a>
                </body>
            </html>
            """, 500
    
    # Handler para OPTIONS (CORS preflight)
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", "*")
            response.headers.add('Access-Control-Allow-Headers', "*")
            response.headers.add('Access-Control-Allow-Methods', "*")
            return response
    
    # Adicionar headers de segurança
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response
    
    # Log de requisições
    @app.before_request
    def log_request():
        logger.info(f"{request.method} {request.path}")
    
    # Criar diretórios necessários
    create_directories()
    
    logger.info("✅ Aplicação Flask criada com sucesso")
    
    return app

def create_directories():
    """Cria os diretórios necessários se não existirem"""
    # Apenas diretórios essenciais que realmente precisam existir
    directories = [
        'static/css',
        'static/js',
        'static/img',
        'templates',
        'templates/despesa_orcamentaria',
        'exports/excel',
        'exports/csv',
        'exports/pdf'
    ]
    
    for directory in directories:
        dir_path = Path(directory)
        if not dir_path.exists():
            dir_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"📁 Diretório criado: {directory}")
    
    logger.info("📁 Diretórios essenciais verificados")

# Importações necessárias adicionais
from datetime import datetime
from flask import request, make_response

if __name__ == '__main__':
    # Verificar se estamos em desenvolvimento ou produção
    ENV = os.environ.get('FLASK_ENV', 'development')
    
    # Criar e executar a aplicação
    app = create_app()
    
    if ENV == 'development':
        # Configurações de desenvolvimento
        logger.info("🚀 Iniciando em modo DESENVOLVIMENTO")
        app.run(
            host='0.0.0.0',  # Disponível em toda a rede
            port=5000,
            debug=True,  # Modo debug ativo
            threaded=True,  # Permitir múltiplas requisições
            use_reloader=True  # Auto-reload quando arquivos mudam
        )
    else:
        # Configurações de produção
        logger.info("🚀 Iniciando em modo PRODUÇÃO")
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=False,  # Debug desativado em produção
            threaded=True
        )