/**
 * Componente de Tabela - Renderiza tabelas de dados
 */

import { Formatador } from '../utilitarios/formatador.js';

export class TabelaDemonstrativo {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.dados = null;
        this.detalhesExpandidos = new Set();
    }
    
    /**
     * Renderiza a tabela completa
     */
    renderizar(dados) {
        this.dados = dados;
        
        if (!this.container) {
            console.error('Container não encontrado:', this.containerId);
            return;
        }
        
        // Limpar container
        this.container.innerHTML = '';
        
        // Criar estrutura da tabela
        const html = `
            <div class="data-table-container">
                <h5>
                    <i class="fas fa-table"></i> 
                    Demonstrativo Comparativo da Despesa Orçamentária
                </h5>
                <div class="table-responsive tabela-comparativa-container">
                    <table class="table table-bordered table-hover tabela-comparativa">
                        ${this._criarCabecalho()}
                        <tbody id="tabelaCorpo">
                            ${this._criarLinhas()}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Adicionar event listeners
        this._configurarEventos();
    }
    
    /**
     * Cria o cabeçalho da tabela
     */
    _criarCabecalho() {
        const anoAtual = this.dados.exercicio_atual;
        const anoAnterior = this.dados.exercicio_anterior;
        
        return `
            <thead>
                <tr class="thead-main">
                    <th rowspan="3" class="align-middle">DESPESAS ORÇAMENTÁRIAS</th>
                    <th rowspan="3" class="text-center align-middle">
                        DOTAÇÃO<br/>INICIAL<br/>
                        <small>(${anoAtual})</small>
                    </th>
                    <th rowspan="3" class="text-center align-middle">
                        DOTAÇÃO<br/>ATUALIZADA<br/>
                        <small>(${anoAtual})</small>
                    </th>
                    <th colspan="3" class="text-center bg-empenhada">
                        DESPESAS EMPENHADAS
                    </th>
                    <th colspan="3" class="text-center bg-liquidada">
                        DESPESAS LIQUIDADAS
                    </th>
                    <th colspan="3" class="text-center bg-paga">
                        DESPESAS PAGAS
                    </th>
                    <th rowspan="3" class="text-center align-middle">
                        SALDO DA<br/>DOTAÇÃO<br/>
                        <small>(${anoAtual})</small>
                    </th>
                </tr>
                <tr class="thead-sub">
                    <th class="text-center bg-empenhada-light">${anoAnterior}</th>
                    <th class="text-center bg-empenhada-light">${anoAtual}</th>
                    <th class="text-center bg-empenhada-var coluna-variacao">Var %</th>
                    <th class="text-center bg-liquidada-light">${anoAnterior}</th>
                    <th class="text-center bg-liquidada-light">${anoAtual}</th>
                    <th class="text-center bg-liquidada-var coluna-variacao">Var %</th>
                    <th class="text-center bg-paga-light">${anoAnterior}</th>
                    <th class="text-center bg-paga-light">${anoAtual}</th>
                    <th class="text-center bg-paga-var coluna-variacao">Var %</th>
                </tr>
            </thead>
        `;
    }
    
    /**
     * Cria as linhas de dados
     */
    _criarLinhas() {
        if (!this.dados.demonstrativo || !this.dados.demonstrativo.categorias) {
            return `
                <tr>
                    <td colspan="13" class="text-center py-4">
                        <i class="fas fa-inbox text-muted"></i>
                        <p class="text-muted mt-2">Nenhum dado disponível</p>
                    </td>
                </tr>
            `;
        }
        
        let html = '';
        
        // Renderizar categorias e grupos
        this.dados.demonstrativo.categorias.forEach(categoria => {
            html += this._criarLinhaCategoria(categoria);
            
            categoria.grupos.forEach(grupo => {
                html += this._criarLinhaGrupo(grupo, categoria.id);
            });
        });
        
        // Linha de total
        if (this.dados.demonstrativo.total_geral) {
            html += this._criarLinhaTotal(this.dados.demonstrativo.total_geral);
        }
        
        return html;
    }
    
    /**
     * Cria linha de categoria
     */
    _criarLinhaCategoria(categoria) {
        const atual = categoria.valores_atual;
        const anterior = categoria.valores_anterior;
        
        const varEmpenhada = Formatador.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
        const varLiquidada = Formatador.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
        const varPaga = Formatador.variacao(atual.despesa_paga, anterior.despesa_paga);
        
        return `
            <tr class="categoria-row" data-categoria-id="${categoria.id}">
                <td><strong>${categoria.nome}</strong></td>
                <td class="text-end">${Formatador.moeda(atual.dotacao_inicial)}</td>
                <td class="text-end">${Formatador.moeda(atual.dotacao_atualizada)}</td>
                <td class="text-end valor-ano-anterior">${Formatador.moeda(anterior.despesa_empenhada)}</td>
                <td class="text-end">${Formatador.moeda(atual.despesa_empenhada)}</td>
                <td class="text-end ${varEmpenhada.classe}">
                    ${varEmpenhada.icone} ${varEmpenhada.valor}
                </td>
                <td class="text-end valor-ano-anterior">${Formatador.moeda(anterior.despesa_liquidada)}</td>
                <td class="text-end">${Formatador.moeda(atual.despesa_liquidada)}</td>
                <td class="text-end ${varLiquidada.classe}">
                    ${varLiquidada.icone} ${varLiquidada.valor}
                </td>
                <td class="text-end valor-ano-anterior">${Formatador.moeda(anterior.despesa_paga)}</td>
                <td class="text-end">${Formatador.moeda(atual.despesa_paga)}</td>
                <td class="text-end ${varPaga.classe}">
                    ${varPaga.icone} ${varPaga.valor}
                </td>
                <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
                    ${Formatador.moeda(atual.saldo_dotacao)}
                </td>
            </tr>
        `;
    }
    
    /**
     * Cria linha de grupo
     */
    _criarLinhaGrupo(grupo, categoriaId) {
        const atual = grupo.valores_atual;
        const anterior = grupo.valores_anterior;
        
        const varEmpenhada = Formatador.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
        const varLiquidada = Formatador.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
        const varPaga = Formatador.variacao(atual.despesa_paga, anterior.despesa_paga);
        
        // Botão de expandir (se tiver detalhes)
        const temDetalhes = grupo.detalhes && grupo.detalhes.length > 0;
        const botaoExpandir = temDetalhes ? `
            <button class="btn-expandir" 
                    data-categoria="${categoriaId}" 
                    data-grupo="${grupo.id}">
                <i class="fas fa-plus-square"></i>
            </button>
        ` : '';
        
        return `
            <tr class="grupo-row" 
                data-categoria-id="${categoriaId}" 
                data-grupo-id="${grupo.id}">
                <td>
                    ${botaoExpandir}
                    <span class="ps-3">${grupo.nome}</span>
                </td>
                <td class="text-end">${Formatador.moeda(atual.dotacao_inicial)}</td>
                <td class="text-end">${Formatador.moeda(atual.dotacao_atualizada)}</td>
                <td class="text-end valor-ano-anterior">${Formatador.moeda(anterior.despesa_empenhada)}</td>
                <td class="text-end">${Formatador.moeda(atual.despesa_empenhada)}</td>
                <td class="text-end ${varEmpenhada.classe}">
                    ${varEmpenhada.icone} ${varEmpenhada.valor}
                </td>
                <td class="text-end valor-ano-anterior">${Formatador.moeda(anterior.despesa_liquidada)}</td>
                <td class="text-end">${Formatador.moeda(atual.despesa_liquidada)}</td>
                <td class="text-end ${varLiquidada.classe}">
                    ${varLiquidada.icone} ${varLiquidada.valor}
                </td>
                <td class="text-end valor-ano-anterior">${Formatador.moeda(anterior.despesa_paga)}</td>
                <td class="text-end">${Formatador.moeda(atual.despesa_paga)}</td>
                <td class="text-end ${varPaga.classe}">
                    ${varPaga.icone} ${varPaga.valor}
                </td>
                <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
                    ${Formatador.moeda(atual.saldo_dotacao)}
                </td>
            </tr>
        `;
    }
    
    /**
     * Cria linha de total
     */
    _criarLinhaTotal(total) {
        const atual = total.valores_atual;
        const anterior = total.valores_anterior;
        
        const varEmpenhada = Formatador.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
        const varLiquidada = Formatador.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
        const varPaga = Formatador.variacao(atual.despesa_paga, anterior.despesa_paga);
        
        return `
            <tr class="total-row">
                <td><strong>TOTAL GERAL</strong></td>
                <td class="text-end"><strong>${Formatador.moeda(atual.dotacao_inicial)}</strong></td>
                <td class="text-end"><strong>${Formatador.moeda(atual.dotacao_atualizada)}</strong></td>
                <td class="text-end valor-ano-anterior">
                    <strong>${Formatador.moeda(anterior.despesa_empenhada)}</strong>
                </td>
                <td class="text-end"><strong>${Formatador.moeda(atual.despesa_empenhada)}</strong></td>
                <td class="text-end ${varEmpenhada.classe}">
                    <strong>${varEmpenhada.icone} ${varEmpenhada.valor}</strong>
                </td>
                <td class="text-end valor-ano-anterior">
                    <strong>${Formatador.moeda(anterior.despesa_liquidada)}</strong>
                </td>
                <td class="text-end"><strong>${Formatador.moeda(atual.despesa_liquidada)}</strong></td>
                <td class="text-end ${varLiquidada.classe}">
                    <strong>${varLiquidada.icone} ${varLiquidada.valor}</strong>
                </td>
                <td class="text-end valor-ano-anterior">
                    <strong>${Formatador.moeda(anterior.despesa_paga)}</strong>
                </td>
                <td class="text-end"><strong>${Formatador.moeda(atual.despesa_paga)}</strong></td>
                <td class="text-end ${varPaga.classe}">
                    <strong>${varPaga.icone} ${varPaga.valor}</strong>
                </td>
                <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
                    <strong>${Formatador.moeda(atual.saldo_dotacao)}</strong>
                </td>
            </tr>
        `;
    }
    
    /**
     * Configura eventos da tabela
     */
    _configurarEventos() {
        // Expandir/colapsar detalhes
        this.container.querySelectorAll('.btn-expandir').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const categoria = btn.dataset.categoria;
                const grupo = btn.dataset.grupo;
                this.toggleDetalhes(categoria, grupo);
            });
        });
    }
    
    /**
     * Expande/colapsa detalhes de um grupo
     */
    toggleDetalhes(categoriaId, grupoId) {
        const key = `${categoriaId}-${grupoId}`;
        
        if (this.detalhesExpandidos.has(key)) {
            this.colapsarDetalhes(key);
        } else {
            this.expandirDetalhes(categoriaId, grupoId);
        }
    }
    
    /**
     * Expande detalhes
     */
    expandirDetalhes(categoriaId, grupoId) {
        // Implementar quando houver endpoint de detalhes
        console.log('Expandir detalhes:', categoriaId, grupoId);
        
        const key = `${categoriaId}-${grupoId}`;
        this.detalhesExpandidos.add(key);
        
        // Mudar ícone
        const btn = this.container.querySelector(
            `.btn-expandir[data-categoria="${categoriaId}"][data-grupo="${grupoId}"] i`
        );
        if (btn) {
            btn.classList.remove('fa-plus-square');
            btn.classList.add('fa-minus-square');
        }
    }
    
    /**
     * Colapsa detalhes
     */
    colapsarDetalhes(key) {
        this.detalhesExpandidos.delete(key);
        
        // Remover linhas de detalhe
        this.container.querySelectorAll(`.detalhe-row[data-parent="${key}"]`).forEach(row => {
            row.remove();
        });
        
        // Mudar ícone
        const [categoriaId, grupoId] = key.split('-');
        const btn = this.container.querySelector(
            `.btn-expandir[data-categoria="${categoriaId}"][data-grupo="${grupoId}"] i`
        );
        if (btn) {
            btn.classList.remove('fa-minus-square');
            btn.classList.add('fa-plus-square');
        }
    }
}