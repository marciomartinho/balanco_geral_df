"""
Middleware para CORS e segurança
"""

from flask import Flask
from flask_cors import CORS

def configurar_cors(app: Flask):
    """
    Configura CORS para a aplicação
    """
    CORS(app, 
         resources={
             r"/api/*": {
                 "origins": [
                     "http://localhost:3000",
                     "http://localhost:5000",
                     "https://balanco.df.gov.br"
                 ],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "allow_headers": ["Content-Type", "Authorization"],
                 "expose_headers": ["Content-Range", "X-Total-Count"],
                 "supports_credentials": True,
                 "max_age": 3600
             }
         })