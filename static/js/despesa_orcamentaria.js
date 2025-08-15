/**
 * Sistema de Despesa Orçamentária - Com Filtro de UG
 * Versão 2.0 - Incluindo filtro de Unidade Gestora
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
    ultimaConsulta: null,
    listaUGs: null  // NOVO: Lista de UGs disponíveis
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
     * NOVO: Atualiza badge da UG selecionada
     */
    atualizarBadgeUG: function(ug) {
        const badge = document.getElementById('ugSelecionada');
        if (!badge) return;
        
        if (ug === 'CONSOLIDADO' || !ug) {
            badge.style.display = 'none';
        } else {
            // Encontrar nome da UG
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

        // NOVO: Configurar UG padrão como CONSOLIDADO
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
    }
};

// ============================================================================
// GERENCIADOR DE DADOS
// ============================================================================

const DadosManager = {
    /**
     * NOVO: Busca lista de UGs disponíveis (apenas com movimentação)
     */
    buscarUGs: async function(mostrarTodas = false) {
        try {
            console.log('🔍 Buscando lista de UGs...');
            
            // Usar endpoint dedicado de UGs com parâmetro para filtrar
            const url = mostrarTodas ? 
                `${AppConfig.apiBaseUrl}/ugs?todas=true` : 
                `${AppConfig.apiBaseUrl}/ugs`;
                
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.unidades_gestoras) {
                const ugs = result.unidades_gestoras || [];
                const tipoFiltro = result.filtrado ? '(apenas com movimentação)' : '(todas)';
                console.log(`✅ ${ugs.length} UGs encontradas ${tipoFiltro}`);
                
                AppState.listaUGs = ugs;
                
                // Atualizar select de UGs
                const selectUG = document.getElementById('unidadeGestora');
                if (selectUG && ugs.length > 0) {
                    // Limpar opções existentes (mantendo CONSOLIDADO)
                    while (selectUG.options.length > 1) {
                        selectUG.remove(1);
                    }
                    
                    // Adicionar UGs ordenadas por código
                    ugs.sort((a, b) => a.codigo.localeCompare(b.codigo));
                    ugs.forEach(ug => {
                        const option = new Option(
                            `${ug.codigo} - ${ug.nome}`,
                            ug.codigo
                        );
                        selectUG.add(option);
                    });
                    
                    console.log(`📝 ${ugs.length} UGs adicionadas ao select`);
                    
                    // Adicionar informação se está filtrado
                    if (result.filtrado) {
                        console.log('ℹ️ Mostrando apenas UGs com movimentação financeira');
                    }
                } else if (selectUG && ugs.length === 0) {
                    console.warn('⚠️ Nenhuma UG com movimentação encontrada');
                    
                    // Adicionar opção informativa
                    const option = new Option(
                        'Nenhuma UG com movimentação no período',
                        ''
                    );
                    option.disabled = true;
                    selectUG.add(option);
                }
                
                return ugs;
            } else {
                console.warn('⚠️ Resposta inválida do servidor:', result);
                
                // Tentar endpoint alternativo /api/filtros como fallback
                console.log('🔄 Tentando endpoint alternativo /api/filtros...');
                const response2 = await fetch(`${AppConfig.apiBaseUrl}/filtros`);
                const result2 = await response2.json();
                
                if (result2.success && result2.filtros && result2.filtros.unidades_gestoras) {
                    const ugs = result2.filtros.unidades_gestoras || [];
                    console.log(`✅ ${ugs.length} UGs encontradas (via filtros)`);
                    
                    AppState.listaUGs = ugs;
                    
                    // Atualizar select
                    const selectUG = document.getElementById('unidadeGestora');
                    if (selectUG && ugs.length > 0) {
                        while (selectUG.options.length > 1) {
                            selectUG.remove(1);
                        }
                        
                        ugs.sort((a, b) => a.codigo.localeCompare(b.codigo));
                        ugs.forEach(ug => {
                            const option = new Option(
                                `${ug.codigo} - ${ug.nome}`,
                                ug.codigo
                            );
                            selectUG.add(option);
                        });
                    }
                    
                    return ugs;
                }
            }
        } catch (error) {
            console.error('❌ Erro ao buscar UGs:', error);
        }
        
        return [];
    },

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
     * Aplica filtros aos dados - MODIFICADO para incluir UG
     */
    filtrarDados: function(dados, filtros) {
        if (!dados || dados.length === 0) return [];

        console.log('🔍 Aplicando filtros:', filtros);
        const inicio = Date.now();

        // Variável para debug
        let primeiroDebug = true;

        let dadosFiltrados = dados.filter(row => {
            const exercicio = parseInt(row.COEXERCICIO);
            const mes = parseInt(row.INMES);
            
            // Filtrar pelo exercício e mês
            const exercicioValido = exercicio === filtros.exercicio;
            const mesValido = mes <= filtros.mes;
            
            // NOVO: Filtrar por UG se não for CONSOLIDADO
            // Comparar como string E como número para garantir compatibilidade
            let ugValida = true;
            if (filtros.ug && filtros.ug !== 'CONSOLIDADO') {
                // Converter ambos para string e remover espaços para comparação
                const ugFiltro = String(filtros.ug).trim();
                const ugRow = String(row.COUG).trim();
                
                // Também tentar comparação numérica se ambos forem números
                const ugFiltroNum = parseInt(ugFiltro);
                const ugRowNum = parseInt(ugRow);
                
                ugValida = (ugRow === ugFiltro) || 
                          (!isNaN(ugFiltroNum) && !isNaN(ugRowNum) && ugFiltroNum === ugRowNum);
                
                // Debug para primeira linha
                if (primeiroDebug && row.COUG) {
                    console.log(`Debug UG - Filtro: "${ugFiltro}" (${typeof ugFiltro}), Row: "${ugRow}" (${typeof row.COUG}), Match: ${ugValida}`);
                    primeiroDebug = false;
                }
            }
            
            return exercicioValido && mesValido && ugValida;
        });

        const tempo = Date.now() - inicio;
        console.log(`✅ Filtros aplicados em ${tempo}ms`);
        console.log(`📊 Resultado:`);
        console.log(`   - Exercício ${filtros.exercicio}: ${dadosFiltrados.length} registros`);
        console.log(`   - Até mês ${filtros.mes} (${Formatadores.nomeMes(filtros.mes)})`);
        
        // NOVO: Log da UG filtrada com mais detalhes
        if (filtros.ug && filtros.ug !== 'CONSOLIDADO') {
            const ugInfo = AppState.listaUGs?.find(u => u.codigo === filtros.ug);
            console.log(`   - UG: ${filtros.ug} ${ugInfo ? '- ' + ugInfo.nome : ''}`);
            
            // Debug: verificar se há dados para esta UG em qualquer período
            const todosRegistrosUG = dados.filter(row => {
                const ugRow = String(row.COUG).trim();
                const ugFiltro = String(filtros.ug).trim();
                return ugRow === ugFiltro || parseInt(ugRow) === parseInt(ugFiltro);
            });
            
            if (todosRegistrosUG.length > 0) {
                console.log(`   - Total de registros para UG ${filtros.ug} (todos os períodos): ${todosRegistrosUG.length}`);
                
                // Verificar exercícios disponíveis para esta UG
                const exerciciosUG = [...new Set(todosRegistrosUG.map(r => r.COEXERCICIO))];
                console.log(`   - Exercícios disponíveis para esta UG: ${exerciciosUG.join(', ')}`);
                
                // Verificar meses disponíveis para esta UG no exercício selecionado
                const registrosExercicio = todosRegistrosUG.filter(r => parseInt(r.COEXERCICIO) === filtros.exercicio);
                if (registrosExercicio.length > 0) {
                    const mesesUG = [...new Set(registrosExercicio.map(r => r.INMES))].sort((a, b) => a - b);
                    console.log(`   - Meses disponíveis para ${filtros.exercicio}: ${mesesUG.join(', ')}`);
                }
            } else {
                console.log(`   ⚠️ NENHUM registro encontrado para UG ${filtros.ug} em qualquer período`);
            }
        } else {
            console.log(`   - UG: CONSOLIDADO (todas)`);
        }
        
        console.log(`   - Total: ${dadosFiltrados.length} de ${dados.length} registros`);

        AppState.dadosFiltrados = dadosFiltrados;
        AppState.filtrosAtuais = filtros;

        return dadosFiltrados;
    },

    /**
     * Calcula totais dos dados filtrados
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
        
        dados.forEach(row => {
            totais.dotacao_inicial += parseFloat(row.DOTACAO_INICIAL || 0);
            totais.dotacao_adicional += parseFloat(row.DOTACAO_ADICIONAL || 0);
            totais.cancelamento_dotacao += parseFloat(row.CANCELAMENTO_DOTACAO || 0);
            totais.cancel_remaneja_dotacao += parseFloat(row.CANCEL_REMANEJA_DOTACAO || 0);
            totais.despesa_empenhada += parseFloat(row.DESPESA_EMPENHADA || 0);
            totais.despesa_liquidada += parseFloat(row.DESPESA_LIQUIDADA || 0);
            totais.despesa_paga += parseFloat(row.DESPESA_PAGA || 0);
        });
        
        totais.dotacao_atualizada = totais.dotacao_inicial + 
                                    totais.dotacao_adicional + 
                                    totais.cancelamento_dotacao + 
                                    totais.cancel_remaneja_dotacao;
        
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
// FUNÇÃO PRINCIPAL DE CONSULTA - MODIFICADA PARA INCLUIR UG
// ============================================================================

async function consultarDados() {
    console.log('========== INICIANDO CONSULTA ==========');
    console.log('Timestamp:', Formatadores.dataHora());

    try {
        // 1. Preparar UI
        UI.mostrarLoadingCards();
        UI.toggleLoading(true, 'Consultando dados...');

        // 2. Obter filtros (INCLUINDO UG)
        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);
        const ug = document.getElementById('unidadeGestora').value;

        console.log(`📅 Filtros selecionados:`);
        console.log(`   - Exercício: ${exercicio}`);
        console.log(`   - Mês: ${mes} (${Formatadores.nomeMes(mes)})`);
        console.log(`   - UG: ${ug === 'CONSOLIDADO' ? 'CONSOLIDADO (todas)' : ug}`);

        // 3. Atualizar badge da UG
        UI.atualizarBadgeUG(ug);

        // 4. Buscar dados completos (usar cache se já carregado)
        UI.toggleLoading(true, 'Carregando dados...');
        
        let dados = AppState.dadosCompletos;
        if (!dados) {
            dados = await DadosManager.buscarDados();
            
            // Carregar lista de UGs se ainda não tiver
            if (!AppState.listaUGs) {
                await DadosManager.buscarUGs();
            }
        }

        // 5. Filtrar dados incluindo UG
        UI.toggleLoading(true, 'Aplicando filtros...');
        const dadosFiltrados = DadosManager.filtrarDados(dados, { 
            exercicio, 
            mes,
            ug  // NOVO: incluir UG no filtro
        });

        // 6. Calcular totais dos dados filtrados
        const totais = DadosManager.calcularTotais(dadosFiltrados);
        AppState.totaisCalculados = totais;
        
        // 7. Atualizar cards
        UI.removerLoadingCards();
        UI.atualizarValorCard('totalRegistros', Formatadores.numero(dadosFiltrados.length));
        UI.atualizarValorCard('dotacaoInicial', Formatadores.moedaCompacta(totais.dotacao_inicial));
        UI.atualizarValorCard('despesaEmpenhada', Formatadores.moedaCompacta(totais.despesa_empenhada));
        UI.atualizarValorCard('despesaPaga', Formatadores.moedaCompacta(totais.despesa_paga));

        // 8. Renderizar tabela
        UI.toggleLoading(true, 'Montando demonstrativo...');
        const totaisTabela = TabelaRenderer.renderizar(dadosFiltrados);

        // 9. Debug
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
            console.log('================================');
        }

        // 10. Finalizar
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
// FUNÇÕES DE EXPORTAÇÃO - MODIFICADAS PARA INCLUIR UG
// ============================================================================

async function exportarDados(formato) {
    try {
        UI.toggleLoading(true, `Exportando para ${formato.toUpperCase()}...`);

        // Incluir UG no nome do arquivo se estiver filtrado
        const ug = document.getElementById('unidadeGestora').value;
        let nomeArquivo = `despesa_orcamentaria_${new Date().toISOString().slice(0,10)}`;
        
        if (ug && ug !== 'CONSOLIDADO') {
            nomeArquivo += `_UG_${ug}`;
        }

        const response = await fetch(`${AppConfig.apiBaseUrl}/exportar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                formato,
                nome_arquivo: nomeArquivo,
                ug: ug !== 'CONSOLIDADO' ? ug : null
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${nomeArquivo}.${formato === 'excel' ? 'xlsx' : 'csv'}`;
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
            AppState.listaUGs = null;
            
            UI.mostrarSucesso('Cache limpo com sucesso!');
            
            // Recarregar dados e UGs
            await DadosManager.buscarUGs();
            await consultarDados();
        }
    } catch (error) {
        UI.mostrarErro('Erro ao limpar cache');
    } finally {
        UI.toggleLoading(false);
    }
}

// ============================================================================
// FUNÇÕES DE DEBUG - ATUALIZADAS
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
    
    // Listar UGs disponíveis
    if (AppState.listaUGs && AppState.listaUGs.length > 0) {
        console.log(`UGs disponíveis: ${AppState.listaUGs.length}`);
        console.log('Primeiras 5 UGs:', AppState.listaUGs.slice(0, 5));
    }
    
    console.log('========================================');
};

/**
 * NOVA: Lista todas as UGs disponíveis
 */
window.listarUGs = function() {
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
};

/**
 * NOVA: Verifica UGs nos dados carregados
 */
window.verificarUGsNosDados = function() {
    if (!AppState.dadosCompletos || AppState.dadosCompletos.length === 0) {
        console.log('❌ Nenhum dado carregado. Execute consultarDados() primeiro.');
        return;
    }
    
    console.log('===== UGs NOS DADOS CARREGADOS =====');
    
    // Obter UGs únicas dos dados
    const ugsNosDados = new Set();
    const ugsPorCodigo = {};
    
    AppState.dadosCompletos.forEach(row => {
        if (row.COUG) {
            const codigo = String(row.COUG).trim();
            ugsNosDados.add(codigo);
            
            if (!ugsPorCodigo[codigo]) {
                ugsPorCodigo[codigo] = {
                    codigo: codigo,
                    nome: row.NOUG || 'SEM NOME',
                    tipo: typeof row.COUG,
                    registros: 0
                };
            }
            ugsPorCodigo[codigo].registros++;
        }
    });
    
    console.log(`Total de UGs únicas nos dados: ${ugsNosDados.size}`);
    console.log('');
    console.log('Primeiras 10 UGs:');
    
    const ugsArray = Object.values(ugsPorCodigo).sort((a, b) => a.codigo.localeCompare(b.codigo));
    ugsArray.slice(0, 10).forEach(ug => {
        console.log(`${ug.codigo} (tipo: ${ug.tipo}) - ${ug.nome} - ${ug.registros} registros`);
    });
    
    // Verificar se a UG 10901 existe
    if (ugsPorCodigo['10901']) {
        console.log('');
        console.log('✅ UG 10901 encontrada nos dados:', ugsPorCodigo['10901']);
    } else {
        console.log('');
        console.log('❌ UG 10901 NÃO encontrada nos dados');
        
        // Procurar variações
        const variacoes = ['010901', '10901', ' 10901', '10901 '];
        console.log('Procurando variações...');
        variacoes.forEach(v => {
            if (ugsPorCodigo[v]) {
                console.log(`Encontrada como: "${v}"`);
            }
        });
    }
    
    console.log('=====================================');
};

// ============================================================================
// INICIALIZAÇÃO - MODIFICADA PARA CARREGAR UGs
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('===== APLICAÇÃO INICIADA =====');
    console.log('Timestamp:', Formatadores.dataHora());
    console.log('Versão: 2.1 - Com filtro de UG (apenas com movimento)');
    console.log('Debug:', AppConfig.debug ? 'ATIVADO' : 'DESATIVADO');
    
    // Verificar elementos essenciais
    const elementosRequeridos = [
        'tabelaCorpo', 'exercicio', 'mes', 'unidadeGestora',
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
    
    // NOVO: Adicionar eventos para recarregar UGs quando mudar exercício ou mês
    const selectExercicio = document.getElementById('exercicio');
    const selectMes = document.getElementById('mes');
    
    if (selectExercicio) {
        selectExercicio.addEventListener('change', async function() {
            console.log('📅 Exercício alterado, recarregando UGs...');
            
            // Resetar UG para CONSOLIDADO
            const selectUG = document.getElementById('unidadeGestora');
            if (selectUG) {
                selectUG.value = 'CONSOLIDADO';
            }
            
            // Buscar dados primeiro para ter o contexto atualizado
            await consultarDados();
            
            // Recarregar UGs com movimento para o novo período
            await DadosManager.buscarUGs(false);
        });
    }
    
    if (selectMes) {
        selectMes.addEventListener('change', async function() {
            console.log('📅 Mês alterado, recarregando UGs...');
            
            // Resetar UG para CONSOLIDADO
            const selectUG = document.getElementById('unidadeGestora');
            if (selectUG) {
                selectUG.value = 'CONSOLIDADO';
            }
            
            // Buscar dados primeiro para ter o contexto atualizado
            await consultarDados();
            
            // Recarregar UGs com movimento para o novo período
            await DadosManager.buscarUGs(false);
        });
    }
    
    // NOVO: Carregar lista de UGs primeiro (apenas com movimento)
    console.log('📊 Carregando lista de UGs com movimentação...');
    await DadosManager.buscarUGs(false); // false = apenas com movimento
    
    // Iniciar consulta automática
    console.log('📊 Iniciando consulta automática...');
    await consultarDados();
    
    console.log('===== INICIALIZAÇÃO COMPLETA =====');
    console.log('💡 Dicas de debug:');
    console.log('   - debugDespesa() para ver estado da aplicação');
    console.log('   - listarUGs() para ver UGs carregadas');
    console.log('   - DadosManager.buscarUGs(true) para carregar TODAS as UGs');
    console.log('   - consultarDados() para recarregar dados');
});

/**
 * NOVA: Função para mostrar/ocultar todas as UGs
 */
window.toggleTodasUGs = async function() {
    const mostrarTodas = confirm('Deseja mostrar TODAS as UGs, mesmo sem movimentação?');
    
    if (mostrarTodas) {
        console.log('🔄 Carregando TODAS as UGs...');
        await DadosManager.buscarUGs(true);
        console.log('✅ Mostrando todas as UGs');
    } else {
        console.log('🔄 Carregando apenas UGs com movimentação...');
        await DadosManager.buscarUGs(false);
        console.log('✅ Mostrando apenas UGs com movimentação');
    }
};