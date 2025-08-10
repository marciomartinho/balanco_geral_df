"""
Rotas principais da aplicação UBAN
"""

from flask import Blueprint, render_template, request, jsonify, flash, redirect, url_for
from flask_login import login_required, current_user
from app import db
from datetime import datetime

bp = Blueprint('main', __name__)


@bp.route('/')
@bp.route('/home')
def index():
    """Página inicial do sistema"""
    return render_template('home.html')


@bp.route('/dashboard')
@login_required
def dashboard():
    """Dashboard principal com métricas e gráficos"""
    # Aqui você pode adicionar lógica para buscar dados do banco
    metrics = {
        'receita_total': 1500000.00,
        'despesa_total': 1200000.00,
        'saldo': 300000.00,
        'percentual_executado': 80.5
    }
    
    return render_template('dashboard.html', metrics=metrics)


@bp.route('/sobre')
def about():
    """Página sobre o sistema"""
    return render_template('about.html')


@bp.route('/contato')
def contact():
    """Página de contato"""
    return render_template('contact.html')


@bp.route('/api/status')
def api_status():
    """Endpoint para verificar status da aplicação"""
    return jsonify({
        'status': 'online',
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0',
        'database': 'connected'
    })


@bp.route('/api/metrics')
@login_required
def api_metrics():
    """API para retornar métricas do dashboard"""
    # Simula dados - substituir por consulta real ao banco
    data = {
        'receitas': {
            'previsto': 2000000,
            'realizado': 1500000,
            'percentual': 75
        },
        'despesas': {
            'autorizado': 1800000,
            'empenhado': 1200000,
            'liquidado': 1000000,
            'pago': 900000
        },
        'grafico_mensal': [
            {'mes': 'Jan', 'receita': 150000, 'despesa': 120000},
            {'mes': 'Fev', 'receita': 180000, 'despesa': 140000},
            {'mes': 'Mar', 'receita': 200000, 'despesa': 160000},
            {'mes': 'Abr', 'receita': 170000, 'despesa': 150000},
            {'mes': 'Mai', 'receita': 190000, 'despesa': 180000},
            {'mes': 'Jun', 'receita': 210000, 'despesa': 170000},
        ]
    }
    return jsonify(data)


@bp.errorhandler(404)
def not_found(error):
    """Página de erro 404"""
    return render_template('errors/404.html'), 404


@bp.errorhandler(500)
def internal_error(error):
    """Página de erro 500"""
    db.session.rollback()
    return render_template('errors/500.html'), 500