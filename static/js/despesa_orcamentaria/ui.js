/**
 * ui.js - Gerenciamento da Interface
 * Sistema de Despesa Orçamentária
 */

import Formatadores from './formatadores.js';
import { AppState } from './config.js';

const UI = {
    /**
     * Controla overlay de loading
     */
    toggleLoading: function(show, mensagem = 'Processando dados...') {
        const overlay = document.getElementById('loadingOverlay');
        if (!overlay) return;

        if (show) {
            overlay.classList.add('active');
            const msgElement = overlay.querySelector('.text-light.mt-3');
            if (msgElement) msgElement.textContent = mensagem;
        } else {
            overlay.classList.remove('active');
        }
    },

    /**
     * Mostra loading nos cards
     */
    mostrarLoadingCards: function() {
        const cards = ['totalRegistros', 'dotacaoInicial', 'despesaEmpenhada', 'despesaPaga'];
        cards.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.classList.add('loading');
                elemento.textContent = '...';
            }
        });
    },

    /**
     * Remove loading dos cards
     */
    removerLoadingCards: function() {
        const cards = ['totalRegistros', 'dotacaoInicial', 'despesaEmpenhada', 'despesaPaga'];
        cards.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.classList.remove('loading');
            }
        });
    },

    /**
     * Atualiza valor de um card com animação
     */
    atualizarValorCard: function(id, valor) {
        const elemento = document.getElementById(id);
        if (!elemento) return;
        
        elemento.style.transition = 'opacity 0.3s';
        elemento.style.opacity = '0.5';
        
        setTimeout(() => {
            elemento.textContent = valor;
            elemento.style.opacity = '1';
        }, 150);
    },

    /**
     * Mostra cards com valores zerados
     */
    mostrarCardsVazios: function() {
        this.atualizarValorCard('totalRegistros', '0');
        this.atualizarValorCard('dotacaoInicial', 'R$ 0,00');
        this.atualizarValorCard('despesaEmpenhada', 'R$ 0,00');
        this.atualizarValorCard('despesaPaga', 'R$ 0,00');
    },

    /**
     * Atualiza badge da UG selecionada
     */
    atualizarBadgeUG: function(ug) {
        const badge = document.getElementById('ugSelecionada');
        if (!badge) return;
        
        if (ug === 'CONSOLIDADO' || !ug) {
            badge.style.display = 'none';
        } else {
            const ugInfo = AppState.listaUGs?.find(u => u.codigo === ug);
            if (ugInfo) {
                badge.textContent = `${ugInfo.codigo} - ${ugInfo.nome}`;
            } else {
                badge.textContent = `UG: ${ug}`;
            }
            badge.style.display = 'inline-block';
        }
    },

    /**
     * Configura filtros com valores padrão
     */
    configurarFiltrosPadrao: function() {
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth() + 1;

        const selectExercicio = document.getElementById('exercicio');
        const selectMes = document.getElementById('mes');
        const selectUG = document.getElementById('unidadeGestora');

        if (selectExercicio) {
            if (![...selectExercicio.options].some(opt => opt.value == anoAtual)) {
                selectExercicio.add(new Option(anoAtual, anoAtual));
            }
            selectExercicio.value = anoAtual;
        }

        if (selectMes) {
            selectMes.value = mesAtual;
        }

        if (selectUG) {
            selectUG.value = 'CONSOLIDADO';
        }

        console.log(`📅 Filtros padrão: ${anoAtual} / ${Formatadores.nomeMes(mesAtual)} / CONSOLIDADO`);
        
        return { 
            exercicio: anoAtual, 
            mes: mesAtual,
            ug: 'CONSOLIDADO'
        };
    },

    /**
     * Mostra mensagem de erro
     */
    mostrarErro: function(mensagem) {
        console.error('❌ ERRO:', mensagem);
        alert('Erro: ' + mensagem);
    },

    /**
     * Mostra mensagem de sucesso
     */
    mostrarSucesso: function(mensagem) {
        console.log('✅ SUCESSO:', mensagem);
    },

    /**
     * Atualiza título das tabelas com info da UG
     */
    atualizarTitulosTabelas: function(ug) {
        const tituloUG = document.getElementById('tituloUG');
        const tituloUGCreditos = document.getElementById('tituloUGCreditos');
        
        if (ug && ug !== 'CONSOLIDADO') {
            const ugInfo = AppState.listaUGs?.find(u => u.codigo === ug);
            const texto = ugInfo ? `${ugInfo.codigo} - ${ugInfo.nome}` : `UG: ${ug}`;
            
            if (tituloUG) {
                tituloUG.textContent = texto;
                tituloUG.style.display = 'inline-block';
            }
            if (tituloUGCreditos) {
                tituloUGCreditos.textContent = texto;
                tituloUGCreditos.style.display = 'inline-block';
            }
        } else {
            if (tituloUG) tituloUG.style.display = 'none';
            if (tituloUGCreditos) tituloUGCreditos.style.display = 'none';
        }
    }
};

export default UI;