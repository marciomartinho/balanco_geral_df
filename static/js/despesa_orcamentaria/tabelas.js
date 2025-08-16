/**
 * tabelas.js - Renderização de Tabelas com Comparação de Anos
 * Sistema de Despesa Orçamentária
 * Versão 4.0 - Com análise comparativa vertical
 */

import Formatadores from './formatadores.js';
import { EstruturaCategorias, AppState } from './config.js';
import Filtros from './filtros.js';

/**
 * Renderizador da Tabela de Demonstrativo Comparativo
 */
const TabelaDemonstrativo = {
    renderizar: function(dadosAnoAtual, dadosAnoAnterior = null) {
        console.log('📊 Renderizando tabela demonstrativo comparativa...');
        
        const tbody = document.getElementById('tabelaCorpo');
        if (!tbody) {
            console.error('❌ Elemento tabelaCorpo não encontrado!');
            return;
        }

        tbody.innerHTML = '';

        // Verificar se deve fazer comparação
        const compararAnos = document.getElementById('compararAnoAnterior')?.checked ?? true;
        
        if (!dadosAnoAtual || dadosAnoAtual.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${compararAnos ? '13' : '7'}" class="text-center py-4">
                        <i class="fas fa-inbox text-muted"></i>
                        <p class="text-muted mt-2">Nenhum dado disponível para o período selecionado</p>
                    </td>
                </tr>`;
            return;
        }

        // Atualizar cabeçalhos com anos corretos
        this.atualizarCabecalhosAnos();

        // Agregar dados
        const agregadosAtual = this.agregarDados(dadosAnoAtual);
        const agregadosAnterior = compararAnos && dadosAnoAnterior ? 
            this.agregarDados(dadosAnoAnterior) : null;

        // Renderizar linhas comparativas
        const totalGeral = compararAnos ? 
            this.renderizarLinhasComparativas(tbody, agregadosAtual, agregadosAnterior) :
            this.renderizarLinhasSimples(tbody, agregadosAtual);
        
        return totalGeral;
    },

    atualizarCabecalhosAnos: function() {
        const exercicio = parseInt(document.getElementById('exercicio')?.value || new Date().getFullYear());
        const exercicioAnterior = exercicio - 1;
        const mes = parseInt(document.getElementById('mes')?.value || 12);
        const nomeMes = Formatadores.nomeMes(mes);

        // Atualizar anos nos cabeçalhos
        document.querySelectorAll('#anoAtualDotacao, #anoAtualDotacaoAtual, #anoAtualSaldo').forEach(el => {
            if (el) el.textContent = `(${exercicio})`;
        });

        document.querySelectorAll('#anoAtualEmpenhada, #anoAtualLiquidada, #anoAtualPaga').forEach(el => {
            if (el) el.textContent = exercicio;
        });

        document.querySelectorAll('#anoAnteriorEmpenhada, #anoAnteriorLiquidada, #anoAnteriorPaga').forEach(el => {
            if (el) el.textContent = exercicioAnterior;
        });

        // Atualizar período de comparação
        const infoPeriodo = document.getElementById('infoPeriodoComparacao');
        const textoPeriodo = document.getElementById('textoPeriodoComparacao');
        
        if (infoPeriodo && textoPeriodo) {
            infoPeriodo.style.display = 'block';
            textoPeriodo.textContent = `Comparando Jan-${nomeMes}/${exercicio} com Jan-${nomeMes}/${exercicioAnterior}`;
        }
    },

    agregarDados: function(dados) {
        const agregados = {};

        // Inicializar estrutura
        Object.entries(EstruturaCategorias).forEach(([catId, catInfo]) => {
            agregados[catId] = {
                nome: catInfo.nome,
                valores: Filtros.criarObjetoValores(),
                grupos: {}
            };

            Object.entries(catInfo.grupos).forEach(([grupoId, grupoNome]) => {
                agregados[catId].grupos[grupoId] = {
                    nome: grupoNome,
                    valores: Filtros.criarObjetoValores()
                };
            });
        });

        // Agregar dados
        dados.forEach(row => {
            const catId = String(row.CATEGORIA || '0');
            const grupoId = String(row.GRUPO || '0');

            if (agregados[catId]) {
                this.somarValores(agregados[catId].valores, row);

                if (agregados[catId].grupos[grupoId]) {
                    this.somarValores(agregados[catId].grupos[grupoId].valores, row);
                }
            }
        });

        return agregados;
    },

    somarValores: function(agregado, row) {
        agregado.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
        agregado.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
        agregado.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
        agregado.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
        agregado.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
        agregado.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
        agregado.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
    },

    calcularVariacao: function(valorAtual, valorAnterior) {
        if (!valorAnterior || valorAnterior === 0) {
            if (valorAtual > 0) return { percentual: 100.00, classe: 'variacao-positiva' };
            return { percentual: 0, classe: 'variacao-neutra' };
        }
        
        const variacao = ((valorAtual / valorAnterior) - 1) * 100;
        
        // Sempre positiva ou negativa baseado no sinal, não no valor
        let classe = 'variacao-neutra';
        if (variacao > 0) {
            classe = 'variacao-positiva';
        } else if (variacao < 0) {
            classe = 'variacao-negativa';
        }
        
        return { percentual: variacao, classe };
    },

    formatarVariacao: function(variacao) {
        if (variacao.classe === 'variacao-neutra' && variacao.percentual === 0) {
            return '-';
        }
        
        const sinal = variacao.percentual > 0 ? '+' : '';
        return `${sinal}${variacao.percentual.toFixed(2)}%`;
    },

    renderizarLinhasComparativas: function(tbody, agregadosAtual, agregadosAnterior) {
        const totalGeralAtual = Filtros.criarObjetoValores();
        const totalGeralAnterior = agregadosAnterior ? Filtros.criarObjetoValores() : null;

        // Renderizar categorias e grupos
        ['3', '4', '9'].forEach(catId => {
            const categoriaAtual = agregadosAtual[catId];
            if (!categoriaAtual) return;

            const valoresAtual = categoriaAtual.valores;
            if (this.isValoresVazios(valoresAtual)) return;

            const valoresAnterior = agregadosAnterior?.[catId]?.valores || Filtros.criarObjetoValores();
            
            const dotacaoAtualizadaAtual = this.calcularDotacaoAtualizada(valoresAtual);
            const saldoAtual = dotacaoAtualizadaAtual - valoresAtual.despesa_empenhada;

            tbody.appendChild(this.criarLinhaCategoriaComparativa(
                categoriaAtual.nome, 
                valoresAtual, 
                valoresAnterior,
                dotacaoAtualizadaAtual, 
                saldoAtual
            ));

            this.somarAoTotal(totalGeralAtual, valoresAtual);
            if (totalGeralAnterior && valoresAnterior) {
                this.somarAoTotal(totalGeralAnterior, valoresAnterior);
            }

            // Renderizar grupos
            const ordemGrupos = catId === '3' ? ['1', '2', '3'] : 
                               catId === '4' ? ['4', '5', '6'] : [];

            ordemGrupos.forEach(grupoId => {
                const grupoAtual = categoriaAtual.grupos[grupoId];
                if (!grupoAtual || this.isValoresVazios(grupoAtual.valores)) return;

                const grupoAnterior = agregadosAnterior?.[catId]?.grupos[grupoId]?.valores || Filtros.criarObjetoValores();
                
                const dotAtualGrupo = this.calcularDotacaoAtualizada(grupoAtual.valores);
                const saldoGrupo = dotAtualGrupo - grupoAtual.valores.despesa_empenhada;

                tbody.appendChild(this.criarLinhaGrupoComparativa(
                    grupoAtual.nome, 
                    grupoAtual.valores, 
                    grupoAnterior,
                    dotAtualGrupo, 
                    saldoGrupo
                ));
            });
        });

        // Renderizar total geral
        const dotacaoAtualizadaTotal = this.calcularDotacaoAtualizada(totalGeralAtual);
        const saldoTotal = dotacaoAtualizadaTotal - totalGeralAtual.despesa_empenhada;
        
        tbody.appendChild(this.criarLinhaTotalComparativa(
            totalGeralAtual, 
            totalGeralAnterior,
            dotacaoAtualizadaTotal, 
            saldoTotal
        ));
        
        return {
            dotacao_inicial: totalGeralAtual.dotacao_inicial,
            dotacao_atualizada: dotacaoAtualizadaTotal,
            despesa_empenhada: totalGeralAtual.despesa_empenhada,
            despesa_liquidada: totalGeralAtual.despesa_liquidada,
            despesa_paga: totalGeralAtual.despesa_paga,
            saldo: saldoTotal
        };
    },

    criarLinhaCategoriaComparativa: function(nome, valoresAtual, valoresAnterior, dotacaoAtualizada, saldo) {
        const varEmpenhada = this.calcularVariacao(valoresAtual.despesa_empenhada, valoresAnterior.despesa_empenhada);
        const varLiquidada = this.calcularVariacao(valoresAtual.despesa_liquidada, valoresAnterior.despesa_liquidada);
        const varPaga = this.calcularVariacao(valoresAtual.despesa_paga, valoresAnterior.despesa_paga);

        const tr = document.createElement('tr');
        tr.className = 'categoria-row';
        tr.innerHTML = `
            <td><strong>${nome}</strong></td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.dotacao_inicial)}</td>
            <td class="text-end">${Formatadores.moeda(dotacaoAtualizada)}</td>
            <td class="text-end valor-ano-anterior col-empenhada">${Formatadores.moeda(valoresAnterior.despesa_empenhada)}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.despesa_empenhada)}</td>
            <td class="text-end ${varEmpenhada.classe}">${this.formatarVariacao(varEmpenhada)}</td>
            <td class="text-end valor-ano-anterior col-liquidada">${Formatadores.moeda(valoresAnterior.despesa_liquidada)}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.despesa_liquidada)}</td>
            <td class="text-end ${varLiquidada.classe}">${this.formatarVariacao(varLiquidada)}</td>
            <td class="text-end valor-ano-anterior col-paga">${Formatadores.moeda(valoresAnterior.despesa_paga)}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.despesa_paga)}</td>
            <td class="text-end ${varPaga.classe}">${this.formatarVariacao(varPaga)}</td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}">${Formatadores.moeda(saldo)}</td>
        `;
        return tr;
    },

    criarLinhaGrupoComparativa: function(nome, valoresAtual, valoresAnterior, dotacaoAtualizada, saldo) {
        const varEmpenhada = this.calcularVariacao(valoresAtual.despesa_empenhada, valoresAnterior.despesa_empenhada);
        const varLiquidada = this.calcularVariacao(valoresAtual.despesa_liquidada, valoresAnterior.despesa_liquidada);
        const varPaga = this.calcularVariacao(valoresAtual.despesa_paga, valoresAnterior.despesa_paga);

        const tr = document.createElement('tr');
        tr.className = 'grupo-row';
        tr.innerHTML = `
            <td class="ps-4">${nome}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.dotacao_inicial)}</td>
            <td class="text-end">${Formatadores.moeda(dotacaoAtualizada)}</td>
            <td class="text-end valor-ano-anterior col-empenhada">${Formatadores.moeda(valoresAnterior.despesa_empenhada)}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.despesa_empenhada)}</td>
            <td class="text-end ${varEmpenhada.classe}">${this.formatarVariacao(varEmpenhada)}</td>
            <td class="text-end valor-ano-anterior col-liquidada">${Formatadores.moeda(valoresAnterior.despesa_liquidada)}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.despesa_liquidada)}</td>
            <td class="text-end ${varLiquidada.classe}">${this.formatarVariacao(varLiquidada)}</td>
            <td class="text-end valor-ano-anterior col-paga">${Formatadores.moeda(valoresAnterior.despesa_paga)}</td>
            <td class="text-end">${Formatadores.moeda(valoresAtual.despesa_paga)}</td>
            <td class="text-end ${varPaga.classe}">${this.formatarVariacao(varPaga)}</td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}">${Formatadores.moeda(saldo)}</td>
        `;
        return tr;
    },

    criarLinhaTotalComparativa: function(valoresAtual, valoresAnterior, dotacaoAtualizada, saldo) {
        const varEmpenhada = this.calcularVariacao(valoresAtual.despesa_empenhada, valoresAnterior?.despesa_empenhada || 0);
        const varLiquidada = this.calcularVariacao(valoresAtual.despesa_liquidada, valoresAnterior?.despesa_liquidada || 0);
        const varPaga = this.calcularVariacao(valoresAtual.despesa_paga, valoresAnterior?.despesa_paga || 0);

        const tr = document.createElement('tr');
        tr.className = 'total-row';
        tr.innerHTML = `
            <td><strong>TOTAL GERAL</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.dotacao_inicial)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(dotacaoAtualizada)}</strong></td>
            <td class="text-end valor-ano-anterior col-empenhada"><strong>${Formatadores.moeda(valoresAnterior?.despesa_empenhada || 0)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.despesa_empenhada)}</strong></td>
            <td class="text-end ${varEmpenhada.classe}"><strong>${this.formatarVariacao(varEmpenhada)}</strong></td>
            <td class="text-end valor-ano-anterior col-liquidada"><strong>${Formatadores.moeda(valoresAnterior?.despesa_liquidada || 0)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.despesa_liquidada)}</strong></td>
            <td class="text-end ${varLiquidada.classe}"><strong>${this.formatarVariacao(varLiquidada)}</strong></td>
            <td class="text-end valor-ano-anterior col-paga"><strong>${Formatadores.moeda(valoresAnterior?.despesa_paga || 0)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.despesa_paga)}</strong></td>
            <td class="text-end ${varPaga.classe}"><strong>${this.formatarVariacao(varPaga)}</strong></td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}">
                <strong>${Formatadores.moeda(saldo)}</strong>
            </td>
        `;
        return tr;
    },

    renderizarLinhasSimples: function(tbody, agregados) {
        // Renderização sem comparação (mantém formato original)
        const totalGeral = Filtros.criarObjetoValores();

        ['3', '4', '9'].forEach(catId => {
            const categoria = agregados[catId];
            if (!categoria) return;

            const valores = categoria.valores;
            if (this.isValoresVazios(valores)) return;

            const dotacaoAtualizada = this.calcularDotacaoAtualizada(valores);
            const saldo = dotacaoAtualizada - valores.despesa_empenhada;

            tbody.appendChild(this.criarLinhaCategoria(categoria.nome, valores, dotacaoAtualizada, saldo));
            this.somarAoTotal(totalGeral, valores);

            const ordemGrupos = catId === '3' ? ['1', '2', '3'] : 
                               catId === '4' ? ['4', '5', '6'] : [];

            ordemGrupos.forEach(grupoId => {
                const grupo = categoria.grupos[grupoId];
                if (!grupo || this.isValoresVazios(grupo.valores)) return;

                const dotAtualGrupo = this.calcularDotacaoAtualizada(grupo.valores);
                const saldoGrupo = dotAtualGrupo - grupo.valores.despesa_empenhada;

                tbody.appendChild(this.criarLinhaGrupo(grupo.nome, grupo.valores, dotAtualGrupo, saldoGrupo));
            });
        });

        const dotacaoAtualizadaTotal = this.calcularDotacaoAtualizada(totalGeral);
        const saldoTotal = dotacaoAtualizadaTotal - totalGeral.despesa_empenhada;
        tbody.appendChild(this.criarLinhaTotal(totalGeral, dotacaoAtualizadaTotal, saldoTotal));
        
        return {
            dotacao_inicial: totalGeral.dotacao_inicial,
            dotacao_atualizada: dotacaoAtualizadaTotal,
            despesa_empenhada: totalGeral.despesa_empenhada,
            despesa_liquidada: totalGeral.despesa_liquidada,
            despesa_paga: totalGeral.despesa_paga,
            saldo: saldoTotal
        };
    },

    criarLinhaCategoria: function(nome, valores, dotacaoAtualizada, saldo) {
        const tr = document.createElement('tr');
        tr.className = 'categoria-row';
        tr.innerHTML = `
            <td><strong>${nome}</strong></td>
            <td class="text-end">${Formatadores.moeda(valores.dotacao_inicial)}</td>
            <td class="text-end">${Formatadores.moeda(dotacaoAtualizada)}</td>
            <td class="text-end">${Formatadores.moeda(valores.despesa_empenhada)}</td>
            <td class="text-end">${Formatadores.moeda(valores.despesa_liquidada)}</td>
            <td class="text-end">${Formatadores.moeda(valores.despesa_paga)}</td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}">${Formatadores.moeda(saldo)}</td>
        `;
        return tr;
    },

    criarLinhaGrupo: function(nome, valores, dotacaoAtualizada, saldo) {
        const tr = document.createElement('tr');
        tr.className = 'grupo-row';
        tr.innerHTML = `
            <td class="ps-4">${nome}</td>
            <td class="text-end">${Formatadores.moeda(valores.dotacao_inicial)}</td>
            <td class="text-end">${Formatadores.moeda(dotacaoAtualizada)}</td>
            <td class="text-end">${Formatadores.moeda(valores.despesa_empenhada)}</td>
            <td class="text-end">${Formatadores.moeda(valores.despesa_liquidada)}</td>
            <td class="text-end">${Formatadores.moeda(valores.despesa_paga)}</td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}">${Formatadores.moeda(saldo)}</td>
        `;
        return tr;
    },

    criarLinhaTotal: function(valores, dotacaoAtualizada, saldo) {
        const tr = document.createElement('tr');
        tr.className = 'total-row';
        tr.innerHTML = `
            <td><strong>TOTAL GERAL</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.dotacao_inicial)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(dotacaoAtualizada)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.despesa_empenhada)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.despesa_liquidada)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.despesa_paga)}</strong></td>
            <td class="text-end ${saldo < 0 ? 'text-danger' : ''}">
                <strong>${Formatadores.moeda(saldo)}</strong>
            </td>
        `;
        return tr;
    },

    isValoresVazios: function(valores) {
        return valores.dotacao_inicial === 0 && 
               valores.despesa_empenhada === 0 &&
               valores.despesa_liquidada === 0 &&
               valores.despesa_paga === 0;
    },

    calcularDotacaoAtualizada: function(valores) {
        return valores.dotacao_inicial + 
               valores.dotacao_adicional + 
               valores.cancelamento_dotacao + 
               valores.cancel_remaneja_dotacao;
    },

    somarAoTotal: function(total, valores) {
        total.dotacao_inicial += valores.dotacao_inicial;
        total.dotacao_adicional += valores.dotacao_adicional;
        total.cancelamento_dotacao += valores.cancelamento_dotacao;
        total.cancel_remaneja_dotacao += valores.cancel_remaneja_dotacao;
        total.despesa_empenhada += valores.despesa_empenhada;
        total.despesa_liquidada += valores.despesa_liquidada;
        total.despesa_paga += valores.despesa_paga;
    }
};

/**
 * Renderizador da Tabela de Créditos (mantém original)
 */
const TabelaCreditos = {
    renderizar: function(dados) {
        console.log('💰 Renderizando quadro de créditos adicionais...');
        
        const tbody = document.getElementById('tabelaCorpoCreditos');
        if (!tbody) {
            console.error('❌ Elemento tabelaCorpoCreditos não encontrado!');
            return null;
        }

        tbody.innerHTML = '';

        if (!dados || dados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4">
                        <i class="fas fa-inbox text-muted"></i>
                        <p class="text-muted mt-2">Nenhum dado disponível para o período selecionado</p>
                    </td>
                </tr>`;
            return null;
        }

        const agregados = this.agregarDadosCreditos(dados);
        const totais = this.renderizarLinhasCreditos(tbody, agregados);
        
        return totais;
    },

    agregarDadosCreditos: function(dados) {
        const agregados = {};

        // Inicializar estrutura
        Object.entries(EstruturaCategorias).forEach(([catId, catInfo]) => {
            agregados[catId] = {
                nome: catInfo.nome,
                valores: Filtros.criarObjetoValoresCreditos(),
                grupos: {}
            };

            Object.entries(catInfo.grupos).forEach(([grupoId, grupoNome]) => {
                agregados[catId].grupos[grupoId] = {
                    nome: grupoNome,
                    valores: Filtros.criarObjetoValoresCreditos()
                };
            });
        });

        // Agregar dados
        dados.forEach(row => {
            const catId = String(row.CATEGORIA || '0');
            const grupoId = String(row.GRUPO || '0');

            if (agregados[catId]) {
                this.somarValoresCreditos(agregados[catId].valores, row);

                if (agregados[catId].grupos[grupoId]) {
                    this.somarValoresCreditos(agregados[catId].grupos[grupoId].valores, row);
                }
            }
        });

        return agregados;
    },

    somarValoresCreditos: function(agregado, row) {
        agregado.credito_suplementar += parseFloat(row.CREDITO_SUPLEMENTAR || 0);
        agregado.credito_especial_aberto += parseFloat(row.CREDITO_ESPECIAL_ABERTO || 0);
        agregado.credito_especial_reaberto += parseFloat(row.CREDITO_ESPECIAL_REABERTO || 0);
        agregado.credito_extraordinario_reaberto += parseFloat(row.CREDITO_EXTRAORD_REABERTO || 0);
        agregado.cancel_credito_suplementar += parseFloat(row.CANCEL_CREDITO_SUPLEMENTAR || 0);
        agregado.remanejamento_veto_lei += parseFloat(row.REMANEJAMENTO_VETO_LEI || 0);
        agregado.cancel_credito_especial += parseFloat(row.CANCEL_CREDITO_ESPECIAL || 0);
        
        agregado.total_alteracoes = agregado.credito_suplementar + 
                                   agregado.credito_especial_aberto + 
                                   agregado.credito_especial_reaberto + 
                                   agregado.credito_extraordinario_reaberto +
                                   agregado.cancel_credito_suplementar +
                                   agregado.remanejamento_veto_lei +
                                   agregado.cancel_credito_especial;
    },

    renderizarLinhasCreditos: function(tbody, agregados) {
        const totalGeral = Filtros.criarObjetoValoresCreditos();

        // Renderizar categorias e grupos
        ['3', '4', '9'].forEach(catId => {
            const categoria = agregados[catId];
            if (!categoria) return;

            const valores = categoria.valores;
            if (this.isValoresCreditosVazios(valores)) return;

            tbody.appendChild(this.criarLinhaCategoriaCreditos(categoria.nome, valores));
            this.somarAoTotalCreditos(totalGeral, valores);

            // Renderizar grupos
            const ordemGrupos = catId === '3' ? ['1', '2', '3'] : 
                               catId === '4' ? ['4', '5', '6'] : [];

            ordemGrupos.forEach(grupoId => {
                const grupo = categoria.grupos[grupoId];
                if (!grupo || this.isValoresCreditosVazios(grupo.valores)) return;

                tbody.appendChild(this.criarLinhaGrupoCreditos(grupo.nome, grupo.valores));
            });
        });

        // Renderizar total geral
        tbody.appendChild(this.criarLinhaTotalCreditos(totalGeral));
        
        AppState.totaisCreditos = totalGeral;
        
        return totalGeral;
    },

    isValoresCreditosVazios: function(valores) {
        return valores.credito_suplementar === 0 && 
               valores.credito_especial_aberto === 0 &&
               valores.credito_especial_reaberto === 0 &&
               valores.credito_extraordinario_reaberto === 0 &&
               valores.cancel_credito_suplementar === 0 &&
               valores.remanejamento_veto_lei === 0 &&
               valores.cancel_credito_especial === 0;
    },

    somarAoTotalCreditos: function(total, valores) {
        total.credito_suplementar += valores.credito_suplementar;
        total.credito_especial_aberto += valores.credito_especial_aberto;
        total.credito_especial_reaberto += valores.credito_especial_reaberto;
        total.credito_extraordinario_reaberto += valores.credito_extraordinario_reaberto;
        total.cancel_credito_suplementar += valores.cancel_credito_suplementar;
        total.remanejamento_veto_lei += valores.remanejamento_veto_lei;
        total.cancel_credito_especial += valores.cancel_credito_especial;
        total.total_alteracoes += valores.total_alteracoes;
    },

    criarLinhaCategoriaCreditos: function(nome, valores) {
        const tr = document.createElement('tr');
        tr.className = 'categoria-row';
        tr.innerHTML = `
            <td><strong>${nome}</strong></td>
            <td class="text-end">${Formatadores.moeda(valores.credito_suplementar)}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_especial_aberto)}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_especial_reaberto)}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_extraordinario_reaberto)}</td>
            <td class="text-end ${valores.cancel_credito_suplementar < 0 ? 'text-danger' : ''}">${Formatadores.moeda(valores.cancel_credito_suplementar)}</td>
            <td class="text-end ${valores.remanejamento_veto_lei < 0 ? 'text-danger' : ''}">${Formatadores.moeda(valores.remanejamento_veto_lei)}</td>
            <td class="text-end ${valores.cancel_credito_especial < 0 ? 'text-danger' : ''}">${Formatadores.moeda(valores.cancel_credito_especial)}</td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.total_alteracoes)}</strong></td>
        `;
        return tr;
    },

    criarLinhaGrupoCreditos: function(nome, valores) {
        const tr = document.createElement('tr');
        tr.className = 'grupo-row';
        tr.innerHTML = `
            <td class="ps-4">${nome}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_suplementar)}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_especial_aberto)}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_especial_reaberto)}</td>
            <td class="text-end">${Formatadores.moeda(valores.credito_extraordinario_reaberto)}</td>
            <td class="text-end ${valores.cancel_credito_suplementar < 0 ? 'text-danger' : ''}">${Formatadores.moeda(valores.cancel_credito_suplementar)}</td>
            <td class="text-end ${valores.remanejamento_veto_lei < 0 ? 'text-danger' : ''}">${Formatadores.moeda(valores.remanejamento_veto_lei)}</td>
            <td class="text-end ${valores.cancel_credito_especial < 0 ? 'text-danger' : ''}">${Formatadores.moeda(valores.cancel_credito_especial)}</td>
            <td class="text-end">${Formatadores.moeda(valores.total_alteracoes)}</td>
        `;
        return tr;
    },

    criarLinhaTotalCreditos: function(valores) {
        const tr = document.createElement('tr');
        tr.className = 'total-row';
        tr.innerHTML = `
            <td><strong>TOTAL GERAL</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.credito_suplementar)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.credito_especial_aberto)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.credito_especial_reaberto)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valores.credito_extraordinario_reaberto)}</strong></td>
            <td class="text-end ${valores.cancel_credito_suplementar < 0 ? 'text-danger' : ''}">
                <strong>${Formatadores.moeda(valores.cancel_credito_suplementar)}</strong>
            </td>
            <td class="text-end ${valores.remanejamento_veto_lei < 0 ? 'text-danger' : ''}">
                <strong>${Formatadores.moeda(valores.remanejamento_veto_lei)}</strong>
            </td>
            <td class="text-end ${valores.cancel_credito_especial < 0 ? 'text-danger' : ''}">
                <strong>${Formatadores.moeda(valores.cancel_credito_especial)}</strong>
            </td>
            <td class="text-end">
                <strong>${Formatadores.moeda(valores.total_alteracoes)}</strong>
            </td>
        `;
        return tr;
    }
};

export { TabelaDemonstrativo, TabelaCreditos };