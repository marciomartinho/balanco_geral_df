/**
 * tabelas.js - Renderização de Tabelas
 * Sistema de Despesa Orçamentária
 */

import Formatadores from './formatadores.js';
import { EstruturaCategorias, AppState } from './config.js';
import Filtros from './filtros.js';

/**
 * Renderizador da Tabela de Demonstrativo
 */
const TabelaDemonstrativo = {
    renderizar: function(dados) {
        console.log('📊 Renderizando tabela demonstrativo...');
        
        const tbody = document.getElementById('tabelaCorpo');
        if (!tbody) {
            console.error('❌ Elemento tabelaCorpo não encontrado!');
            return;
        }

        tbody.innerHTML = '';

        if (!dados || dados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <i class="fas fa-inbox text-muted"></i>
                        <p class="text-muted mt-2">Nenhum dado disponível para o período selecionado</p>
                    </td>
                </tr>`;
            return;
        }

        const agregados = this.agregarDados(dados);
        const totalGeral = this.renderizarLinhas(tbody, agregados);
        
        return totalGeral;
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

    renderizarLinhas: function(tbody, agregados) {
        const totalGeral = Filtros.criarObjetoValores();

        // Renderizar categorias e grupos
        ['3', '4', '9'].forEach(catId => {
            const categoria = agregados[catId];
            if (!categoria) return;

            const valores = categoria.valores;
            if (this.isValoresVazios(valores)) return;

            const dotacaoAtualizada = this.calcularDotacaoAtualizada(valores);
            const saldo = dotacaoAtualizada - valores.despesa_empenhada;

            tbody.appendChild(this.criarLinhaCategoria(categoria.nome, valores, dotacaoAtualizada, saldo));
            this.somarAoTotal(totalGeral, valores);

            // Renderizar grupos
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

        // Renderizar total geral
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
    }
};

/**
 * Renderizador da Tabela de Créditos
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