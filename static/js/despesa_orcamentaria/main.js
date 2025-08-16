/**
 * main.js - Arquivo Principal com Comparação de Anos SEMPRE ATIVA
 * Sistema de Despesa Orçamentária
 * Versão 5.0 - Com comparação padrão e detalhamento expansível
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
        
        // COMPARAÇÃO SEMPRE ATIVA
        const compararAnos = true;

        // Calcular exercício anterior
        const exercicioAnterior = exercicio - 1;

        console.log(`📅 Filtros selecionados:`);
        console.log(`   - Exercício: ${exercicio}`);
        console.log(`   - Mês: ${mes} (${Formatadores.nomeMes(mes)})`);
        console.log(`   - UG: ${ug === 'CONSOLIDADO' ? 'CONSOLIDADO (todas)' : ug}`);
        console.log(`   - Comparando com ${exercicioAnterior}: Sim (padrão)`);

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

        // Buscar dados do ano anterior (sempre)
        UI.toggleLoading(true, `Filtrando dados de ${exercicioAnterior}...`);
        const dadosFiltradosAnterior = Filtros.filtrarDados(dados, { 
            exercicio: exercicioAnterior, 
            mes,
            ug
        });

        console.log(`📊 Dados ${exercicio}: ${dadosFiltradosAtual.length} registros`);
        console.log(`📊 Dados ${exercicioAnterior}: ${dadosFiltradosAnterior.length} registros`);

        // Salvar dados filtrados no estado para uso na expansão
        AppState.dadosFiltrados = dadosFiltradosAtual;

        // Calcular totais
        const totaisAtual = Filtros.calcularTotais(dadosFiltradosAtual);
        AppState.totaisCalculados = totaisAtual;

        const totaisAnterior = Filtros.calcularTotais(dadosFiltradosAnterior);
        
        // Atualizar cards com comparação
        UI.removerLoadingCards();
        atualizarCardsComComparacao(dadosFiltradosAtual, dadosFiltradosAnterior, totaisAtual, totaisAnterior);

        // Renderizar tabelas comparativas
        UI.toggleLoading(true, 'Montando demonstrativo comparativo...');
        const totaisTabela = TabelaDemonstrativo.renderizar(dadosFiltradosAtual, dadosFiltradosAnterior);

        UI.toggleLoading(true, 'Montando quadro de créditos...');
        const totaisCreditos = TabelaCreditos.renderizar(dadosFiltradosAtual);

        // Mostrar informações de comparação
        mostrarInfoComparacao(exercicio, exercicioAnterior, mes);

        // Debug info
        if (AppConfig.debug) {
            console.log('===== RESUMO DA CONSULTA COMPARATIVA =====');
            console.log(`Total de registros ${exercicio}:`, dadosFiltradosAtual.length);
            console.log(`Total de registros ${exercicioAnterior}:`, dadosFiltradosAnterior.length);
            
            if (ug !== 'CONSOLIDADO') {
                const ugInfo = AppState.listaUGs?.find(u => u.codigo === ug);
                console.log('UG Selecionada:', ugInfo ? `${ugInfo.codigo} - ${ugInfo.nome}` : ug);
            }
            
            console.log(`Valores ${exercicio}:`);
            console.log('   Dotação:', Formatadores.moedaCompacta(totaisAtual.dotacao_inicial));
            console.log('   Empenhada:', Formatadores.moedaCompacta(totaisAtual.despesa_empenhada));
            console.log('   Paga:', Formatadores.moedaCompacta(totaisAtual.despesa_paga));
            
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
    const textoRegistros = `${Formatadores.numero(dadosAtual.length)} (${dadosAnterior.length} em ${new Date().getFullYear() - 1})`;
    UI.atualizarValorCard('totalRegistros', textoRegistros);

    // Card de dotação inicial
    UI.atualizarValorCard('dotacaoInicial', Formatadores.moedaCompacta(totaisAtual.dotacao_inicial));

    // Card de despesa empenhada com variação
    let textoEmpenhada = Formatadores.moedaCompacta(totaisAtual.despesa_empenhada);
    if (totaisAnterior && totaisAnterior.despesa_empenhada > 0) {
        const varEmpenhada = ((totaisAtual.despesa_empenhada / totaisAnterior.despesa_empenhada - 1) * 100).toFixed(1);
        const sinalEmpenhada = varEmpenhada > 0 ? '▲' : '▼';
        const corEmpenhada = varEmpenhada > 0 ? 'green' : 'red';
        
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
        
        const cardPaga = document.getElementById('despesaPaga');
        if (cardPaga) {
            cardPaga.innerHTML = `${textoPaga} <small style="color: ${corPaga}; display: block; font-size: 0.75rem; margin-top: 5px;">${sinalPaga} ${Math.abs(varPaga)}%</small>`;
        }
    } else {
        UI.atualizarValorCard('despesaPaga', textoPaga);
    }
}

function mostrarInfoComparacao(exercicio, exercicioAnterior, mes) {
    const infoPeriodo = document.getElementById('infoPeriodoComparacao');
    const textoPeriodo = document.getElementById('textoPeriodoComparacao');
    
    if (infoPeriodo && textoPeriodo) {
        infoPeriodo.style.display = 'block';
        const nomeMes = Formatadores.nomeMes(mes);
        textoPeriodo.textContent = `Comparando Janeiro-${nomeMes}/${exercicio} com Janeiro-${nomeMes}/${exercicioAnterior}`;
    }
}

// ============================================================================
// FUNÇÕES DE EXPANSÃO/COLAPSO (CORRIGIDA)
// ============================================================================

window.toggleGrupoDetalhes = async function(catId, grupoId) {
    const detalheId = `detalhes-${catId}-${grupoId}`;
    const btn = document.getElementById(`btn-${catId}-${grupoId}`);
    const icon = btn?.querySelector('i');
    
    let detalhesRow = document.getElementById(detalheId);
    
    if (detalhesRow) {
        // Se já existe, remover
        detalhesRow.remove();
        if (icon) {
            icon.classList.remove('fa-minus-square');
            icon.classList.add('fa-plus-square');
        }
    } else {
        // Criar nova linha de detalhes
        UI.toggleLoading(true, 'Carregando detalhes...');
        
        try {
            // Buscar detalhes do grupo para ambos os anos
            const dadosFiltrados = AppState.dadosFiltrados;
            if (!dadosFiltrados) {
                throw new Error('Dados não disponíveis. Execute uma consulta primeiro.');
            }
            
            // Obter dados do ano anterior também
            const exercicio = parseInt(document.getElementById('exercicio').value);
            const exercicioAnterior = exercicio - 1;
            const mes = parseInt(document.getElementById('mes').value);
            const ug = document.getElementById('unidadeGestora').value;
            
            // Filtrar dados do ano anterior
            const dadosAnterior = AppState.dadosCompletos ? 
                Filtros.filtrarDados(AppState.dadosCompletos, {
                    exercicio: exercicioAnterior,
                    mes,
                    ug
                }) : [];
            
            const detalhes = obterDetalhesGrupoComparativo(dadosFiltrados, dadosAnterior, catId, grupoId);
            
            // Criar e inserir linha de detalhes
            const grupoRow = btn?.closest('tr');
            if (grupoRow && detalhes.length > 0) {
                const novaLinha = criarLinhaDetalhes(detalheId, detalhes);
                grupoRow.insertAdjacentElement('afterend', novaLinha);
                
                if (icon) {
                    icon.classList.remove('fa-plus-square');
                    icon.classList.add('fa-minus-square');
                }
            } else if (detalhes.length === 0) {
                UI.mostrarErro('Nenhum detalhe encontrado para este grupo');
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            UI.mostrarErro('Erro ao carregar detalhes do grupo: ' + error.message);
        } finally {
            UI.toggleLoading(false);
        }
    }
};

function obterDetalhesGrupoComparativo(dadosAtual, dadosAnterior, catId, grupoId) {
    // Função auxiliar para processar dados
    const processarDados = (dados) => {
        const dadosGrupo = dados.filter(row => 
            String(row.CATEGORIA) === String(catId) && 
            String(row.GRUPO) === String(grupoId)
        );
        
        const detalhesMap = new Map();
        
        dadosGrupo.forEach(row => {
            // Usar apenas CONATUREZA (sem COFONTE)
            const natureza = row.CONATUREZA ? String(row.CONATUREZA) : 'SEM_NATUREZA';
            const chave = natureza;
            
            if (!detalhesMap.has(chave)) {
                detalhesMap.set(chave, {
                    natureza: natureza,
                    valores: Filtros.criarObjetoValores()
                });
            }
            
            const detalhe = detalhesMap.get(chave);
            detalhe.valores.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
            detalhe.valores.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
            detalhe.valores.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
            detalhe.valores.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
            detalhe.valores.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
            detalhe.valores.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
            detalhe.valores.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
        });
        
        return detalhesMap;
    };
    
    // Processar dados do ano atual
    const detalhesAtualMap = processarDados(dadosAtual);
    
    // Processar dados do ano anterior
    const detalhesAnteriorMap = processarDados(dadosAnterior);
    
    // Combinar os resultados
    const resultado = [];
    
    detalhesAtualMap.forEach((detalheAtual, chave) => {
        const detalheAnterior = detalhesAnteriorMap.get(chave);
        
        resultado.push({
            natureza: detalheAtual.natureza,
            valores: detalheAtual.valores,
            valoresAnterior: detalheAnterior ? detalheAnterior.valores : Filtros.criarObjetoValores()
        });
    });
    
    // Adicionar detalhes que só existem no ano anterior
    detalhesAnteriorMap.forEach((detalheAnterior, chave) => {
        if (!detalhesAtualMap.has(chave)) {
            resultado.push({
                natureza: detalheAnterior.natureza,
                valores: Filtros.criarObjetoValores(),
                valoresAnterior: detalheAnterior.valores
            });
        }
    });
    
    // Ordenar resultados por natureza
    resultado.sort((a, b) => {
        const naturezaA = String(a.natureza || '');
        const naturezaB = String(b.natureza || '');
        
        if (typeof naturezaA.localeCompare === 'function') {
            return naturezaA.localeCompare(naturezaB);
        }
        return naturezaA < naturezaB ? -1 : (naturezaA > naturezaB ? 1 : 0);
    });
    
    console.log(`Detalhes comparativos: ${resultado.length} naturezas únicas`);
    
    return resultado;
}

function obterDetalhesGrupo(dados, catId, grupoId) {
    // Filtrar dados do grupo específico
    const dadosGrupo = dados.filter(row => 
        String(row.CATEGORIA) === String(catId) && 
        String(row.GRUPO) === String(grupoId)
    );
    
    console.log(`Filtrando detalhes: Categoria ${catId}, Grupo ${grupoId}`);
    console.log(`Registros encontrados: ${dadosGrupo.length}`);
    
    // Agrupar por natureza e fonte
    const detalhesMap = new Map();
    
    dadosGrupo.forEach(row => {
        // Garantir que natureza e fonte sejam strings válidas
        const natureza = row.CONATUREZA ? String(row.CONATUREZA) : 'SEM_NATUREZA';
        const fonte = row.COFONTE ? String(row.COFONTE) : 'SEM_FONTE';
        const chave = `${natureza}-${fonte}`;
        
        if (!detalhesMap.has(chave)) {
            detalhesMap.set(chave, {
                natureza: natureza,
                fonte: fonte,
                valores: Filtros.criarObjetoValores()
            });
        }
        
        const detalhe = detalhesMap.get(chave);
        detalhe.valores.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
        detalhe.valores.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
        detalhe.valores.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
        detalhe.valores.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
        detalhe.valores.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
        detalhe.valores.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
        detalhe.valores.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
    });
    
    // Converter Map para Array e ordenar com fallback seguro
    const resultado = Array.from(detalhesMap.values()).sort((a, b) => {
        const naturezaA = String(a.natureza || '');
        const naturezaB = String(b.natureza || '');
        const fonteA = String(a.fonte || '');
        const fonteB = String(b.fonte || '');
        
        // Comparar natureza primeiro
        if (naturezaA !== naturezaB) {
            // Usar localeCompare se disponível, senão comparação simples
            if (typeof naturezaA.localeCompare === 'function') {
                return naturezaA.localeCompare(naturezaB);
            }
            return naturezaA < naturezaB ? -1 : (naturezaA > naturezaB ? 1 : 0);
        }
        
        // Depois comparar fonte
        if (typeof fonteA.localeCompare === 'function') {
            return fonteA.localeCompare(fonteB);
        }
        return fonteA < fonteB ? -1 : (fonteA > fonteB ? 1 : 0);
    });
    
    console.log(`Detalhes agrupados: ${resultado.length} combinações natureza-fonte`);
    
    return resultado;
}

function criarLinhaDetalhes(id, detalhes) {
    const tr = document.createElement('tr');
    tr.id = id;
    tr.className = 'detalhes-row';
    
    // Criar célula única que ocupa toda a largura (13 colunas para tabela comparativa)
    const td = document.createElement('td');
    td.colSpan = 13;
    td.style.padding = '0';
    
    // Criar tabela interna para os detalhes SEM CABEÇALHO PRÓPRIO
    const tabelaInterna = document.createElement('table');
    tabelaInterna.className = 'table table-sm mb-0 tabela-detalhes-interna';
    tabelaInterna.style.width = '100%';
    tabelaInterna.style.tableLayout = 'fixed'; // Força larguras fixas
    
    // Corpo da tabela interna
    const tbody = document.createElement('tbody');
    
    detalhes.forEach(detalhe => {
        const dotacaoAtualizada = detalhe.valores.dotacao_atualizada || 
                                 (detalhe.valores.dotacao_inicial + 
                                  detalhe.valores.dotacao_adicional + 
                                  detalhe.valores.cancelamento_dotacao + 
                                  detalhe.valores.cancel_remaneja_dotacao);
        const saldo = dotacaoAtualizada - detalhe.valores.despesa_empenhada;
        
        // Calcular valores do ano anterior (se existirem)
        const empenhadaAnterior = detalhe.valoresAnterior?.despesa_empenhada || 0;
        const liquidadaAnterior = detalhe.valoresAnterior?.despesa_liquidada || 0;
        const pagaAnterior = detalhe.valoresAnterior?.despesa_paga || 0;
        
        // Calcular variações
        const varEmpenhada = calcularVariacaoPercentual(detalhe.valores.despesa_empenhada, empenhadaAnterior);
        const varLiquidada = calcularVariacaoPercentual(detalhe.valores.despesa_liquidada, liquidadaAnterior);
        const varPaga = calcularVariacaoPercentual(detalhe.valores.despesa_paga, pagaAnterior);
        
        const linha = document.createElement('tr');
        linha.className = 'detalhe-item';
        linha.innerHTML = `
            <td class="ps-5" style="width: 25%; min-width: 250px;">
                <small>${detalhe.natureza}</small>
            </td>
            <td class="text-end" style="width: 7%;">
                ${Formatadores.moeda(detalhe.valores.dotacao_inicial)}
            </td>
            <td class="text-end" style="width: 7%;">
                ${Formatadores.moeda(dotacaoAtualizada)}
            </td>
            <td class="text-end valor-ano-anterior" style="width: 7%;">
                ${Formatadores.moeda(empenhadaAnterior)}
            </td>
            <td class="text-end" style="width: 7%;">
                ${Formatadores.moeda(detalhe.valores.despesa_empenhada)}
            </td>
            <td class="text-end ${varEmpenhada.classe}" style="width: 4.5%; font-size: 0.7rem;">
                ${formatarVariacao(varEmpenhada)}
            </td>
            <td class="text-end valor-ano-anterior" style="width: 7%;">
                ${Formatadores.moeda(liquidadaAnterior)}
            </td>
            <td class="text-end" style="width: 7%;">
                ${Formatadores.moeda(detalhe.valores.despesa_liquidada)}
            </td>
            <td class="text-end ${varLiquidada.classe}" style="width: 4.5%; font-size: 0.7rem;">
                ${formatarVariacao(varLiquidada)}
            </td>
            <td class="text-end valor-ano-anterior" style="width: 7%;">
                ${Formatadores.moeda(pagaAnterior)}
            </td>
            <td class="text-end" style="width: 7%;">
                ${Formatadores.moeda(detalhe.valores.despesa_paga)}
            </td>
            <td class="text-end ${varPaga.classe}" style="width: 4.5%; font-size: 0.7rem;">
                ${formatarVariacao(varPaga)}
            </td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}" style="width: 7%;">
                <strong>${Formatadores.moeda(saldo)}</strong>
            </td>
        `;
        tbody.appendChild(linha);
    });
    
    tabelaInterna.appendChild(tbody);
    td.appendChild(tabelaInterna);
    tr.appendChild(td);
    
    return tr;
}

// Função auxiliar para calcular variação percentual
function calcularVariacaoPercentual(valorAtual, valorAnterior) {
    if (!valorAnterior || valorAnterior === 0) {
        if (valorAtual > 0) return { percentual: 100.00, classe: 'variacao-positiva' };
        return { percentual: 0, classe: 'variacao-neutra' };
    }
    
    const variacao = ((valorAtual / valorAnterior) - 1) * 100;
    
    let classe = 'variacao-neutra';
    if (variacao > 0) {
        classe = 'variacao-positiva';
    } else if (variacao < 0) {
        classe = 'variacao-negativa';
    }
    
    return { percentual: variacao, classe };
}

// Função auxiliar para formatar variação
function formatarVariacao(variacao) {
    if (variacao.classe === 'variacao-neutra' && variacao.percentual === 0) {
        return '-';
    }
    
    const sinal = variacao.percentual > 0 ? '+' : '';
    return `${sinal}${variacao.percentual.toFixed(2)}%`;
}

// ============================================================================
// FUNÇÕES DE EXPORTAÇÃO
// ============================================================================

async function exportarDados(formato) {
    try {
        UI.toggleLoading(true, `Exportando para ${formato.toUpperCase()}...`);

        const ug = document.getElementById('unidadeGestora').value;
        const exercicio = document.getElementById('exercicio').value;
        const mes = document.getElementById('mes').value;
        
        let nomeArquivo = `despesa_orcamentaria_${exercicio}_mes${mes}_comparativo_${new Date().toISOString().slice(0,10)}`;
        
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
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('===== APLICAÇÃO INICIADA =====');
    console.log('Timestamp:', Formatadores.dataHora());
    console.log('Versão: 5.0 - Comparação Padrão + Detalhamento Expansível');
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
    
    // Carregar dados iniciais
    console.log('📊 Carregando lista de UGs com movimentação...');
    await API.buscarUGs(false);
    
    console.log('📊 Iniciando consulta automática com comparação...');
    await consultarDados();
    
    console.log('===== INICIALIZAÇÃO COMPLETA =====');
    console.log('💡 Dicas:');
    console.log('   - Comparação com ano anterior sempre ativa');
    console.log('   - Clique no + ao lado dos grupos para expandir detalhes');
    console.log('   - debugDespesa() para ver estado da aplicação');
});

// ============================================================================
// EXPORTAR FUNÇÕES GLOBAIS
// ============================================================================

window.consultarDados = consultarDados;
window.exportarDados = exportarDados;
window.limparCache = limparCache;
window.debugDespesa = function() {
    console.log('===== DEBUG - ESTADO DA APLICAÇÃO =====');
    console.log('Configuração:', AppConfig);
    console.log('Estado:', {
        totalDadosCompletos: AppState.dadosCompletos?.length || 0,
        totalDadosFiltrados: AppState.dadosFiltrados?.length || 0,
        totalUGs: AppState.listaUGs?.length || 0,
        filtrosAtuais: AppState.filtrosAtuais,
        ultimaConsulta: AppState.ultimaConsulta
    });
    console.log('========================================');
};