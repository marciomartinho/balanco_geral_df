/**
 * main.js - Sistema de Despesa Orçamentária v3.0
 * 
 * Com funcionalidade de filtros por grupo/categoria
 * APENAS RENDERIZAÇÃO - toda lógica está no backend Python
 */

// ============================================================================
// CONFIGURAÇÃO GLOBAL
// ============================================================================

const Config = {
    apiUrl: '/despesa-orcamentaria/api',
    debug: true
};

// Estado da aplicação
let Estado = {
    dadosCompletos: null,
    exercicioAtual: null,
    exercicioAnterior: null,
    ugSelecionada: null,
    filtrosAtivos: {
        categorias: [],
        grupos: []
    }
};

// ============================================================================
// FUNÇÕES DE FORMATAÇÃO
// ============================================================================

const Formatadores = {
    /**
     * Formata valor monetário
     */
    moeda: function(valor) {
        if (!valor && valor !== 0) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    },

    /**
     * Formata número com separadores
     */
    numero: function(valor) {
        if (!valor && valor !== 0) return '0';
        return new Intl.NumberFormat('pt-BR').format(valor);
    },

    /**
     * Formata valor compacto (mil, mi, bi)
     */
    moedaCompacta: function(valor) {
        if (!valor && valor !== 0) return 'R$ 0,00';
        
        const absValor = Math.abs(valor);
        
        if (absValor >= 1000000000) {
            return `R$ ${(valor / 1000000000).toFixed(2).replace('.', ',')} bi`;
        } else if (absValor >= 1000000) {
            return `R$ ${(valor / 1000000).toFixed(2).replace('.', ',')} mi`;
        } else if (absValor >= 1000) {
            return `R$ ${(valor / 1000).toFixed(2).replace('.', ',')} mil`;
        }
        
        return this.moeda(valor);
    },

    /**
     * Calcula e formata variação percentual
     */
    variacao: function(atual, anterior) {
        if (!anterior || anterior === 0) {
            if (atual > 0) return { valor: '+100.00%', classe: 'text-success' };
            return { valor: '-', classe: '' };
        }
        
        const var_pct = ((atual / anterior) - 1) * 100;
        const sinal = var_pct > 0 ? '+' : '';
        
        let classe = '';
        if (var_pct > 0) classe = 'text-success';
        else if (var_pct < 0) classe = 'text-danger';
        
        return {
            valor: `${sinal}${var_pct.toFixed(2)}%`,
            classe: classe
        };
    }
};

// ============================================================================
// SISTEMA DE FILTROS DE GRUPO
// ============================================================================

const FiltrosGrupo = {
    /**
     * Inicializa os botões de filtro
     */
    inicializar: function() {
        if (!Estado.dadosCompletos || !Estado.dadosCompletos.demonstrativo) {
            console.log('Dados ainda não carregados para criar filtros');
            return;
        }
        
        const container = document.getElementById('filtrosGrupoContainer');
        const filtrosCategorias = document.getElementById('filtrosCategorias');
        const filtrosGrupos = document.getElementById('filtrosGrupos');
        
        if (!container || !filtrosCategorias || !filtrosGrupos) return;
        
        // Limpar containers
        filtrosCategorias.innerHTML = '';
        filtrosGrupos.innerHTML = '';
        
        // Criar mapa de categorias e grupos
        const categorias = Estado.dadosCompletos.demonstrativo.categorias;
        
        // Botão "Mostrar Todos"
        const btnTodos = document.createElement('button');
        btnTodos.className = 'btn btn-outline-primary btn-filtro-grupo active';
        btnTodos.innerHTML = `
            <i class="fas fa-list"></i> Mostrar Todos
        `;
        btnTodos.onclick = () => this.mostrarTodos();
        filtrosCategorias.appendChild(btnTodos);
        
        // Criar botões de categoria
        categorias.forEach(categoria => {
            // Botão da categoria
            const btnCategoria = document.createElement('button');
            btnCategoria.className = 'btn btn-outline-secondary btn-filtro-categoria';
            btnCategoria.dataset.categoriaId = categoria.id;
            btnCategoria.innerHTML = `
                <i class="fas fa-folder"></i> ${categoria.nome}
            `;
            btnCategoria.onclick = () => this.filtrarPorCategoria(categoria.id);
            filtrosCategorias.appendChild(btnCategoria);
            
            // Criar botões dos grupos desta categoria
            categoria.grupos.forEach(grupo => {
                const btnGrupo = document.createElement('button');
                btnGrupo.className = 'btn btn-outline-info btn-filtro-grupo';
                btnGrupo.dataset.categoriaId = categoria.id;
                btnGrupo.dataset.grupoId = grupo.id;
                
                btnGrupo.innerHTML = `
                    <i class="fas fa-layer-group"></i> ${grupo.nome}
                `;
                btnGrupo.onclick = () => this.filtrarPorGrupo(categoria.id, grupo.id);
                filtrosGrupos.appendChild(btnGrupo);
            });
        });
        
        // Mostrar container de filtros
        container.style.display = 'block';
    },
    
    /**
     * Mostra todos os grupos
     */
    mostrarTodos: function() {
        console.log('Mostrando todos os grupos');
        
        // Resetar filtros
        Estado.filtrosAtivos.categorias = [];
        Estado.filtrosAtivos.grupos = [];
        
        // Remover classe active de todos os botões
        document.querySelectorAll('.btn-filtro-grupo, .btn-filtro-categoria').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Adicionar active ao botão "Mostrar Todos"
        const btnTodos = document.querySelector('.btn-filtro-grupo');
        if (btnTodos && btnTodos.textContent.includes('Mostrar Todos')) {
            btnTodos.classList.add('active');
        }
        
        // Mostrar todas as linhas
        document.querySelectorAll('.categoria-row, .grupo-row').forEach(row => {
            row.classList.remove('filtro-oculto');
        });
        
        // Mostrar linha total original
        const totalRow = document.querySelector('.total-row');
        if (totalRow) totalRow.classList.remove('filtro-oculto');
        
        // Atualizar valores do total para os valores originais
        this.atualizarTotalGeral();
        
        this.atualizarContador();
    },
    
    /**
     * Filtra por categoria específica
     */
    filtrarPorCategoria: function(categoriaId) {
        console.log(`Filtrando por categoria: ${categoriaId}`);
        
        // Atualizar filtros ativos
        Estado.filtrosAtivos.categorias = [categoriaId];
        Estado.filtrosAtivos.grupos = [];
        
        // Atualizar botões
        document.querySelectorAll('.btn-filtro-grupo, .btn-filtro-categoria').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btnCategoria = document.querySelector(`.btn-filtro-categoria[data-categoria-id="${categoriaId}"]`);
        if (btnCategoria) btnCategoria.classList.add('active');
        
        // Aplicar filtro na tabela
        document.querySelectorAll('.categoria-row').forEach(row => {
            const rowCategoriaId = row.dataset.categoriaId;
            if (rowCategoriaId === categoriaId) {
                row.classList.remove('filtro-oculto');
            } else {
                row.classList.add('filtro-oculto');
            }
        });
        
        document.querySelectorAll('.grupo-row').forEach(row => {
            const rowCategoriaId = row.dataset.categoriaId;
            if (rowCategoriaId === categoriaId) {
                row.classList.remove('filtro-oculto');
            } else {
                row.classList.add('filtro-oculto');
            }
        });
        
        // Atualizar total geral com valores da categoria filtrada
        const categoria = Estado.dadosCompletos.demonstrativo.categorias.find(c => c.id === categoriaId);
        if (categoria) {
            this.atualizarTotalGeral(categoria.valores_atual, categoria.valores_anterior);
        }
        
        // Mostrar linha total
        const totalRow = document.querySelector('.total-row');
        if (totalRow) totalRow.classList.remove('filtro-oculto');
        
        this.atualizarContador();
    },
    
    /**
     * Filtra por grupo específico
     */
    filtrarPorGrupo: function(categoriaId, grupoId) {
        console.log(`Filtrando por grupo: ${grupoId} da categoria ${categoriaId}`);
        
        // Atualizar filtros ativos
        Estado.filtrosAtivos.categorias = [categoriaId];
        Estado.filtrosAtivos.grupos = [grupoId];
        
        // Atualizar botões
        document.querySelectorAll('.btn-filtro-grupo, .btn-filtro-categoria').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const btnGrupo = document.querySelector(`.btn-filtro-grupo[data-categoria-id="${categoriaId}"][data-grupo-id="${grupoId}"]`);
        if (btnGrupo) btnGrupo.classList.add('active');
        
        // Ocultar todas as linhas primeiro
        document.querySelectorAll('.categoria-row, .grupo-row').forEach(row => {
            row.classList.add('filtro-oculto');
        });
        
        // Mostrar apenas a categoria e grupo selecionados
        document.querySelectorAll(`.categoria-row[data-categoria-id="${categoriaId}"]`).forEach(row => {
            row.classList.remove('filtro-oculto');
        });
        
        document.querySelectorAll(`.grupo-row[data-categoria-id="${categoriaId}"][data-grupo-id="${grupoId}"]`).forEach(row => {
            row.classList.remove('filtro-oculto');
        });
        
        // Atualizar total geral com valores do grupo filtrado
        const categoria = Estado.dadosCompletos.demonstrativo.categorias.find(c => c.id === categoriaId);
        const grupo = categoria?.grupos.find(g => g.id === grupoId);
        if (grupo) {
            this.atualizarTotalGeral(grupo.valores_atual, grupo.valores_anterior);
        }
        
        // Mostrar linha total
        const totalRow = document.querySelector('.total-row');
        if (totalRow) totalRow.classList.remove('filtro-oculto');
        
        // NÃO expandir detalhes automaticamente - removido
        
        this.atualizarContador();
    },
    
    /**
     * Atualiza os valores do total geral baseado no filtro
     */
    atualizarTotalGeral: function(valoresAtual, valoresAnterior) {
        const totalRow = document.querySelector('.total-row');
        if (!totalRow) return;
        
        // Se não foram passados valores, usar o total original
        if (!valoresAtual || !valoresAnterior) {
            const totalOriginal = Estado.dadosCompletos.demonstrativo.total_geral;
            valoresAtual = totalOriginal.valores_atual;
            valoresAnterior = totalOriginal.valores_anterior;
        }
        
        // Calcular variações
        const varEmpenhada = Formatadores.variacao(valoresAtual.despesa_empenhada, valoresAnterior.despesa_empenhada);
        const varLiquidada = Formatadores.variacao(valoresAtual.despesa_liquidada, valoresAnterior.despesa_liquidada);
        const varPaga = Formatadores.variacao(valoresAtual.despesa_paga, valoresAnterior.despesa_paga);
        
        // Atualizar conteúdo da linha
        totalRow.innerHTML = `
            <td><strong>TOTAL GERAL</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.dotacao_inicial)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.dotacao_atualizada)}</strong></td>
            <td class="text-end valor-ano-anterior"><strong>${Formatadores.moeda(valoresAnterior.despesa_empenhada)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.despesa_empenhada)}</strong></td>
            <td class="text-end ${varEmpenhada.classe}"><strong>${varEmpenhada.valor}</strong></td>
            <td class="text-end valor-ano-anterior"><strong>${Formatadores.moeda(valoresAnterior.despesa_liquidada)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.despesa_liquidada)}</strong></td>
            <td class="text-end ${varLiquidada.classe}"><strong>${varLiquidada.valor}</strong></td>
            <td class="text-end valor-ano-anterior"><strong>${Formatadores.moeda(valoresAnterior.despesa_paga)}</strong></td>
            <td class="text-end"><strong>${Formatadores.moeda(valoresAtual.despesa_paga)}</strong></td>
            <td class="text-end ${varPaga.classe}"><strong>${varPaga.valor}</strong></td>
            <td class="text-end ${valoresAtual.saldo_dotacao < 0 ? 'text-danger' : ''}">
                <strong>${Formatadores.moeda(valoresAtual.saldo_dotacao)}</strong>
            </td>
        `;
    },
    
    /**
     * Atualiza o contador de filtros
     */
    atualizarContador: function() {
        const contador = document.getElementById('contadorFiltros');
        if (!contador) return;
        
        const gruposVisiveis = document.querySelectorAll('.grupo-row:not(.filtro-oculto)').length;
        const totalGrupos = document.querySelectorAll('.grupo-row').length;
        
        if (gruposVisiveis === totalGrupos) {
            contador.textContent = 'Mostrando todos os grupos';
        } else {
            contador.textContent = `Mostrando ${gruposVisiveis} de ${totalGrupos} grupos`;
        }
    }
};

// ============================================================================
// FUNÇÃO PRINCIPAL - BUSCAR E RENDERIZAR DADOS
// ============================================================================

async function consultarDados() {
    console.log('🔄 Consultando dados...');
    
    try {
        mostrarLoading(true);
        
        // Obter filtros selecionados
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);
        const ug = document.getElementById('unidadeGestora').value || 'CONSOLIDADO';
        
        // Validar valores
        if (!exercicio || isNaN(exercicio)) {
            throw new Error('Exercício inválido');
        }
        if (!mes || isNaN(mes) || mes < 1 || mes > 12) {
            throw new Error('Mês inválido');
        }
        
        console.log(`📊 Filtros: Exercício ${exercicio}, Mês ${mes}, UG ${ug}`);
        
        // Fazer UMA ÚNICA chamada ao backend que retorna TUDO
        const response = await fetch(`${Config.apiUrl}/dados-completos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                exercicio: exercicio, 
                mes: mes, 
                ug: ug 
            })
        });
        
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const dados = await response.json();
        
        if (!dados.success) {
            throw new Error(dados.message || 'Erro ao buscar dados');
        }
        
        // Salvar no estado
        Estado.dadosCompletos = dados;
        Estado.exercicioAtual = dados.exercicio_atual;
        Estado.exercicioAnterior = dados.exercicio_anterior;
        Estado.ugSelecionada = dados.ug;
        
        console.log('✅ Dados recebidos:', {
            exercicioAtual: dados.exercicio_atual,
            exercicioAnterior: dados.exercicio_anterior,
            ug: dados.ug,
            totalRegistrosAtual: dados.total_registros_atual,
            totalRegistrosAnterior: dados.total_registros_anterior
        });
        
        // Renderizar tudo
        renderizarCards(dados.totais);
        renderizarDemonstrativo(dados.demonstrativo);
        renderizarCreditos(dados.creditos);
        atualizarInterface(dados);
        
        // Inicializar filtros de grupo
        FiltrosGrupo.inicializar();
        
        mostrarMensagem('Dados carregados com sucesso!', 'success');
        
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarMensagem(error.message || 'Erro ao consultar dados', 'error');
        limparTabelas();
    } finally {
        mostrarLoading(false);
    }
}

// ============================================================================
// RENDERIZAÇÃO DOS CARDS
// ============================================================================

function renderizarCards(totais) {
    if (!totais) return;
    
    const { atual, anterior, registros_atual, registros_anterior } = totais;
    
    // Card de registros
    document.getElementById('totalRegistros').textContent = 
        `${Formatadores.numero(registros_atual)} (${registros_anterior} em ${Estado.exercicioAnterior})`;
    
    // Card dotação inicial
    document.getElementById('dotacaoInicial').textContent = 
        Formatadores.moedaCompacta(atual.dotacao_inicial);
    
    // Card despesa empenhada com variação
    const varEmpenhada = Formatadores.variacao(
        atual.despesa_empenhada, 
        anterior.despesa_empenhada
    );
    
    const cardEmpenhada = document.getElementById('despesaEmpenhada');
    cardEmpenhada.innerHTML = `
        ${Formatadores.moedaCompacta(atual.despesa_empenhada)}
        <small class="${varEmpenhada.classe}" style="display: block; font-size: 0.75rem; margin-top: 5px;">
            ${varEmpenhada.valor}
        </small>
    `;
    
    // Card despesa paga com variação
    const varPaga = Formatadores.variacao(
        atual.despesa_paga,
        anterior.despesa_paga
    );
    
    const cardPaga = document.getElementById('despesaPaga');
    cardPaga.innerHTML = `
        ${Formatadores.moedaCompacta(atual.despesa_paga)}
        <small class="${varPaga.classe}" style="display: block; font-size: 0.75rem; margin-top: 5px;">
            ${varPaga.valor}
        </small>
    `;
}

// ============================================================================
// RENDERIZAÇÃO DO DEMONSTRATIVO
// ============================================================================

function renderizarDemonstrativo(demonstrativo) {
    const tbody = document.getElementById('tabelaCorpo');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!demonstrativo || !demonstrativo.categorias) {
        tbody.innerHTML = `
            <tr>
                <td colspan="13" class="text-center py-4">
                    <i class="fas fa-inbox text-muted"></i>
                    <p class="text-muted mt-2">Nenhum dado disponível</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Renderizar cada categoria
    demonstrativo.categorias.forEach(categoria => {
        // Linha da categoria
        tbody.appendChild(criarLinhaCategoria(categoria));
        
        // Linhas dos grupos
        categoria.grupos.forEach(grupo => {
            tbody.appendChild(criarLinhaGrupo(grupo, categoria.id));
        });
    });
    
    // Linha do total geral
    if (demonstrativo.total_geral) {
        tbody.appendChild(criarLinhaTotal(demonstrativo.total_geral));
    }
}

function criarLinhaCategoria(categoria) {
    const tr = document.createElement('tr');
    tr.className = 'categoria-row';
    tr.dataset.categoriaId = categoria.id;
    
    const atual = categoria.valores_atual;
    const anterior = categoria.valores_anterior;
    
    const varEmpenhada = Formatadores.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
    const varLiquidada = Formatadores.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
    const varPaga = Formatadores.variacao(atual.despesa_paga, anterior.despesa_paga);
    
    tr.innerHTML = `
        <td><strong>${categoria.nome}</strong></td>
        <td class="text-end">${Formatadores.moeda(atual.dotacao_inicial)}</td>
        <td class="text-end">${Formatadores.moeda(atual.dotacao_atualizada)}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_empenhada)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_empenhada)}</td>
        <td class="text-end ${varEmpenhada.classe}">${varEmpenhada.valor}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_liquidada)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_liquidada)}</td>
        <td class="text-end ${varLiquidada.classe}">${varLiquidada.valor}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_paga)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_paga)}</td>
        <td class="text-end ${varPaga.classe}">${varPaga.valor}</td>
        <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(atual.saldo_dotacao)}
        </td>
    `;
    
    return tr;
}

function criarLinhaGrupo(grupo, categoriaId) {
    const tr = document.createElement('tr');
    tr.className = 'grupo-row';
    tr.dataset.categoriaId = categoriaId;
    tr.dataset.grupoId = grupo.id;
    
    const atual = grupo.valores_atual;
    const anterior = grupo.valores_anterior;
    
    const varEmpenhada = Formatadores.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
    const varLiquidada = Formatadores.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
    const varPaga = Formatadores.variacao(atual.despesa_paga, anterior.despesa_paga);
    
    // Botão de expandir só se houver detalhes
    const botaoExpandir = grupo.detalhes && grupo.detalhes.length > 0 ? `
        <button class="btn btn-sm btn-link p-0 me-2 btn-expandir" 
                onclick="toggleDetalhes('${categoriaId}', '${grupo.id}')"
                style="width: 20px;">
            <i class="fas fa-plus-square text-primary"></i>
        </button>
    ` : '';
    
    tr.innerHTML = `
        <td>
            ${botaoExpandir}
            <span class="ps-3">${grupo.nome}</span>
        </td>
        <td class="text-end">${Formatadores.moeda(atual.dotacao_inicial)}</td>
        <td class="text-end">${Formatadores.moeda(atual.dotacao_atualizada)}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_empenhada)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_empenhada)}</td>
        <td class="text-end ${varEmpenhada.classe}">${varEmpenhada.valor}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_liquidada)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_liquidada)}</td>
        <td class="text-end ${varLiquidada.classe}">${varLiquidada.valor}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_paga)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_paga)}</td>
        <td class="text-end ${varPaga.classe}">${varPaga.valor}</td>
        <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(atual.saldo_dotacao)}
        </td>
    `;
    
    return tr;
}

function criarLinhaTotal(total) {
    const tr = document.createElement('tr');
    tr.className = 'total-row';
    
    const atual = total.valores_atual;
    const anterior = total.valores_anterior;
    
    const varEmpenhada = Formatadores.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
    const varLiquidada = Formatadores.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
    const varPaga = Formatadores.variacao(atual.despesa_paga, anterior.despesa_paga);
    
    tr.innerHTML = `
        <td><strong>TOTAL GERAL</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(atual.dotacao_inicial)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(atual.dotacao_atualizada)}</strong></td>
        <td class="text-end valor-ano-anterior"><strong>${Formatadores.moeda(anterior.despesa_empenhada)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(atual.despesa_empenhada)}</strong></td>
        <td class="text-end ${varEmpenhada.classe}"><strong>${varEmpenhada.valor}</strong></td>
        <td class="text-end valor-ano-anterior"><strong>${Formatadores.moeda(anterior.despesa_liquidada)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(atual.despesa_liquidada)}</strong></td>
        <td class="text-end ${varLiquidada.classe}"><strong>${varLiquidada.valor}</strong></td>
        <td class="text-end valor-ano-anterior"><strong>${Formatadores.moeda(anterior.despesa_paga)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(atual.despesa_paga)}</strong></td>
        <td class="text-end ${varPaga.classe}"><strong>${varPaga.valor}</strong></td>
        <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
            <strong>${Formatadores.moeda(atual.saldo_dotacao)}</strong>
        </td>
    `;
    
    return tr;
}

// ============================================================================
// EXPANDIR/COLAPSAR DETALHES
// ============================================================================

function toggleDetalhes(categoriaId, grupoId) {
    const grupoRow = document.querySelector(`tr[data-categoria-id="${categoriaId}"][data-grupo-id="${grupoId}"]`);
    if (!grupoRow) return;
    
    const btn = grupoRow.querySelector('.btn-expandir i');
    const detalhesExistentes = document.querySelectorAll(`tr.detalhe-row[data-parent="${categoriaId}-${grupoId}"]`);
    
    if (detalhesExistentes.length > 0) {
        // Colapsar - remover detalhes
        detalhesExistentes.forEach(row => row.remove());
        btn.classList.remove('fa-minus-square');
        btn.classList.add('fa-plus-square');
    } else {
        // Expandir - adicionar detalhes
        const categoria = Estado.dadosCompletos.demonstrativo.categorias.find(c => c.id === categoriaId);
        const grupo = categoria?.grupos.find(g => g.id === grupoId);
        
        if (grupo && grupo.detalhes) {
            let elementoAnterior = grupoRow;
            
            grupo.detalhes.forEach(detalhe => {
                const trDetalhe = criarLinhaDetalhe(detalhe, `${categoriaId}-${grupoId}`);
                elementoAnterior.insertAdjacentElement('afterend', trDetalhe);
                elementoAnterior = trDetalhe;
            });
            
            btn.classList.remove('fa-plus-square');
            btn.classList.add('fa-minus-square');
        }
    }
}

function criarLinhaDetalhe(detalhe, parentId) {
    const tr = document.createElement('tr');
    tr.className = 'detalhe-row';
    tr.dataset.parent = parentId;
    
    const atual = detalhe.valores_atual;
    const anterior = detalhe.valores_anterior;
    
    const varEmpenhada = Formatadores.variacao(atual.despesa_empenhada, anterior.despesa_empenhada);
    const varLiquidada = Formatadores.variacao(atual.despesa_liquidada, anterior.despesa_liquidada);
    const varPaga = Formatadores.variacao(atual.despesa_paga, anterior.despesa_paga);
    
    tr.innerHTML = `
        <td class="ps-5">
            <small class="text-muted">Natureza: ${detalhe.natureza}</small>
        </td>
        <td class="text-end">${Formatadores.moeda(atual.dotacao_inicial)}</td>
        <td class="text-end">${Formatadores.moeda(atual.dotacao_atualizada)}</td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_empenhada)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_empenhada)}</td>
        <td class="text-end ${varEmpenhada.classe}"><small>${varEmpenhada.valor}</small></td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_liquidada)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_liquidada)}</td>
        <td class="text-end ${varLiquidada.classe}"><small>${varLiquidada.valor}</small></td>
        <td class="text-end valor-ano-anterior">${Formatadores.moeda(anterior.despesa_paga)}</td>
        <td class="text-end">${Formatadores.moeda(atual.despesa_paga)}</td>
        <td class="text-end ${varPaga.classe}"><small>${varPaga.valor}</small></td>
        <td class="text-end ${atual.saldo_dotacao < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(atual.saldo_dotacao)}
        </td>
    `;
    
    return tr;
}

// ============================================================================
// RENDERIZAÇÃO DOS CRÉDITOS
// ============================================================================

function renderizarCreditos(creditos) {
    const tbody = document.getElementById('tabelaCorpoCreditos');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!creditos || !creditos.categorias) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    <i class="fas fa-inbox text-muted"></i>
                    <p class="text-muted mt-2">Nenhum dado disponível</p>
                </td>
            </tr>
        `;
        return;
    }
    
    // Renderizar categorias e grupos
    creditos.categorias.forEach(categoria => {
        tbody.appendChild(criarLinhaCreditoCategoria(categoria));
        
        categoria.grupos.forEach(grupo => {
            tbody.appendChild(criarLinhaCreditoGrupo(grupo));
        });
    });
    
    // Total geral
    if (creditos.total_geral) {
        tbody.appendChild(criarLinhaCreditoTotal(creditos.total_geral));
    }
}

function criarLinhaCreditoCategoria(categoria) {
    const tr = document.createElement('tr');
    tr.className = 'categoria-row';
    
    const v = categoria.valores;
    
    tr.innerHTML = `
        <td><strong>${categoria.nome}</strong></td>
        <td class="text-end">${Formatadores.moeda(v.credito_suplementar)}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_especial_aberto)}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_especial_reaberto)}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_extraordinario_reaberto)}</td>
        <td class="text-end ${v.cancel_credito_suplementar < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(v.cancel_credito_suplementar)}
        </td>
        <td class="text-end ${v.remanejamento_veto_lei < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(v.remanejamento_veto_lei)}
        </td>
        <td class="text-end ${v.cancel_credito_especial < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(v.cancel_credito_especial)}
        </td>
        <td class="text-end"><strong>${Formatadores.moeda(v.total_alteracoes)}</strong></td>
    `;
    
    return tr;
}

function criarLinhaCreditoGrupo(grupo) {
    const tr = document.createElement('tr');
    tr.className = 'grupo-row';
    
    const v = grupo.valores;
    
    tr.innerHTML = `
        <td class="ps-4">${grupo.nome}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_suplementar)}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_especial_aberto)}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_especial_reaberto)}</td>
        <td class="text-end">${Formatadores.moeda(v.credito_extraordinario_reaberto)}</td>
        <td class="text-end ${v.cancel_credito_suplementar < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(v.cancel_credito_suplementar)}
        </td>
        <td class="text-end ${v.remanejamento_veto_lei < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(v.remanejamento_veto_lei)}
        </td>
        <td class="text-end ${v.cancel_credito_especial < 0 ? 'text-danger' : ''}">
            ${Formatadores.moeda(v.cancel_credito_especial)}
        </td>
        <td class="text-end">${Formatadores.moeda(v.total_alteracoes)}</td>
    `;
    
    return tr;
}

function criarLinhaCreditoTotal(total) {
    const tr = document.createElement('tr');
    tr.className = 'total-row';
    
    tr.innerHTML = `
        <td><strong>TOTAL GERAL</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(total.credito_suplementar)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(total.credito_especial_aberto)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(total.credito_especial_reaberto)}</strong></td>
        <td class="text-end"><strong>${Formatadores.moeda(total.credito_extraordinario_reaberto)}</strong></td>
        <td class="text-end ${total.cancel_credito_suplementar < 0 ? 'text-danger' : ''}">
            <strong>${Formatadores.moeda(total.cancel_credito_suplementar)}</strong>
        </td>
        <td class="text-end ${total.remanejamento_veto_lei < 0 ? 'text-danger' : ''}">
            <strong>${Formatadores.moeda(total.remanejamento_veto_lei)}</strong>
        </td>
        <td class="text-end ${total.cancel_credito_especial < 0 ? 'text-danger' : ''}">
            <strong>${Formatadores.moeda(total.cancel_credito_especial)}</strong>
        </td>
        <td class="text-end">
            <strong>${Formatadores.moeda(total.total_alteracoes)}</strong>
        </td>
    `;
    
    return tr;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function atualizarInterface(dados) {
    // Atualizar cabeçalhos com anos
    document.querySelectorAll('#anoAtualDotacao, #anoAtualDotacaoAtual, #anoAtualSaldo').forEach(el => {
        if (el) el.textContent = `(${dados.exercicio_atual})`;
    });
    
    document.querySelectorAll('#anoAtualEmpenhada, #anoAtualLiquidada, #anoAtualPaga').forEach(el => {
        if (el) el.textContent = dados.exercicio_atual;
    });
    
    document.querySelectorAll('#anoAnteriorEmpenhada, #anoAnteriorLiquidada, #anoAnteriorPaga').forEach(el => {
        if (el) el.textContent = dados.exercicio_anterior;
    });
    
    // Atualizar badge da UG
    const badge = document.getElementById('ugSelecionada');
    if (badge) {
        if (dados.ug === 'CONSOLIDADO') {
            badge.style.display = 'none';
        } else {
            badge.textContent = `UG: ${dados.ug}`;
            badge.style.display = 'inline-block';
        }
    }
    
    // Atualizar info de período
    const infoPeriodo = document.getElementById('textoPeriodoComparacao');
    if (infoPeriodo) {
        const nomeMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][dados.mes - 1];
        infoPeriodo.textContent = `Comparando Janeiro-${nomeMes}/${dados.exercicio_atual} com Janeiro-${nomeMes}/${dados.exercicio_anterior}`;
    }
}

function mostrarLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('active', show);
    }
}

function mostrarMensagem(texto, tipo = 'info') {
    console.log(`${tipo === 'error' ? '❌' : '✅'} ${texto}`);
    // Aqui poderia mostrar um toast/alert mais bonito
}

function limparTabelas() {
    const tbody = document.getElementById('tabelaCorpo');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="13" class="text-center">Nenhum dado disponível</td></tr>';
    }
    
    const tbodyCreditos = document.getElementById('tabelaCorpoCreditos');
    if (tbodyCreditos) {
        tbodyCreditos.innerHTML = '<tr><td colspan="9" class="text-center">Nenhum dado disponível</td></tr>';
    }
}

// ============================================================================
// FUNÇÕES EXPORTADAS PARA O HTML
// ============================================================================

async function exportarDados(formato) {
    try {
        mostrarLoading(true);
        
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);
        const ug = document.getElementById('unidadeGestora').value;
        
        const response = await fetch(`${Config.apiUrl}/exportar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exercicio, mes, ug, formato })
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `despesa_${exercicio}_mes${mes}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            
            mostrarMensagem('Dados exportados com sucesso!', 'success');
        } else {
            throw new Error('Erro ao exportar dados');
        }
    } catch (error) {
        mostrarMensagem(error.message, 'error');
    } finally {
        mostrarLoading(false);
    }
}

async function limparCache() {
    if (!confirm('Deseja limpar o cache? A próxima consulta será mais demorada.')) {
        return;
    }
    
    try {
        mostrarLoading(true);
        
        const response = await fetch(`${Config.apiUrl}/cache/limpar`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            mostrarMensagem('Cache limpo com sucesso!', 'success');
            await consultarDados();
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        mostrarMensagem(error.message, 'error');
    } finally {
        mostrarLoading(false);
    }
}

async function carregarUGs() {
    try {
        const response = await fetch(`${Config.apiUrl}/ugs`);
        const result = await response.json();
        
        if (result.success) {
            const select = document.getElementById('unidadeGestora');
            
            // Limpar opções (exceto CONSOLIDADO)
            while (select.options.length > 1) {
                select.remove(1);
            }
            
            // Adicionar UGs
            result.unidades_gestoras.forEach(ug => {
                const option = new Option(`${ug.codigo} - ${ug.nome}`, ug.codigo);
                select.add(option);
            });
            
            console.log(`✅ ${result.unidades_gestoras.length} UGs carregadas`);
        }
    } catch (error) {
        console.error('Erro ao carregar UGs:', error);
    }
}

function toggleExpandirTodos() {
    const botoes = document.querySelectorAll('.btn-expandir i.fa-plus-square');
    
    if (botoes.length > 0) {
        // Expandir todos
        botoes.forEach(btn => btn.parentElement.click());
        document.getElementById('btnExpandirTexto').textContent = 'Colapsar Todos';
    } else {
        // Colapsar todos
        document.querySelectorAll('.btn-expandir i.fa-minus-square').forEach(btn => {
            btn.parentElement.click();
        });
        document.getElementById('btnExpandirTexto').textContent = 'Expandir Todos';
    }
}

// ============================================================================
// FUNÇÕES DE FILTRO EXPORTADAS
// ============================================================================

function limparFiltrosGrupo() {
    FiltrosGrupo.mostrarTodos();
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Sistema de Despesa Orçamentária v3.0');
    console.log('📍 Com sistema de filtros por grupo/categoria');
    
    // Configurar valores padrão
    configurarFiltrosPadrao();
    
    // Inicializar Select2 para UG (se jQuery e Select2 estiverem disponíveis)
    if (typeof $ !== 'undefined' && $.fn.select2) {
        $('#unidadeGestora').select2({
            theme: 'bootstrap-5',
            placeholder: 'Selecione uma Unidade Gestora',
            allowClear: false,
            width: '100%'
        });
    }
    
    // Carregar UGs e dados iniciais
    await carregarUGs();
    await consultarDados();
    
    // Event listener para o botão Consultar (se não estiver no onclick do HTML)
    const btnConsultar = document.querySelector('button[onclick*="consultarDados"]');
    if (!btnConsultar) {
        // Se não houver onclick no HTML, adicionar listener
        const btnConsultarAlt = document.querySelector('.btn-primary');
        if (btnConsultarAlt && btnConsultarAlt.textContent.includes('Consultar')) {
            btnConsultarAlt.addEventListener('click', consultarDados);
        }
    }
    
    // Event listeners para mudanças nos filtros (auto-consulta)
    const selectExercicio = document.getElementById('exercicio');
    const selectMes = document.getElementById('mes');
    const selectUG = document.getElementById('unidadeGestora');
    
    if (selectExercicio) {
        selectExercicio.addEventListener('change', async () => {
            console.log('📅 Exercício alterado para:', selectExercicio.value);
            // Resetar UG para CONSOLIDADO quando mudar exercício
            if (selectUG) {
                selectUG.value = 'CONSOLIDADO';
                if (typeof $ !== 'undefined' && $.fn.select2) {
                    $('#unidadeGestora').trigger('change.select2');
                }
            }
            await consultarDados();
        });
    }
    
    if (selectMes) {
        selectMes.addEventListener('change', async () => {
            console.log('📅 Mês alterado para:', selectMes.value);
            await consultarDados();
        });
    }
    
    if (selectUG) {
        // Usar evento do Select2 se disponível
        if (typeof $ !== 'undefined' && $.fn.select2) {
            $('#unidadeGestora').on('select2:select', async (e) => {
                console.log('🏢 UG alterada para:', e.params.data.id);
                await consultarDados();
            });
        } else {
            // Fallback para select normal
            selectUG.addEventListener('change', async () => {
                console.log('🏢 UG alterada para:', selectUG.value);
                await consultarDados();
            });
        }
    }
    
    console.log('✅ Sistema inicializado com sucesso');
    console.log('📊 Filtros disponíveis:', {
        exercicio: selectExercicio?.value,
        mes: selectMes?.value,
        ug: selectUG?.value
    });
});

// ============================================================================
// CONFIGURAR FILTROS PADRÃO
// ============================================================================

function configurarFiltrosPadrao() {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    
    const selectExercicio = document.getElementById('exercicio');
    const selectMes = document.getElementById('mes');
    const selectUG = document.getElementById('unidadeGestora');
    
    if (selectExercicio) {
        // Adicionar ano atual se não existir
        const temAnoAtual = Array.from(selectExercicio.options).some(opt => opt.value == anoAtual);
        if (!temAnoAtual) {
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
    
    console.log(`📅 Filtros padrão: ${anoAtual} / Mês ${mesAtual} / CONSOLIDADO`);
}

// Exportar funções globais (para serem chamadas do HTML)
window.consultarDados = consultarDados;
window.exportarDados = exportarDados;
window.limparCache = limparCache;
window.limparFiltrosGrupo = limparFiltrosGrupo;
window.toggleDetalhes = toggleDetalhes;
window.toggleExpandirTodos = toggleExpandirTodos;