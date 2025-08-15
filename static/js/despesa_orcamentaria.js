/**
 * Sistema de Despesa Orçamentária
 * Versão Completa com Cards Sincronizados
 * Sistema de Balanço Geral DF
 */

// ============================================================================
// CONFIGURAÇÃO GLOBAL
// ============================================================================

const AppConfig = {
    debug: true,
    apiBaseUrl: '/despesa-orcamentaria/api',
    maxRegistros: 500000,
    formatoMoeda: {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }
};

const AppState = {
    dadosCompletos: null,
    dadosFiltrados: null,
    filtrosAtuais: null,
    totaisCalculados: null,
    ultimaConsulta: null
};

// ============================================================================
// FORMATADORES
// ============================================================================

const Formatadores = {
    /**
     * Formata valor como moeda brasileira compacta (para cards)
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
     * Formata valor como moeda brasileira completa (para tabela)
     */
    moeda: function(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 'R$ 0,00';
        }
        const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
        return new Intl.NumberFormat('pt-BR', AppConfig.formatoMoeda).format(numero || 0);
    },

    /**
     * Formata número com separadores de milhares
     */
    numero: function(num) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0';
        }
        return new Intl.NumberFormat('pt-BR').format(num);
    },

    /**
     * Retorna nome do mês
     */
    nomeMes: function(numeroMes) {
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return meses[numeroMes - 1] || '';
    },

    /**
     * Formata data/hora
     */
    dataHora: function(date = new Date()) {
        return date.toLocaleString('pt-BR');
    }
};

// ============================================================================
// GERENCIADOR DE UI
// ============================================================================

const UI = {
    /**
     * Mostra/esconde loading overlay
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
     * Atualiza um card específico com animação
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
     * Mostra cards vazios
     */
    mostrarCardsVazios: function() {
        this.atualizarValorCard('totalRegistros', '0');
        this.atualizarValorCard('dotacaoInicial', 'R$ 0,00');
        this.atualizarValorCard('despesaEmpenhada', 'R$ 0,00');
        this.atualizarValorCard('despesaPaga', 'R$ 0,00');
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

        if (selectExercicio) {
            if (![...selectExercicio.options].some(opt => opt.value == anoAtual)) {
                selectExercicio.add(new Option(anoAtual, anoAtual));
            }
            selectExercicio.value = anoAtual;
        }

        if (selectMes) {
            selectMes.value = mesAtual;
        }

        console.log(`📅 Filtros padrão: ${anoAtual} / ${Formatadores.nomeMes(mesAtual)}`);
        
        return { exercicio: anoAtual, mes: mesAtual };
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
    }
};

// ============================================================================
// GERENCIADOR DE DADOS
// ============================================================================

const DadosManager = {
    /**
     * Busca dados do servidor
     */
    buscarDados: async function() {
        try {
            console.log('🔍 Buscando dados do servidor...');
            
            const response = await fetch(`${AppConfig.apiBaseUrl}/dados?pagina=1&registros=${AppConfig.maxRegistros}`);
            const result = await response.json();

            if (!result.success || !result.dados) {
                throw new Error(result.message || 'Erro ao buscar dados');
            }

            console.log(`✅ ${result.dados.length} registros recebidos do servidor`);
            
            AppState.dadosCompletos = result.dados;
            
            if (AppConfig.debug && result.dados.length > 0) {
                console.log('Primeiro registro:', result.dados[0]);
                console.log('Campos disponíveis:', Object.keys(result.dados[0]));
            }

            return result.dados;

        } catch (error) {
            console.error('❌ Erro ao buscar dados:', error);
            throw error;
        }
    },

    /**
     * Aplica filtros aos dados - CORRIGIDO para sincronizar com tabela
     */
    filtrarDados: function(dados, filtros) {
        if (!dados || dados.length === 0) return [];

        console.log('🔍 Aplicando filtros:', filtros);
        const inicio = Date.now();

        // IMPORTANTE: Filtrar APENAS pelo exercício selecionado (não o anterior)
        let dadosFiltrados = dados.filter(row => {
            const exercicio = parseInt(row.COEXERCICIO);
            const mes = parseInt(row.INMES);
            
            // Filtrar pelo exercício exato e mês limite
            const exercicioValido = exercicio === filtros.exercicio;
            const mesValido = mes <= filtros.mes;
            
            return exercicioValido && mesValido;
        });

        const tempo = Date.now() - inicio;
        console.log(`✅ Filtros aplicados em ${tempo}ms`);
        console.log(`📊 Resultado:`);
        console.log(`   - Exercício ${filtros.exercicio}: ${dadosFiltrados.length} registros`);
        console.log(`   - Até mês ${filtros.mes} (${Formatadores.nomeMes(filtros.mes)})`);
        console.log(`   - Total: ${dadosFiltrados.length} de ${dados.length} registros`);

        AppState.dadosFiltrados = dadosFiltrados;
        AppState.filtrosAtuais = filtros;

        return dadosFiltrados;
    },

    /**
     * Calcula totais dos dados filtrados (igual à tabela)
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
        
        // Calcular exatamente como a tabela
        dados.forEach(row => {
            totais.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
            totais.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
            totais.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
            totais.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
            totais.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
            totais.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
            totais.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
        });
        
        // Calcular dotação atualizada
        totais.dotacao_atualizada = totais.dotacao_inicial + 
                                    totais.dotacao_adicional + 
                                    totais.cancelamento_dotacao + 
                                    totais.cancel_remaneja_dotacao;
        
        // Calcular saldo
        totais.saldo_dotacao = totais.dotacao_atualizada - totais.despesa_empenhada;
        
        return totais;
    }
};

// ============================================================================
// RENDERIZADOR DE TABELA
// ============================================================================

const TabelaRenderer = {
    estruturaCategorias: {
        '3': {
            nome: 'DESPESAS CORRENTES',
            grupos: {
                '1': 'PESSOAL E ENCARGOS SOCIAIS',
                '2': 'JUROS E ENCARGOS DA DÍVIDA',
                '3': 'OUTRAS DESPESAS CORRENTES'
            }
        },
        '4': {
            nome: 'DESPESAS DE CAPITAL',
            grupos: {
                '4': 'INVESTIMENTOS',
                '5': 'INVERSÕES FINANCEIRAS',
                '6': 'AMORTIZAÇÃO DA DÍVIDA'
            }
        },
        '9': {
            nome: 'RESERVA DE CONTINGÊNCIA',
            grupos: {}
        }
    },

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
        
        // Retornar o total geral para sincronizar com os cards
        return totalGeral;
    },

    agregarDados: function(dados) {
        const agregados = {};

        // Inicializar estrutura
        Object.entries(this.estruturaCategorias).forEach(([catId, catInfo]) => {
            agregados[catId] = {
                nome: catInfo.nome,
                valores: this.criarObjetoValores(),
                grupos: {}
            };

            Object.entries(catInfo.grupos).forEach(([grupoId, grupoNome]) => {
                agregados[catId].grupos[grupoId] = {
                    nome: grupoNome,
                    valores: this.criarObjetoValores()
                };
            });
        });

        // Processar dados
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
        const totalGeral = this.criarObjetoValores();

        // Renderizar categorias
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

        // Adicionar linha de total
        const dotacaoAtualizadaTotal = this.calcularDotacaoAtualizada(totalGeral);
        const saldoTotal = dotacaoAtualizadaTotal - totalGeral.despesa_empenhada;
        tbody.appendChild(this.criarLinhaTotal(totalGeral, dotacaoAtualizadaTotal, saldoTotal));
        
        // Retornar totais para sincronização
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

// ============================================================================
// FUNÇÃO PRINCIPAL DE CONSULTA - CORRIGIDA PARA SINCRONIZAR
// ============================================================================

async function consultarDados() {
    console.log('========== INICIANDO CONSULTA ==========');
    console.log('Timestamp:', Formatadores.dataHora());

    try {
        // 1. Preparar UI
        UI.mostrarLoadingCards();
        UI.toggleLoading(true, 'Consultando dados...');

        // 2. Obter filtros
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);

        console.log(`📅 Filtros selecionados:`);
        console.log(`   - Exercício: ${exercicio}`);
        console.log(`   - Mês: ${mes} (${Formatadores.nomeMes(mes)})`);

        // 3. Buscar dados completos (usar cache se já carregado)
        UI.toggleLoading(true, 'Carregando dados...');
        
        let dados = AppState.dadosCompletos;
        if (!dados) {
            dados = await DadosManager.buscarDados();
        }

        // 4. IMPORTANTE: Filtrar dados APENAS pelo exercício e mês selecionados
        UI.toggleLoading(true, 'Aplicando filtros...');
        const dadosFiltrados = DadosManager.filtrarDados(dados, { exercicio, mes });

        // 5. Calcular totais dos dados filtrados (mesmos valores que vão para a tabela)
        const totais = DadosManager.calcularTotais(dadosFiltrados);
        AppState.totaisCalculados = totais;
        
        // 6. Atualizar cards com os MESMOS valores que vão aparecer na tabela
        UI.removerLoadingCards();
        UI.atualizarValorCard('totalRegistros', Formatadores.numero(dadosFiltrados.length));
        UI.atualizarValorCard('dotacaoInicial', Formatadores.moedaCompacta(totais.dotacao_inicial));
        UI.atualizarValorCard('despesaEmpenhada', Formatadores.moedaCompacta(totais.despesa_empenhada));
        UI.atualizarValorCard('despesaPaga', Formatadores.moedaCompacta(totais.despesa_paga));

        // 7. Renderizar tabela
        UI.toggleLoading(true, 'Montando demonstrativo...');
        const totaisTabela = TabelaRenderer.renderizar(dadosFiltrados);

        // 8. Debug - Verificar se valores batem
        if (AppConfig.debug) {
            console.log('===== VERIFICAÇÃO DE SINCRONIZAÇÃO =====');
            console.log('Total de registros:', dadosFiltrados.length);
            console.log('Valores calculados:');
            console.log('   Cards:', {
                dotacao: Formatadores.moedaCompacta(totais.dotacao_inicial),
                empenhada: Formatadores.moedaCompacta(totais.despesa_empenhada),
                paga: Formatadores.moedaCompacta(totais.despesa_paga)
            });
            console.log('   Tabela:', {
                dotacao: Formatadores.moedaCompacta(totaisTabela.dotacao_inicial),
                empenhada: Formatadores.moedaCompacta(totaisTabela.despesa_empenhada),
                paga: Formatadores.moedaCompacta(totaisTabela.despesa_paga)
            });
            
            const sincronizado = Math.abs(totais.dotacao_inicial - totaisTabela.dotacao_inicial) < 0.01 &&
                                Math.abs(totais.despesa_empenhada - totaisTabela.despesa_empenhada) < 0.01 &&
                                Math.abs(totais.despesa_paga - totaisTabela.despesa_paga) < 0.01;
            
            console.log(`Status: ${sincronizado ? '✅ SINCRONIZADO' : '❌ DESSINCRONIZADO'}`);
            console.log('=========================================');
        }

        // 9. Finalizar
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

        const response = await fetch(`${AppConfig.apiBaseUrl}/exportar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formato })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `despesa_orcamentaria_${new Date().toISOString().slice(0,10)}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            UI.mostrarSucesso(`Dados exportados para ${formato.toUpperCase()}`);
        } else {
            throw new Error('Erro ao exportar dados');
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

        const response = await fetch(`${AppConfig.apiBaseUrl}/cache/limpar`, {
            method: 'POST'
        });

        const result = await response.json();
        if (result.success) {
            AppState.dadosCompletos = null;
            AppState.dadosFiltrados = null;
            AppState.totaisCalculados = null;
            
            UI.mostrarSucesso('Cache limpo com sucesso!');
            await consultarDados();
        }
    } catch (error) {
        UI.mostrarErro('Erro ao limpar cache');
    } finally {
        UI.toggleLoading(false);
    }
}

// ============================================================================
// FUNÇÕES DE DEBUG
// ============================================================================

/**
 * Função de debug principal
 */
window.debugDespesa = function() {
    console.log('===== DEBUG - ESTADO DA APLICAÇÃO =====');
    console.log('Configuração:', AppConfig);
    console.log('Estado:', {
        totalDadosCompletos: AppState.dadosCompletos?.length || 0,
        totalDadosFiltrados: AppState.dadosFiltrados?.length || 0,
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
    
    console.log('Valores atuais nos cards:');
    console.log('- Total Registros:', document.getElementById('totalRegistros')?.textContent);
    console.log('- Dotação Inicial:', document.getElementById('dotacaoInicial')?.textContent);
    console.log('- Despesa Empenhada:', document.getElementById('despesaEmpenhada')?.textContent);
    console.log('- Despesa Paga:', document.getElementById('despesaPaga')?.textContent);
    
    console.log('========================================');
};

/**
 * Verifica sincronização entre cards e tabela
 */
window.verificarSincronizacao = function() {
    console.log('===== VERIFICAÇÃO DE SINCRONIZAÇÃO =====');
    
    // Pegar valores dos cards
    const cards = {
        registros: document.getElementById('totalRegistros')?.textContent,
        dotacao: document.getElementById('dotacaoInicial')?.textContent,
        empenhada: document.getElementById('despesaEmpenhada')?.textContent,
        paga: document.getElementById('despesaPaga')?.textContent
    };
    
    // Pegar valores da tabela (última linha - TOTAL GERAL)
    const tabela = document.querySelector('#tabelaCorpo tr.total-row');
    if (tabela) {
        const celulas = tabela.querySelectorAll('td');
        const tabelaValores = {
            dotacao: celulas[1]?.querySelector('strong')?.textContent,
            atualizada: celulas[2]?.querySelector('strong')?.textContent,
            empenhada: celulas[3]?.querySelector('strong')?.textContent,
            liquidada: celulas[4]?.querySelector('strong')?.textContent,
            paga: celulas[5]?.querySelector('strong')?.textContent,
            saldo: celulas[6]?.querySelector('strong')?.textContent
        };
        
        console.log('CARDS:', cards);
        console.log('TABELA (Total Geral):', tabelaValores);
        
        // Comparar valores
        const dotacaoIgual = cards.dotacao === Formatadores.moedaCompacta(
            parseFloat(tabelaValores.dotacao?.replace(/[^\d,-]/g, '').replace(',', '.'))
        );
        const empenhadaIgual = cards.empenhada === Formatadores.moedaCompacta(
            parseFloat(tabelaValores.empenhada?.replace(/[^\d,-]/g, '').replace(',', '.'))
        );
        const pagaIgual = cards.paga === Formatadores.moedaCompacta(
            parseFloat(tabelaValores.paga?.replace(/[^\d,-]/g, '').replace(',', '.'))
        );
        
        if (dotacaoIgual && empenhadaIgual && pagaIgual) {
            console.log('✅ SINCRONIZADO: Cards e tabela mostram os mesmos valores!');
        } else {
            console.log('❌ DESSINCRONIZADO: Cards e tabela mostram valores diferentes!');
            console.log('Diferenças:');
            if (!dotacaoIgual) console.log('- Dotação Inicial diferente');
            if (!empenhadaIgual) console.log('- Despesa Empenhada diferente');
            if (!pagaIgual) console.log('- Despesa Paga diferente');
        }
    } else {
        console.log('❌ Tabela ainda não renderizada');
    }
    
    console.log('=========================================');
};

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('===== APLICAÇÃO INICIADA =====');
    console.log('Timestamp:', Formatadores.dataHora());
    console.log('Debug:', AppConfig.debug ? 'ATIVADO' : 'DESATIVADO');
    
    // Verificar elementos essenciais
    const elementosRequeridos = [
        'tabelaCorpo', 'exercicio', 'mes',
        'totalRegistros', 'dotacaoInicial', 
        'despesaEmpenhada', 'despesaPaga'
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
    
    // Iniciar consulta automática
    console.log('📊 Iniciando consulta automática...');
    consultarDados();
    
    console.log('===== INICIALIZAÇÃO COMPLETA =====');
    console.log('💡 Dicas de debug:');
    console.log('   - debugDespesa() para ver estado da aplicação');
    console.log('   - verificarSincronizacao() para verificar cards vs tabela');
    console.log('   - consultarDados() para recarregar dados');
});