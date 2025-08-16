/**
 * main.js - Arquivo Principal (Orquestrador)
 * Sistema de Despesa Orçamentária
 * Versão 3.0 - Refatorada com módulos
 */

import { AppConfig, AppState } from './config.js';
import Formatadores from './formatadores.js';
import UI from './ui.js';
import API from './api.js';
import Filtros from './filtros.js';
import { TabelaDemonstrativo, TabelaCreditos } from './tabelas.js';

// ============================================================================
// FUNÇÃO PRINCIPAL DE CONSULTA
// ============================================================================

async function consultarDados() {
    console.log('========== INICIANDO CONSULTA ==========');
    console.log('Timestamp:', Formatadores.dataHora());

    try {
        UI.mostrarLoadingCards();
        UI.toggleLoading(true, 'Consultando dados...');

        // Obter valores dos filtros
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);
        const ug = document.getElementById('unidadeGestora').value;

        console.log(`📅 Filtros selecionados:`);
        console.log(`   - Exercício: ${exercicio}`);
        console.log(`   - Mês: ${mes} (${Formatadores.nomeMes(mes)})`);
        console.log(`   - UG: ${ug === 'CONSOLIDADO' ? 'CONSOLIDADO (todas)' : ug}`);

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

        // Aplicar filtros
        UI.toggleLoading(true, 'Aplicando filtros...');
        const dadosFiltrados = Filtros.filtrarDados(dados, { 
            exercicio, 
            mes,
            ug
        });

        // Calcular totais
        const totais = Filtros.calcularTotais(dadosFiltrados);
        AppState.totaisCalculados = totais;
        
        // Atualizar cards
        UI.removerLoadingCards();
        UI.atualizarValorCard('totalRegistros', Formatadores.numero(dadosFiltrados.length));
        UI.atualizarValorCard('dotacaoInicial', Formatadores.moedaCompacta(totais.dotacao_inicial));
        UI.atualizarValorCard('despesaEmpenhada', Formatadores.moedaCompacta(totais.despesa_empenhada));
        UI.atualizarValorCard('despesaPaga', Formatadores.moedaCompacta(totais.despesa_paga));

        // Renderizar tabelas
        UI.toggleLoading(true, 'Montando demonstrativo...');
        const totaisTabela = TabelaDemonstrativo.renderizar(dadosFiltrados);

        UI.toggleLoading(true, 'Montando quadro de créditos...');
        const totaisCreditos = TabelaCreditos.renderizar(dadosFiltrados);

        // Debug info
        if (AppConfig.debug) {
            console.log('===== RESUMO DA CONSULTA =====');
            console.log('Total de registros:', dadosFiltrados.length);
            
            if (ug !== 'CONSOLIDADO') {
                const ugInfo = AppState.listaUGs?.find(u => u.codigo === ug);
                console.log('UG Selecionada:', ugInfo ? `${ugInfo.codigo} - ${ugInfo.nome}` : ug);
            }
            
            console.log('Valores calculados:');
            console.log('   Dotação:', Formatadores.moedaCompacta(totais.dotacao_inicial));
            console.log('   Empenhada:', Formatadores.moedaCompacta(totais.despesa_empenhada));
            console.log('   Paga:', Formatadores.moedaCompacta(totais.despesa_paga));
            
            if (AppState.totaisCreditos) {
                console.log('Créditos Adicionais:');
                console.log('   Total Alterações:', Formatadores.moedaCompacta(AppState.totaisCreditos.total_alteracoes));
            }
            
            console.log('================================');
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
// FUNÇÕES DE EXPORTAÇÃO
// ============================================================================

async function exportarDados(formato) {
    try {
        UI.toggleLoading(true, `Exportando para ${formato.toUpperCase()}...`);

        const ug = document.getElementById('unidadeGestora').value;
        let nomeArquivo = `despesa_orcamentaria_${new Date().toISOString().slice(0,10)}`;
        
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
    
    if (AppState.totaisCreditos) {
        console.log('Totais de Créditos:', {
            credito_suplementar: Formatadores.moedaCompacta(AppState.totaisCreditos.credito_suplementar),
            credito_especial_aberto: Formatadores.moedaCompacta(AppState.totaisCreditos.credito_especial_aberto),
            credito_especial_reaberto: Formatadores.moedaCompacta(AppState.totaisCreditos.credito_especial_reaberto),
            credito_extraordinario_reaberto: Formatadores.moedaCompacta(AppState.totaisCreditos.credito_extraordinario_reaberto),
            total_alteracoes: Formatadores.moedaCompacta(AppState.totaisCreditos.total_alteracoes)
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
    console.log('Versão: 3.0 - Refatorada com Módulos');
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
    
    if (selectExercicio) {
        selectExercicio.addEventListener('change', async function() {
            console.log('📅 Exercício alterado, recarregando UGs...');
            
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
            console.log('📅 Mês alterado, recarregando UGs...');
            
            const selectUG = document.getElementById('unidadeGestora');
            if (selectUG) {
                selectUG.value = 'CONSOLIDADO';
            }
            
            await consultarDados();
            await API.buscarUGs(false);
        });
    }
    
    // Carregar dados iniciais
    console.log('📊 Carregando lista de UGs com movimentação...');
    await API.buscarUGs(false);
    
    console.log('📊 Iniciando consulta automática...');
    await consultarDados();
    
    console.log('===== INICIALIZAÇÃO COMPLETA =====');
    console.log('💡 Dicas de debug:');
    console.log('   - debugDespesa() para ver estado da aplicação');
    console.log('   - listarUGs() para ver UGs carregadas');
    console.log('   - consultarDados() para recarregar dados');
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