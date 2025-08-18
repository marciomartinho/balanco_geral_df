"""
Aplicação Flask - Sistema Refatorado usando templates existentes
"""

from flask import Flask, render_template, send_from_directory
from flask_cors import CORS
import logging
import sys
import os

# Adicionar o diretório ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_app():
    """Factory para criar aplicação Flask"""
    
    app = Flask(__name__,
                static_folder='static',  # Usar pasta static original
                template_folder='templates')  # Usar pasta templates original
    
    # Configurações
    app.config['SECRET_KEY'] = 'dev-key-mudar-em-producao'
    app.config['JSON_AS_ASCII'] = False
    app.config['JSON_SORT_KEYS'] = False
    
    # CORS
    CORS(app)
    
    # Registrar blueprints do NOVO sistema
    try:
        from backend.api.despesas import api_v1
        from backend.api.docs import docs_bp
        app.register_blueprint(api_v1)
        app.register_blueprint(docs_bp)
        logger.info("✅ APIs v1 registradas")
    except ImportError as e:
        logger.error(f"❌ Erro ao importar APIs novas: {e}")
    
    # Registrar blueprint ANTIGO também (para compatibilidade)
    try:
        from routes.despesa_orcamentaria_routes import despesa_orcamentaria_bp
        app.register_blueprint(despesa_orcamentaria_bp)
        logger.info("✅ Rotas antigas registradas (compatibilidade)")
    except ImportError as e:
        logger.warning(f"⚠️ Rotas antigas não encontradas: {e}")
        
    # ========================================
    # ROTAS DAS PÁGINAS (usando templates existentes)
    # ========================================
    
    @app.route('/')
    def index():
        """Página inicial - usa o template existente"""
        return render_template('index.html')
    
    @app.route('/despesa-orcamentaria')
    def despesa_orcamentaria():
        """Página de despesas - usa o template existente"""
        return render_template('despesa_orcamentaria/index.html')
    
    @app.route('/despesa-orcamentaria/dashboard')
    def dashboard():
        """Dashboard"""
        try:
            return render_template('despesa_orcamentaria/dashboard.html')
        except:
            return "<h1>Dashboard em desenvolvimento</h1>"
    
    @app.route('/despesa-orcamentaria/relatorio')
    def relatorio():
        """Relatório"""
        try:
            return render_template('despesa_orcamentaria/relatorio.html')
        except:
            return "<h1>Relatório em desenvolvimento</h1>"
    
    # ========================================
    # SERVIR ARQUIVOS ESTÁTICOS
    # ========================================
    
    @app.route('/static/<path:filename>')
    def static_files(filename):
        """Servir arquivos estáticos"""
        return send_from_directory('static', filename)
    
    @app.route('/frontend/<path:filename>')
    def frontend_files(filename):
        """Servir arquivos do frontend novo (se existir)"""
        return send_from_directory('frontend', filename)
    
    return app

if __name__ == '__main__':
    app = create_app()
    
    print("""
    ╔══════════════════════════════════════════════════════╗
    ║                                                      ║
    ║     Sistema de Balanço Geral DF - v2.0              ║
    ║     Rodando em: http://127.0.0.1:5001               ║
    ║                                                      ║
    ║     Páginas disponíveis:                            ║
    ║     • http://127.0.0.1:5001/                        ║
    ║     • http://127.0.0.1:5001/despesa-orcamentaria    ║
    ║                                                      ║
    ║     APIs disponíveis:                               ║
    ║     • http://127.0.0.1:5001/api/v1/info            ║
    ║     • http://127.0.0.1:5001/api/v1/docs/ui         ║
    ║                                                      ║
    ╚══════════════════════════════════════════════════════╝
    """)
    
    # Rodar na porta 5001
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=True
    )