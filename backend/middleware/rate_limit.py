"""
Middleware para rate limiting
"""

from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

def configurar_rate_limit(app):
    """
    Configura rate limiting para a API
    """
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        default_limits=["1000 per hour"],
        storage_uri="memory://"
    )
    
    # Limites específicos por endpoint
    limiter.limit("100 per minute")(app.view_functions['api_v1_despesas.listar_despesas'])
    limiter.limit("10 per minute")(app.view_functions['api_v1_despesas.exportar_dados'])
    limiter.limit("5 per minute")(app.view_functions['api_v1_despesas.limpar_cache'])
    
    return limiter