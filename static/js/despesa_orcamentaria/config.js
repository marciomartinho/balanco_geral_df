/**
 * config.js - Configurações e Estado Global
 * Sistema de Despesa Orçamentária
 */

// Configurações globais da aplicação
const AppConfig = {
    debug: true,
    apiBaseUrl: '/despesa-orcamentaria/api',
    maxRegistros: 500000,
    formatoMoeda: {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }
};

// Estado global da aplicação
const AppState = {
    dadosCompletos: null,
    dadosFiltrados: null,
    filtrosAtuais: null,
    totaisCalculados: null,
    totaisCreditos: null,
    ultimaConsulta: null,
    listaUGs: null
};

// Estrutura das categorias de despesa (usado pelas tabelas)
const EstruturaCategorias = {
    '3': {
        nome: 'DESPESAS CORRENTES',
        grupos: {
            '1': 'PESSOAL E ENCARGOS SOCIAIS',
            '2': 'JUROS E ENCARGOS DA DÍVIDA',
            '3': 'OUTRAS DESPESAS CORRENTES'
        }
    },
    '4': {
        nome: 'DESPESAS DE CAPITAL',
        grupos: {
            '4': 'INVESTIMENTOS',
            '5': 'INVERSÕES FINANCEIRAS',
            '6': 'AMORTIZAÇÃO DA DÍVIDA'
        }
    },
    '9': {
        nome: 'RESERVA DE CONTINGÊNCIA',
        grupos: {}
    }
};

export { AppConfig, AppState, EstruturaCategorias };