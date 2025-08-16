/**
 * main.js - Arquivo Principal com Comparação de Anos
 * Sistema de Despesa Orçamentária
 * Versão 4.0 - Com análise comparativa vertical
 */

import { AppConfig, AppState } from './config.js';
import Formatadores from './formatadores.js';
import UI from './ui.js';
import API from './api.js';
import Filtros from './filtros.js';
import { TabelaDemonstrativo, TabelaCreditos } from './tabelas.js';

// ============================================================================
// FUNÇÃO PRINCIPAL DE CONSULTA COMPARATIVA
// ============================================================================

async function consultarDados() {
    console.log('========== INICIANDO CONSULTA COMPARATIVA ==========');
    console.log('Timestamp:', Formatadores.dataHora());

    try {
        UI.mostrarLoadingCards();
        UI.toggleLoading(true, 'Consultando dados...');

        // Obter valores dos filtros
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);
        const ug = document.getElementById('unidadeGestora').value;
        const compararAnos = document.getElementById('compararAnoAnterior')?.checked ?? true;

        // Calcular exercício anterior
        const exercicioAnterior = exercicio - 1;

        console.log(`📅 Filtros selecionados:`);
        console.log(`   - Exercício: ${exercicio}`);
        console.log(`   - Mês: ${mes} (${Formatadores.nomeMes(mes)})`);
        console.log(`   - UG: ${ug === 'CONSOLIDADO' ? 'CONSOLIDADO (todas)' : ug}`);
        console.log(`   - Comparar com ${exercicioAnterior}: ${compararAnos ? 'Sim' : 'Não'}`);

        // Atualizar interface
        UI.atualizarBadgeUG(ug);
        UI.atualizarTitulosTabelas(ug);

        // Buscar dados se necessário
        UI.toggleLoading(true, 'Carregando dados...');
        
        let dados = AppState.dadosCompletos;
        if (!dados) {
            dados = await API.buscarDados();
            
            if (!AppState.listaUGs) {
                await API.buscarUGs();
            }
        }

        // Aplicar filtros para ano atual
        UI.toggleLoading(true, 'Filtrando dados do ano atual...');
        const dadosFiltradosAtual = Filtros.filtrarDados(dados, { 
            exercicio, 
            mes,
            ug
        });

        // Se comparação ativada, buscar dados do ano anterior
        let dadosFiltradosAnterior = null;
        if (compararAnos) {
            UI.toggleLoading(true, `Filtrando dados de ${exercicioAnterior}...`);
            dadosFiltradosAnterior = Filtros.filtrarDados(dados, { 
                exercicio: exercicioAnterior, 
                mes,
                ug
            });

            console.log(`📊 Dados ${exercicioAnterior}: ${dadosFiltradosAnterior.length} registros`);
        }

        // Calcular totais
        const totaisAtual = Filtros.calcularTotais(dadosFiltradosAtual);
        AppState.totaisCalculados = totaisAtual;

        let totaisAnterior = null;
        if (dadosFiltradosAnterior) {
            totaisAnterior = Filtros.calcularTotais(dadosFiltradosAnterior);
        }
        
        // Atualizar cards com comparação
        UI.removerLoadingCards();
        atualizarCardsComComparacao(dadosFiltradosAtual, dadosFiltradosAnterior, totaisAtual, totaisAnterior);

        // Renderizar tabelas comparativas
        UI.toggleLoading(true, 'Montando demonstrativo comparativo...');
        const totaisTabela = TabelaDemonstrativo.renderizar(dadosFiltradosAtual, dadosFiltradosAnterior);

        UI.toggleLoading(true, 'Montando quadro de créditos...');
        const totaisCreditos = TabelaCreditos.renderizar(dadosFiltradosAtual);

        // Mostrar informações de comparação
        mostrarInfoComparacao(exercicio, exercicioAnterior, mes, compararAnos);

        // Debug info
        if (AppConfig.debug) {
            console.log('===== RESUMO DA CONSULTA COMPARATIVA =====');
            console.log(`Total de registros ${exercicio}:`, dadosFiltradosAtual.length);
            if (dadosFiltradosAnterior) {
                console.log(`Total de registros ${exercicioAnterior}:`, dadosFiltradosAnterior.length);
            }
            
            if (ug !== 'CONSOLIDADO') {
                const ugInfo = AppState.listaUGs?.find(u => u.codigo === ug);
                console.log('UG Selecionada:', ugInfo ? `${ugInfo.codigo} - ${ugInfo.nome}` : ug);
            }
            
            console.log(`Valores ${exercicio}:`);
            console.log('   Dotação:', Formatadores.moedaCompacta(totaisAtual.dotacao_inicial));
            console.log('   Empenhada:', Formatadores.moedaCompacta(totaisAtual.despesa_empenhada));
            console.log('   Paga:', Formatadores.moedaCompacta(totaisAtual.despesa_paga));
            
            if (totaisAnterior) {
                console.log(`Valores ${exercicioAnterior}:`);
                console.log('   Dotação:', Formatadores.moedaCompacta(totaisAnterior.dotacao_inicial));
                console.log('   Empenhada:', Formatadores.moedaCompacta(totaisAnterior.despesa_empenhada));
                console.log('   Paga:', Formatadores.moedaCompacta(totaisAnterior.despesa_paga));
                
                // Calcular variações
                const varEmpenhada = totaisAnterior.despesa_empenhada > 0 ? 
                    ((totaisAtual.despesa_empenhada / totaisAnterior.despesa_empenhada - 1) * 100).toFixed(1) : 
                    'N/A';
                const varPaga = totaisAnterior.despesa_paga > 0 ? 
                    ((totaisAtual.despesa_paga / totaisAnterior.despesa_paga - 1) * 100).toFixed(1) : 
                    'N/A';
                
                console.log('Variações:');
                console.log(`   Empenhada: ${varEmpenhada}%`);
                console.log(`   Paga: ${varPaga}%`);
            }
            
            console.log('============================================');
        }

        AppState.ultimaConsulta = new Date();
        UI.mostrarSucesso('Dados carregados com sucesso!');

    } catch (error) {
        console.error('❌ Erro na consulta:', error);
        UI.mostrarErro(error.message || 'Erro ao consultar dados');
        UI.mostrarCardsVazios();
    } finally {
        UI.toggleLoading(false);
        UI.removerLoadingCards();
        console.log('========== CONSULTA FINALIZADA ==========');
    }
}

// ============================================================================
// FUNÇÕES DE COMPARAÇÃO
// ============================================================================

function atualizarCardsComComparacao(dadosAtual, dadosAnterior, totaisAtual, totaisAnterior) {
    // Card de registros
    const textoRegistros = dadosAnterior ? 
        `${Formatadores.numero(dadosAtual.length)} (${dadosAnterior.length} em ${new Date().getFullYear() - 1})` :
        Formatadores.numero(dadosAtual.length);
    UI.atualizarValorCard('totalRegistros', textoRegistros);

    // Card de dotação inicial
    UI.atualizarValorCard('dotacaoInicial', Formatadores.moedaCompacta(totaisAtual.dotacao_inicial));

    // Card de despesa empenhada com variação
    let textoEmpenhada = Formatadores.moedaCompacta(totaisAtual.despesa_empenhada);
    if (totaisAnterior && totaisAnterior.despesa_empenhada > 0) {
        const varEmpenhada = ((totaisAtual.despesa_empenhada / totaisAnterior.despesa_empenhada - 1) * 100).toFixed(1);
        const sinalEmpenhada = varEmpenhada > 0 ? '▲' : '▼';
        const corEmpenhada = varEmpenhada > 0 ? 'green' : 'red';
        
        // Adicionar variação ao card
        const cardEmpenhada = document.getElementById('despesaEmpenhada');
        if (cardEmpenhada) {
            cardEmpenhada.innerHTML = `${textoEmpenhada} <small style="color: ${corEmpenhada}; display: block; font-size: 0.75rem; margin-top: 5px;">${sinalEmpenhada} ${Math.abs(varEmpenhada)}%</small>`;
        }
    } else {
        UI.atualizarValorCard('despesaEmpenhada', textoEmpenhada);
    }

    // Card de despesa paga com variação
    let textoPaga = Formatadores.moedaCompacta(totaisAtual.despesa_paga);
    if (totaisAnterior && totaisAnterior.despesa_paga > 0) {
        const varPaga = ((totaisAtual.despesa_paga / totaisAnterior.despesa_paga - 1) * 100).toFixed(1);
        const sinalPaga = varPaga > 0 ? '▲' : '▼';
        const corPaga = varPaga > 0 ? 'green' : 'red';
        
        // Adicionar variação ao card
        const cardPaga = document.getElementById('despesaPaga');
        if (cardPaga) {
            cardPaga.innerHTML = `${textoPaga} <small style="color: ${corPaga}; display: block; font-size: 0.75rem; margin-top: 5px;">${sinalPaga} ${Math.abs(varPaga)}%</small>`;
        }
    } else {
        UI.atualizarValorCard('despesaPaga', textoPaga);
    }
}

function mostrarInfoComparacao(exercicio, exercicioAnterior, mes, ativo) {
    const infoPeriodo = document.getElementById('infoPeriodoComparacao');
    const textoPeriodo = document.getElementById('textoPeriodoComparacao');
    
    if (infoPeriodo && textoPeriodo) {
        if (ativo) {
            infoPeriodo.style.display = 'block';
            const nomeMes = Formatadores.nomeMes(mes);
            textoPeriodo.textContent = `Comparando Janeiro-${nomeMes}/${exercicio} com Janeiro-${nomeMes}/${exercicioAnterior}`;
        } else {
            infoPeriodo.style.display = 'none';
        }
    }
}

// ============================================================================
// EVENT LISTENER PARA TOGGLE DE COMPARAÇÃO
// ============================================================================

function toggleComparacao() {
    const checkbox = document.getElementById('compararAnoAnterior');
    if (checkbox) {
        console.log(`📊 Comparação de anos: ${checkbox.checked ? 'Ativada' : 'Desativada'}`);
        consultarDados();
    }
}

// ============================================================================
// FUNÇÕES DE EXPORTAÇÃO (mantém original)
// ============================================================================

async function exportarDados(formato) {
    try {
        UI.toggleLoading(true, `Exportando para ${formato.toUpperCase()}...`);

        const ug = document.getElementById('unidadeGestora').value;
        const exercicio = document.getElementById('exercicio').value;
        const mes = document.getElementById('mes').value;
        const compararAnos = document.getElementById('compararAnoAnterior')?.checked ?? true;
        
        let nomeArquivo = `despesa_orcamentaria_${exercicio}_mes${mes}_${new Date().toISOString().slice(0,10)}`;
        
        if (compararAnos) {
            nomeArquivo += '_comparativo';
        }
        
        if (ug && ug !== 'CONSOLIDADO') {
            nomeArquivo += `_UG_${ug}`;
        }

        const sucesso = await API.exportarDados(formato, nomeArquivo, ug);
        
        if (sucesso) {
            UI.mostrarSucesso(`Dados exportados para ${formato.toUpperCase()}`);
        }
    } catch (error) {
        UI.mostrarErro(error.message);
    } finally {
        UI.toggleLoading(false);
    }
}

async function limparCache() {
    if (!confirm('Deseja realmente limpar o cache? A próxima consulta será mais demorada.')) {
        return;
    }

    try {
        UI.toggleLoading(true, 'Limpando cache...');

        const sucesso = await API.limparCache();
        
        if (sucesso) {
            UI.mostrarSucesso('Cache limpo com sucesso!');
            
            // Recarregar dados
            await API.buscarUGs();
            await consultarDados();
        }
    } catch (error) {
        UI.mostrarErro('Erro ao limpar cache');
    } finally {
        UI.toggleLoading(false);
    }
}

// ============================================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================================

async function toggleTodasUGs() {
    const mostrarTodas = confirm('Deseja mostrar TODAS as UGs, mesmo sem movimentação?');
    
    if (mostrarTodas) {
        console.log('🔄 Carregando TODAS as UGs...');
        await API.buscarUGs(true);
        console.log('✅ Mostrando todas as UGs');
    } else {
        console.log('🔄 Carregando apenas UGs com movimentação...');
        await API.buscarUGs(false);
        console.log('✅ Mostrando apenas UGs com movimentação');
    }
}

function limparFiltroUG() {
    const selectUG = document.getElementById('unidadeGestora');
    if (selectUG) {
        selectUG.value = 'CONSOLIDADO';
        // Trigger change se usando Select2
        if (window.jQuery && window.jQuery(selectUG).data('select2')) {
            window.jQuery(selectUG).trigger('change');
        }
        consultarDados();
    }
}

// ============================================================================
// FUNÇÕES DE DEBUG
// ============================================================================

function debugDespesa() {
    console.log('===== DEBUG - ESTADO DA APLICAÇÃO =====');
    console.log('Configuração:', AppConfig);
    console.log('Estado:', {
        totalDadosCompletos: AppState.dadosCompletos?.length || 0,
        totalDadosFiltrados: AppState.dadosFiltrados?.length || 0,
        totalUGs: AppState.listaUGs?.length || 0,
        filtrosAtuais: AppState.filtrosAtuais,
        ultimaConsulta: AppState.ultimaConsulta
    });
    
    if (AppState.totaisCalculados) {
        console.log('Totais calculados:', {
            dotacao_inicial: Formatadores.moedaCompacta(AppState.totaisCalculados.dotacao_inicial),
            dotacao_atualizada: Formatadores.moedaCompacta(AppState.totaisCalculados.dotacao_atualizada),
            despesa_empenhada: Formatadores.moedaCompacta(AppState.totaisCalculados.despesa_empenhada),
            despesa_paga: Formatadores.moedaCompacta(AppState.totaisCalculados.despesa_paga),
            saldo: Formatadores.moedaCompacta(AppState.totaisCalculados.saldo_dotacao)
        });
    }
    
    console.log('========================================');
}

function listarUGs() {
    if (!AppState.listaUGs || AppState.listaUGs.length === 0) {
        console.log('❌ Nenhuma UG carregada. Execute consultarDados() primeiro.');
        return;
    }
    
    console.log('===== LISTA DE UNIDADES GESTORAS =====');
    console.log(`Total: ${AppState.listaUGs.length} UGs`);
    console.log('');
    
    AppState.listaUGs.forEach(ug => {
        console.log(`${ug.codigo} - ${ug.nome}`);
    });
    
    console.log('=======================================');
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('===== APLICAÇÃO INICIADA =====');
    console.log('Timestamp:', Formatadores.dataHora());
    console.log('Versão: 4.0 - Com Análise Comparativa');
    console.log('Debug:', AppConfig.debug ? 'ATIVADO' : 'DESATIVADO');
    
    // Verificar elementos essenciais
    const elementosRequeridos = [
        'tabelaCorpo', 'tabelaCorpoCreditos', 'exercicio', 'mes', 'unidadeGestora',
        'totalRegistros', 'dotacaoInicial', 'despesaEmpenhada', 'despesaPaga'
    ];
    
    let todosPresentes = true;
    elementosRequeridos.forEach(id => {
        const elemento = document.getElementById(id);
        if (!elemento) {
            console.error(`❌ Elemento #${id} não encontrado`);
            todosPresentes = false;
        }
    });
    
    if (!todosPresentes) {
        console.error('❌ Alguns elementos essenciais não foram encontrados');
        return;
    }
    
    // Configurar filtros padrão
    UI.configurarFiltrosPadrao();
    
    // Configurar event listeners
    const selectExercicio = document.getElementById('exercicio');
    const selectMes = document.getElementById('mes');
    const checkboxComparar = document.getElementById('compararAnoAnterior');
    
    if (selectExercicio) {
        selectExercicio.addEventListener('change', async function() {
            console.log('📅 Exercício alterado, recarregando dados...');
            
            const selectUG = document.getElementById('unidadeGestora');
            if (selectUG) {
                selectUG.value = 'CONSOLIDADO';
            }
            
            await consultarDados();
            await API.buscarUGs(false);
        });
    }
    
    if (selectMes) {
        selectMes.addEventListener('change', async function() {
            console.log('📅 Mês alterado, recarregando dados...');
            
            const selectUG = document.getElementById('unidadeGestora');
            if (selectUG) {
                selectUG.value = 'CONSOLIDADO';
            }
            
            await consultarDados();
            await API.buscarUGs(false);
        });
    }
    
    if (checkboxComparar) {
        checkboxComparar.addEventListener('change', toggleComparacao);
    }
    
    // Carregar dados iniciais
    console.log('📊 Carregando lista de UGs com movimentação...');
    await API.buscarUGs(false);
    
    console.log('📊 Iniciando consulta automática com comparação...');
    await consultarDados();
    
    console.log('===== INICIALIZAÇÃO COMPLETA =====');
    console.log('💡 Dicas de debug:');
    console.log('   - debugDespesa() para ver estado da aplicação');
    console.log('   - listarUGs() para ver UGs carregadas');
    console.log('   - consultarDados() para recarregar dados');
    console.log('   - Toggle comparação de anos no checkbox');
});

// ============================================================================
// EXPORTAR FUNÇÕES GLOBAIS (para uso no HTML)
// ============================================================================

window.consultarDados = consultarDados;
window.exportarDados = exportarDados;
window.limparCache = limparCache;
window.toggleTodasUGs = toggleTodasUGs;
window.limparFiltroUG = limparFiltroUG;
window.debugDespesa = debugDespesa;
window.listarUGs = listarUGs;
window.toggleComparacao = toggleComparacao;