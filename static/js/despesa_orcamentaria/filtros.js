/**
 * filtros.js - Processamento e Filtragem de Dados
 * Sistema de Despesa Orçamentária
 */

import { AppState } from './config.js';

const Filtros = {
    /**
     * Filtra dados conforme critérios
     */
    filtrarDados: function(dados, filtros) {
        if (!dados || dados.length === 0) return [];

        console.log('🔍 Aplicando filtros:', filtros);
        const inicio = Date.now();

        let dadosFiltrados = dados.filter(row => {
            const exercicio = parseInt(row.COEXERCICIO);
            const mes = parseInt(row.INMES);
            
            const exercicioValido = exercicio === filtros.exercicio;
            const mesValido = mes <= filtros.mes;
            
            let ugValida = true;
            if (filtros.ug && filtros.ug !== 'CONSOLIDADO') {
                const ugFiltro = String(filtros.ug).trim();
                const ugRow = String(row.COUG).trim();
                
                const ugFiltroNum = parseInt(ugFiltro);
                const ugRowNum = parseInt(ugRow);
                
                ugValida = (ugRow === ugFiltro) || 
                          (!isNaN(ugFiltroNum) && !isNaN(ugRowNum) && ugFiltroNum === ugRowNum);
            }
            
            return exercicioValido && mesValido && ugValida;
        });

        const tempo = Date.now() - inicio;
        console.log(`✅ Filtros aplicados em ${tempo}ms`);
        console.log(`📊 Resultado: ${dadosFiltrados.length} registros`);

        AppState.dadosFiltrados = dadosFiltrados;
        AppState.filtrosAtuais = filtros;

        return dadosFiltrados;
    },

    /**
     * Calcula totais das despesas
     */
    calcularTotais: function(dados) {
        const totais = {
            dotacao_inicial: 0,
            dotacao_adicional: 0,
            cancelamento_dotacao: 0,
            cancel_remaneja_dotacao: 0,
            dotacao_atualizada: 0,
            despesa_empenhada: 0,
            despesa_liquidada: 0,
            despesa_paga: 0,
            saldo_dotacao: 0
        };
        
        if (!dados || dados.length === 0) return totais;
        
        dados.forEach(row => {
            totais.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
            totais.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
            totais.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
            totais.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
            totais.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
            totais.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
            totais.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
        });
        
        totais.dotacao_atualizada = totais.dotacao_inicial + 
                                    totais.dotacao_adicional + 
                                    totais.cancelamento_dotacao + 
                                    totais.cancel_remaneja_dotacao;
        
        totais.saldo_dotacao = totais.dotacao_atualizada - totais.despesa_empenhada;
        
        return totais;
    },

    /**
     * Calcula totais dos créditos adicionais
     */
    calcularTotaisCreditos: function(dados) {
        const totais = {
            credito_suplementar: 0,
            credito_especial_aberto: 0,
            credito_especial_reaberto: 0,
            credito_extraordinario_reaberto: 0,
            cancel_credito_suplementar: 0,
            remanejamento_veto_lei: 0,
            cancel_credito_especial: 0,
            total_alteracoes: 0
        };
        
        if (!dados || dados.length === 0) return totais;
        
        dados.forEach(row => {
            totais.credito_suplementar += parseFloat(row.CREDITO_SUPLEMENTAR || 0);
            totais.credito_especial_aberto += parseFloat(row.CREDITO_ESPECIAL_ABERTO || 0);
            totais.credito_especial_reaberto += parseFloat(row.CREDITO_ESPECIAL_REABERTO || 0);
            totais.credito_extraordinario_reaberto += parseFloat(row.CREDITO_EXTRAORD_REABERTO || 0);
            totais.cancel_credito_suplementar += parseFloat(row.CANCEL_CREDITO_SUPLEMENTAR || 0);
            totais.remanejamento_veto_lei += parseFloat(row.REMANEJAMENTO_VETO_LEI || 0);
            totais.cancel_credito_especial += parseFloat(row.CANCEL_CREDITO_ESPECIAL || 0);
        });
        
        totais.total_alteracoes = totais.credito_suplementar + 
                                  totais.credito_especial_aberto + 
                                  totais.credito_especial_reaberto + 
                                  totais.credito_extraordinario_reaberto +
                                  totais.cancel_credito_suplementar +
                                  totais.remanejamento_veto_lei +
                                  totais.cancel_credito_especial;
        
        return totais;
    },

    /**
     * Cria objeto de valores zerados
     */
    criarObjetoValores: function() {
        return {
            dotacao_inicial: 0,
            dotacao_adicional: 0,
            cancelamento_dotacao: 0,
            cancel_remaneja_dotacao: 0,
            despesa_empenhada: 0,
            despesa_liquidada: 0,
            despesa_paga: 0
        };
    },

    /**
     * Cria objeto de valores de créditos zerados
     */
    criarObjetoValoresCreditos: function() {
        return {
            credito_suplementar: 0,
            credito_especial_aberto: 0,
            credito_especial_reaberto: 0,
            credito_extraordinario_reaberto: 0,
            cancel_credito_suplementar: 0,
            remanejamento_veto_lei: 0,
            cancel_credito_especial: 0,
            total_alteracoes: 0
        };
    }
};

export default Filtros;