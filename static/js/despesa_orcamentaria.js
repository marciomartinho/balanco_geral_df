/**
 * Sistema de Despesa Orçamentária - Com Quadro de Créditos Adicionais
 * Versão 3.0 - Incluindo detalhamento de créditos adicionais
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
    totaisCreditos: null,
    ultimaConsulta: null,
    listaUGs: null
};

// ============================================================================
// FORMATADORES
// ============================================================================

const Formatadores = {
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

    moeda: function(valor) {
        if (valor === null || valor === undefined || isNaN(valor)) {
            return 'R$ 0,00';
        }
        const numero = typeof valor === 'string' ? parseFloat(valor) : valor;
        return new Intl.NumberFormat('pt-BR', AppConfig.formatoMoeda).format(numero || 0);
    },

    numero: function(num) {
        if (num === null || num === undefined || isNaN(num)) {
            return '0';
        }
        return new Intl.NumberFormat('pt-BR').format(num);
    },

    nomeMes: function(numeroMes) {
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        return meses[numeroMes - 1] || '';
    },

    dataHora: function(date = new Date()) {
        return date.toLocaleString('pt-BR');
    }
};

// ============================================================================
// GERENCIADOR DE UI
// ============================================================================

const UI = {
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

    removerLoadingCards: function() {
        const cards = ['totalRegistros', 'dotacaoInicial', 'despesaEmpenhada', 'despesaPaga'];
        cards.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.classList.remove('loading');
            }
        });
    },

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

    mostrarCardsVazios: function() {
        this.atualizarValorCard('totalRegistros', '0');
        this.atualizarValorCard('dotacaoInicial', 'R$ 0,00');
        this.atualizarValorCard('despesaEmpenhada', 'R$ 0,00');
        this.atualizarValorCard('despesaPaga', 'R$ 0,00');
    },

    atualizarBadgeUG: function(ug) {
        const badge = document.getElementById('ugSelecionada');
        if (!badge) return;
        
        if (ug === 'CONSOLIDADO' || !ug) {
            badge.style.display = 'none';
        } else {
            const ugInfo = AppState.listaUGs?.find(u => u.codigo === ug);
            if (ugInfo) {
                badge.textContent = `${ugInfo.codigo} - ${ugInfo.nome}`;
            } else {
                badge.textContent = `UG: ${ug}`;
            }
            badge.style.display = 'inline-block';
        }
    },

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

    mostrarErro: function(mensagem) {
        console.error('❌ ERRO:', mensagem);
        alert('Erro: ' + mensagem);
    },

    mostrarSucesso: function(mensagem) {
        console.log('✅ SUCESSO:', mensagem);
    }
};

// ============================================================================
// GERENCIADOR DE DADOS
// ============================================================================

const DadosManager = {
    buscarUGs: async function(mostrarTodas = false) {
        try {
            console.log('🔍 Buscando lista de UGs...');
            
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
                    
                    console.log(`📝 ${ugs.length} UGs adicionadas ao select`);
                }
                
                return ugs;
            }
        } catch (error) {
            console.error('❌ Erro ao buscar UGs:', error);
        }
        
        return [];
    },

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

    filtrarDados: function(dados, filtros) {
        if (!dados || dados.length === 0) return [];

        console.log('🔍 Aplicando filtros:', filtros);
        const inicio = Date.now();

        let dadosFiltrados = dados.filter(row => {
            const exercicio = parseInt(row.COEXERCICIO);
            const mes = parseInt(row.INMES);
            
            const exercicioValido = exercicio === filtros.exercicio;
            const mesValido = mes <= filtros.mes;
            
            let ugValida = true;
            if (filtros.ug && filtros.ug !== 'CONSOLIDADO') {
                const ugFiltro = String(filtros.ug).trim();
                const ugRow = String(row.COUG).trim();
                
                const ugFiltroNum = parseInt(ugFiltro);
                const ugRowNum = parseInt(ugRow);
                
                ugValida = (ugRow === ugFiltro) || 
                          (!isNaN(ugFiltroNum) && !isNaN(ugRowNum) && ugFiltroNum === ugRowNum);
            }
            
            return exercicioValido && mesValido && ugValida;
        });

        const tempo = Date.now() - inicio;
        console.log(`✅ Filtros aplicados em ${tempo}ms`);
        console.log(`📊 Resultado: ${dadosFiltrados.length} registros`);

        AppState.dadosFiltrados = dadosFiltrados;
        AppState.filtrosAtuais = filtros;

        return dadosFiltrados;
    },

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
    },

    calcularTotaisCreditos: function(dados) {
        const totais = {
            credito_suplementar: 0,
            credito_especial_aberto: 0,
            credito_especial_reaberto: 0,
            credito_extraordinario_reaberto: 0,
            cancel_credito_suplementar: 0,
            remanejamento_veto_lei: 0,
            cancel_credito_especial: 0,
            total_alteracoes: 0
        };
        
        if (!dados || dados.length === 0) return totais;
        
        dados.forEach(row => {
            totais.credito_suplementar += parseFloat(row.CREDITO_SUPLEMENTAR || 0);
            totais.credito_especial_aberto += parseFloat(row.CREDITO_ESPECIAL_ABERTO || 0);
            totais.credito_especial_reaberto += parseFloat(row.CREDITO_ESPECIAL_REABERTO || 0);
            totais.credito_extraordinario_reaberto += parseFloat(row.CREDITO_EXTRAORD_REABERTO || 0);
            totais.cancel_credito_suplementar += parseFloat(row.CANCEL_CREDITO_SUPLEMENTAR || 0);
            totais.remanejamento_veto_lei += parseFloat(row.REMANEJAMENTO_VETO_LEI || 0);
            totais.cancel_credito_especial += parseFloat(row.CANCEL_CREDITO_ESPECIAL || 0);
        });
        
        totais.total_alteracoes = totais.credito_suplementar + 
                                  totais.credito_especial_aberto + 
                                  totais.credito_especial_reaberto + 
                                  totais.credito_extraordinario_reaberto +
                                  totais.cancel_credito_suplementar +
                                  totais.remanejamento_veto_lei +
                                  totais.cancel_credito_especial;
        
        return totais;
    }
};

// ============================================================================
// RENDERIZADOR DE TABELA PRINCIPAL
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
// RENDERIZADOR DA TABELA DE CRÉDITOS
// ============================================================================

const TabelaCreditosRenderer = {
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

        Object.entries(TabelaRenderer.estruturaCategorias).forEach(([catId, catInfo]) => {
            agregados[catId] = {
                nome: catInfo.nome,
                valores: this.criarObjetoValoresCreditos(),
                grupos: {}
            };

            Object.entries(catInfo.grupos).forEach(([grupoId, grupoNome]) => {
                agregados[catId].grupos[grupoId] = {
                    nome: grupoNome,
                    valores: this.criarObjetoValoresCreditos()
                };
            });
        });

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

    criarObjetoValoresCreditos: function() {
        return {
            credito_suplementar: 0,
            credito_especial_aberto: 0,
            credito_especial_reaberto: 0,
            credito_extraordinario_reaberto: 0,
            cancel_credito_suplementar: 0,
            remanejamento_veto_lei: 0,
            cancel_credito_especial: 0,
            total_alteracoes: 0
        };
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
        const totalGeral = this.criarObjetoValoresCreditos();

        ['3', '4', '9'].forEach(catId => {
            const categoria = agregados[catId];
            if (!categoria) return;

            const valores = categoria.valores;
            if (this.isValoresCreditosVazios(valores)) return;

            tbody.appendChild(this.criarLinhaCategoriaCreditos(categoria.nome, valores));
            this.somarAoTotalCreditos(totalGeral, valores);

            const ordemGrupos = catId === '3' ? ['1', '2', '3'] : 
                               catId === '4' ? ['4', '5', '6'] : [];

            ordemGrupos.forEach(grupoId => {
                const grupo = categoria.grupos[grupoId];
                if (!grupo || this.isValoresCreditosVazios(grupo.valores)) return;

                tbody.appendChild(this.criarLinhaGrupoCreditos(grupo.nome, grupo.valores));
            });
        });

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

// ============================================================================
// FUNÇÃO PRINCIPAL DE CONSULTA
// ============================================================================

async function consultarDados() {
    console.log('========== INICIANDO CONSULTA ==========');
    console.log('Timestamp:', Formatadores.dataHora());

    try {
        UI.mostrarLoadingCards();
        UI.toggleLoading(true, 'Consultando dados...');

        const exercicio = parseInt(document.getElementById('exercicio').value);
        const mes = parseInt(document.getElementById('mes').value);
        const ug = document.getElementById('unidadeGestora').value;

        console.log(`📅 Filtros selecionados:`);
        console.log(`   - Exercício: ${exercicio}`);
        console.log(`   - Mês: ${mes} (${Formatadores.nomeMes(mes)})`);
        console.log(`   - UG: ${ug === 'CONSOLIDADO' ? 'CONSOLIDADO (todas)' : ug}`);

        UI.atualizarBadgeUG(ug);

        UI.toggleLoading(true, 'Carregando dados...');
        
        let dados = AppState.dadosCompletos;
        if (!dados) {
            dados = await DadosManager.buscarDados();
            
            if (!AppState.listaUGs) {
                await DadosManager.buscarUGs();
            }
        }

        UI.toggleLoading(true, 'Aplicando filtros...');
        const dadosFiltrados = DadosManager.filtrarDados(dados, { 
            exercicio, 
            mes,
            ug
        });

        const totais = DadosManager.calcularTotais(dadosFiltrados);
        AppState.totaisCalculados = totais;
        
        UI.removerLoadingCards();
        UI.atualizarValorCard('totalRegistros', Formatadores.numero(dadosFiltrados.length));
        UI.atualizarValorCard('dotacaoInicial', Formatadores.moedaCompacta(totais.dotacao_inicial));
        UI.atualizarValorCard('despesaEmpenhada', Formatadores.moedaCompacta(totais.despesa_empenhada));
        UI.atualizarValorCard('despesaPaga', Formatadores.moedaCompacta(totais.despesa_paga));

        UI.toggleLoading(true, 'Montando demonstrativo...');
        const totaisTabela = TabelaRenderer.renderizar(dadosFiltrados);

        UI.toggleLoading(true, 'Montando quadro de créditos...');
        const totaisCreditos = TabelaCreditosRenderer.renderizar(dadosFiltrados);

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

        const response = await fetch(`${AppConfig.apiBaseUrl}/exportar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                formato,
                nome_arquivo: nomeArquivo,
                ug: ug !== 'CONSOLIDADO' ? ug : null,
                incluir_creditos: true
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
            AppState.totaisCreditos = null;
            AppState.listaUGs = null;
            
            UI.mostrarSucesso('Cache limpo com sucesso!');
            
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
// FUNÇÕES DE DEBUG
// ============================================================================

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
};

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

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('===== APLICAÇÃO INICIADA =====');
    console.log('Timestamp:', Formatadores.dataHora());
    console.log('Versão: 3.0 - Com Quadro de Créditos Adicionais');
    console.log('Debug:', AppConfig.debug ? 'ATIVADO' : 'DESATIVADO');
    
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
    
    UI.configurarFiltrosPadrao();
    
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
            await DadosManager.buscarUGs(false);
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
            await DadosManager.buscarUGs(false);
        });
    }
    
    console.log('📊 Carregando lista de UGs com movimentação...');
    await DadosManager.buscarUGs(false);
    
    console.log('📊 Iniciando consulta automática...');
    await consultarDados();
    
    console.log('===== INICIALIZAÇÃO COMPLETA =====');
    console.log('💡 Dicas de debug:');
    console.log('   - debugDespesa() para ver estado da aplicação');
    console.log('   - listarUGs() para ver UGs carregadas');
    console.log('   - consultarDados() para recarregar dados');
});

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