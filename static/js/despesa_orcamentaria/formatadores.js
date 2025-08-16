/**
 * formatadores.js - Funções de Formatação
 * Sistema de Despesa Orçamentária
 */

import { AppConfig } from './config.js';

const Formatadores = {
    /**
     * Formata valor monetário de forma compacta (mil, mi, bi)
     */
    moedaCompacta: function(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 'R$ 0,00';
        }
        
        const num = parseFloat(valor);
        const absNum = Math.abs(num);
        
        if (absNum >= 1000000000) {
            const bilhoes = (num / 1000000000).toFixed(2);
            return `R$ ${bilhoes.replace('.', ',')} bi`;
        } else if (absNum >= 1000000) {
            const milhoes = (num / 1000000).toFixed(2);
            return `R$ ${milhoes.replace('.', ',')} mi`;
        } else if (absNum >= 1000) {
            const milhares = (num / 1000).toFixed(2);
            return `R$ ${milhares.replace('.', ',')} mil`;
        } else {
            return new Intl.NumberFormat('pt-BR', AppConfig.formatoMoeda).format(num);
        }
    },

    /**
     * Formata valor monetário completo
     */
    moeda: function(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 'R$ 0,00';
        }
        const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
        return new Intl.NumberFormat('pt-BR', AppConfig.formatoMoeda).format(numero || 0);
    },

    /**
     * Formata número com separadores de milhar
     */
    numero: function(num) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0';
        }
        return new Intl.NumberFormat('pt-BR').format(num);
    },

    /**
     * Retorna nome do mês por número
     */
    nomeMes: function(numeroMes) {
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return meses[numeroMes - 1] || '';
    },

    /**
     * Formata data e hora
     */
    dataHora: function(date = new Date()) {
        return date.toLocaleString('pt-BR');
    }
};

export default Formatadores;