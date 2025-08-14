/**
 * Sistema de Despesa Orçamentária - JavaScript
 * Versão completamente reescrita com melhor estrutura e debug
 */

// ============================================================================
// CONFIGURAÇÃO GLOBAL E VARIÁVEIS
// ============================================================================

const AppConfig = {
    debug: true, // Ativar logs detalhados
    apiBaseUrl: '/despesa-orcamentaria/api',
    maxRegistros: 500000, // Máximo de registros para buscar
    formatoMoeda: {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }
};

const AppState = {
    dadosCompletos: null,      // Todos os dados do servidor
    dadosFiltrados: null,       // Dados após aplicar filtros
    filtrosAtuais: null,        // Filtros aplicados
    cacheInfo: null,            // Informações sobre o cache
    ultimaConsulta: null        // Timestamp da última consulta
};

// ============================================================================
// UTILITÁRIOS DE FORMATAÇÃO
// ============================================================================

const Formatadores = {
    /**
     * Formata valor como moeda brasileira
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
     * Mostra/esconde loading
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
     * Mostra mensagem de erro
     */
    mostrarErro: function(mensagem) {
        console.error('ERRO:', mensagem);
        alert('Erro: ' + mensagem);
    },

    /**
     * Mostra mensagem de sucesso
     */
    mostrarSucesso: function(mensagem) {
        console.log('SUCESSO:', mensagem);
        // Poderia mostrar um toast ou notificação
    },

    /**
     * Atualiza cards de resumo
     */
    atualizarCards: function(resumo) {
        if (!resumo) return;

        const elementos = {
            'totalRegistros': Formatadores.numero(resumo.total_registros || 0),
            'dotacaoInicial': Formatadores.moeda(resumo.totais?.DOTACAO_INICIAL || 0),
            'despesaEmpenhada': Formatadores.moeda(resumo.totais?.DESPESA_EMPENHADA || 0),
            'despesaPaga': Formatadores.moeda(resumo.totais?.DESPESA_PAGA || 0)
        };

        for (const [id, valor] of Object.entries(elementos)) {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
            }
        }

        // Mostrar informações do cache
        if (resumo.usando_cache) {
            console.log('📦 Usando cache do dia');
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

        if (selectExercicio) {
            // Adicionar ano atual se não existir
            if (![...selectExercicio.options].some(opt => opt.value == anoAtual)) {
                selectExercicio.add(new Option(anoAtual, anoAtual));
            }
            selectExercicio.value = anoAtual;
        }

        if (selectMes) {
            selectMes.value = mesAtual;
        }

        console.log(`📅 Filtros configurados: Exercício ${anoAtual}, Mês ${Formatadores.nomeMes(mesAtual)}`);
        
        return { exercicio: anoAtual, mes: mesAtual };
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
            console.log('🔍 Buscando todos os dados do servidor...');
            
            const response = await fetch(`${AppConfig.apiBaseUrl}/dados?pagina=1&registros=${AppConfig.maxRegistros}`);
            const result = await response.json();

            if (!result.success || !result.dados) {
                throw new Error(result.message || 'Erro ao buscar dados');
            }

            console.log(`✅ ${result.dados.length} registros recebidos do servidor`);
            
            // Salvar dados completos
            AppState.dadosCompletos = result.dados;
            
            // Verificar estrutura dos dados
            if (AppConfig.debug && result.dados.length > 0) {
                console.log('📋 Estrutura dos dados:');
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
     * Aplica filtros aos dados
     */
    filtrarDados: function(dados, filtros) {
        if (!dados || dados.length === 0) return [];

        console.log('🔍 Aplicando filtros:', filtros);
        const inicio = Date.now();

        let dadosFiltrados = dados.filter(row => {
            const exercicio = parseInt(row.COEXERCICIO);
            const mes = parseInt(row.INMES);

            // Aplicar filtros
            const exercicioValido = exercicio === filtros.exercicio;
            const mesValido = mes <= filtros.mes;

            return exercicioValido && mesValido;
        });

        const tempo = Date.now() - inicio;
        console.log(`✅ Filtros aplicados em ${tempo}ms`);
        console.log(`📊 ${dadosFiltrados.length} de ${dados.length} registros após filtro`);

        // Salvar dados filtrados
        AppState.dadosFiltrados = dadosFiltrados;
        AppState.filtrosAtuais = filtros;

        return dadosFiltrados;
    },

    /**
     * Calcula totais dos dados
     */
    calcularTotais: function(dados) {
        if (!dados || dados.length === 0) {
            return {
                dotacao_inicial: 0,
                dotacao_adicional: 0,
                cancelamento_dotacao: 0,
                cancel_remaneja_dotacao: 0,
                despesa_empenhada: 0,
                despesa_liquidada: 0,
                despesa_paga: 0
            };
        }

        const totais = {
            dotacao_inicial: 0,
            dotacao_adicional: 0,
            cancelamento_dotacao: 0,
            cancel_remaneja_dotacao: 0,
            despesa_empenhada: 0,
            despesa_liquidada: 0,
            despesa_paga: 0
        };

        dados.forEach(row => {
            totais.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
            totais.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
            totais.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
            totais.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
            totais.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
            totais.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
            totais.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
        });

        if (AppConfig.debug) {
            console.log('💰 Totais calculados:', totais);
        }

        return totais;
    }
};

// ============================================================================
// RENDERIZADOR DE TABELA
// ============================================================================

const TabelaRenderer = {
    /**
     * Estrutura das categorias de despesa
     */
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

    /**
     * Renderiza a tabela demonstrativo
     */
    renderizar: function(dados) {
        console.log('📊 Renderizando tabela demonstrativo...');
        
        const tbody = document.getElementById('tabelaCorpo');
        if (!tbody) {
            console.error('❌ Elemento tabelaCorpo não encontrado!');
            return;
        }

        // Limpar tabela
        tbody.innerHTML = '';

        if (!dados || dados.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">Nenhum dado disponível</td></tr>';
            return;
        }

        // Agregar dados por categoria e grupo
        const agregados = this.agregarDados(dados);
        
        // Renderizar linhas
        this.renderizarLinhas(tbody, agregados);

        console.log('✅ Tabela renderizada com sucesso');
    },

    /**
     * Agrega dados por categoria e grupo
     */
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

        // Processar cada registro
        dados.forEach(row => {
            const catId = String(row.CATEGORIA || row.COCATEGORIA || '0');
            const grupoId = String(row.GRUPO || row.COGRUPO || '0');

            if (agregados[catId]) {
                // Somar à categoria
                this.somarValores(agregados[catId].valores, row);

                // Somar ao grupo se existir
                if (agregados[catId].grupos[grupoId]) {
                    this.somarValores(agregados[catId].grupos[grupoId].valores, row);
                }
            }
        });

        if (AppConfig.debug) {
            console.log('📊 Dados agregados:', agregados);
        }

        return agregados;
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
     * Soma valores de um registro ao agregado
     */
    somarValores: function(agregado, row) {
        agregado.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
        agregado.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
        agregado.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
        agregado.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
        agregado.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
        agregado.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
        agregado.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
    },

    /**
     * Renderiza as linhas da tabela
     */
    renderizarLinhas: function(tbody, agregados) {
        const totalGeral = this.criarObjetoValores();

        // Ordem de renderização
        ['3', '4', '9'].forEach(catId => {
            const categoria = agregados[catId];
            if (!categoria) return;

            const valores = categoria.valores;

            // Pular categorias vazias
            if (this.isValoresVazios(valores)) return;

            // Calcular dotação atualizada e saldo
            const dotacaoAtualizada = this.calcularDotacaoAtualizada(valores);
            const saldo = dotacaoAtualizada - valores.despesa_empenhada;

            // Adicionar linha da categoria
            tbody.appendChild(this.criarLinhaCategoria(categoria.nome, valores, dotacaoAtualizada, saldo));

            // Somar ao total geral
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
    },

    /**
     * Verifica se valores estão vazios
     */
    isValoresVazios: function(valores) {
        return valores.dotacao_inicial === 0 && 
               valores.despesa_empenhada === 0 &&
               valores.despesa_liquidada === 0 &&
               valores.despesa_paga === 0;
    },

    /**
     * Calcula dotação atualizada
     */
    calcularDotacaoAtualizada: function(valores) {
        return valores.dotacao_inicial + 
               valores.dotacao_adicional + 
               valores.cancelamento_dotacao + 
               valores.cancel_remaneja_dotacao;
    },

    /**
     * Soma valores ao total geral
     */
    somarAoTotal: function(total, valores) {
        total.dotacao_inicial += valores.dotacao_inicial;
        total.dotacao_adicional += valores.dotacao_adicional;
        total.cancelamento_dotacao += valores.cancelamento_dotacao;
        total.cancel_remaneja_dotacao += valores.cancel_remaneja_dotacao;
        total.despesa_empenhada += valores.despesa_empenhada;
        total.despesa_liquidada += valores.despesa_liquidada;
        total.despesa_paga += valores.despesa_paga;
    },

    /**
     * Cria linha de categoria
     */
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

    /**
     * Cria linha de grupo
     */
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

    /**
     * Cria linha de total
     */
    criarLinhaTotal: function(valores, dotacaoAtualizada, saldo) {
        const tr = document.createElement('tr');
        tr.className = 'total-row table-dark';
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
// FUNÇÕES PRINCIPAIS DA APLICAÇÃO
// ============================================================================

/**
 * Consulta dados e atualiza interface
 */
async function consultarDados() {
    console.log('========== INICIANDO CONSULTA ==========');
    console.log('Timestamp:', Formatadores.dataHora());

    try {
        UI.toggleLoading(true, 'Consultando dados...');

        // Obter valores dos filtros
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);

        console.log(`📅 Parâmetros: Exercício ${exercicio}, Mês ${mes} (${Formatadores.nomeMes(mes)})`);

        // 1. Buscar resumo do servidor
        UI.toggleLoading(true, 'Buscando resumo...');
        const resumoResponse = await fetch(`${AppConfig.apiBaseUrl}/consultar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exercicio_inicial: exercicio - 1,
                exercicio_final: exercicio,
                mes_limite: mes,
                use_cache: true
            })
        });

        const resumoResult = await resumoResponse.json();
        if (resumoResult.success) {
            UI.atualizarCards(resumoResult.resumo);
        }

        // 2. Buscar dados completos
        UI.toggleLoading(true, 'Carregando dados completos...');
        
        // Usar dados em cache se já carregados
        let dados = AppState.dadosCompletos;
        if (!dados) {
            dados = await DadosManager.buscarDados();
        }

        // 3. Aplicar filtros
        UI.toggleLoading(true, 'Aplicando filtros...');
        const dadosFiltrados = DadosManager.filtrarDados(dados, { exercicio, mes });

        // 4. Renderizar tabela
        UI.toggleLoading(true, 'Renderizando tabela...');
        TabelaRenderer.renderizar(dadosFiltrados);

        // 5. Debug - Verificar totais
        if (AppConfig.debug) {
            const totais = DadosManager.calcularTotais(dadosFiltrados);
            console.log('===== VERIFICAÇÃO DE TOTAIS =====');
            console.log('Total de registros filtrados:', dadosFiltrados.length);
            console.log('Dotação Inicial:', Formatadores.moeda(totais.dotacao_inicial));
            console.log('Despesa Empenhada:', Formatadores.moeda(totais.despesa_empenhada));
            console.log('Despesa Liquidada:', Formatadores.moeda(totais.despesa_liquidada));
            console.log('Despesa Paga:', Formatadores.moeda(totais.despesa_paga));
            console.log('==================================');
        }

        // Salvar timestamp
        AppState.ultimaConsulta = new Date();

        UI.mostrarSucesso('Consulta realizada com sucesso!');

    } catch (error) {
        console.error('❌ Erro na consulta:', error);
        UI.mostrarErro(error.message || 'Erro ao consultar dados');
    } finally {
        UI.toggleLoading(false);
        console.log('========== CONSULTA FINALIZADA ==========');
    }
}

/**
 * Exporta dados para arquivo
 */
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
            a.download = `despesa_orcamentaria_${formato}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
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

/**
 * Limpa o cache
 */
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
            // Limpar dados em memória também
            AppState.dadosCompletos = null;
            AppState.dadosFiltrados = null;
            
            UI.mostrarSucesso('Cache limpo com sucesso!');
            
            // Recarregar dados
            await consultarDados();
        }
    } catch (error) {
        UI.mostrarErro('Erro ao limpar cache');
    } finally {
        UI.toggleLoading(false);
    }
}

/**
 * Função de debug - pode ser chamada do console
 */
window.debugDespesa = function() {
    console.log('===== DEBUG - ESTADO DA APLICAÇÃO =====');
    console.log('Config:', AppConfig);
    console.log('Estado:', {
        totalDadosCompletos: AppState.dadosCompletos?.length || 0,
        totalDadosFiltrados: AppState.dadosFiltrados?.length || 0,
        filtrosAtuais: AppState.filtrosAtuais,
        ultimaConsulta: AppState.ultimaConsulta
    });
    
    if (AppState.dadosFiltrados && AppState.dadosFiltrados.length > 0) {
        const totais = DadosManager.calcularTotais(AppState.dadosFiltrados);
        console.log('Totais dos dados filtrados:', totais);
        console.log('Formatado:', {
            dotacao_inicial: Formatadores.moeda(totais.dotacao_inicial),
            despesa_empenhada: Formatadores.moeda(totais.despesa_empenhada),
            despesa_paga: Formatadores.moeda(totais.despesa_paga)
        });
    }
    
    console.log('========================================');
};

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('===== APLICAÇÃO INICIADA =====');
    console.log('Timestamp:', Formatadores.dataHora());
    console.log('Debug mode:', AppConfig.debug ? 'ON' : 'OFF');
    
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
    console.log('💡 Dica: Use debugDespesa() no console para debug');
});