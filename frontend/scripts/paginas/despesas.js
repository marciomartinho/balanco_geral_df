/**
 * Controlador da Página de Despesas
 * Orquestra todos os componentes
 */

import { DespesaAPI } from '../utilitarios/api.js';
import { Formatador } from '../utilitarios/formatador.js';
import { FiltrosConsulta } from '../componentes/filtros.js';
import { CardsResumo } from '../componentes/cards.js';
import { TabelaDemonstrativo } from '../componentes/tabela.js';

export class DespesasPage {
    constructor() {
        // API
        this.api = new DespesaAPI();
        
        // Componentes
        this.filtros = new FiltrosConsulta('filtrosConsulta');
        this.cards = new CardsResumo('cardsResumo');
        this.tabela = new TabelaDemonstrativo('tabelaDemonstrativo');
        
        // Estado
        this.dadosAtuais = null;
    }
    
    /**
     * Inicializa a página
     */
    async inicializar() {
        console.log('🚀 Inicializando página de despesas...');
        
        try {
            // Renderizar componentes
            this.filtros.renderizar();
            this.cards.mostrarCarregando();
            
            // Configurar eventos
            this.filtros.onChange = (filtros) => this.carregarDados(filtros);
            
            // Carregar UGs
            await this.carregarUGs();
            
            // Carregar dados iniciais
            await this.carregarDados(this.filtros.obterValores());
            
            // Configurar botões de ação
            this.configurarBotoesAcao();
            
            console.log('✅ Página inicializada com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar página:', error);
            this.mostrarErro(error.message);
        }
    }
    
    /**
     * Carrega lista de UGs
     */
    async carregarUGs() {
        try {
            const resultado = await this.api.listarUGs();
            
            if (resultado.success && resultado.unidades_gestoras) {
                this.filtros.carregarUGs(resultado.unidades_gestoras);
            }
        } catch (error) {
            console.error('Erro ao carregar UGs:', error);
        }
    }
    
    /**
     * Carrega dados do demonstrativo
     */
    async carregarDados(filtros) {
        try {
            this.mostrarCarregando(true);
            
            console.log('📊 Carregando dados:', filtros);
            
            // Buscar dados
            const resultado = await this.api.buscarDemonstrativo(
                filtros.exercicio,
                filtros.mes,
                filtros.ug
            );
            
            if (!resultado.success) {
                throw new Error(resultado.message || 'Erro ao carregar dados');
            }
            
            // Salvar dados
            this.dadosAtuais = resultado;
            
            // Renderizar componentes
            this.cards.renderizar(resultado.totais);
            this.tabela.renderizar(resultado);
            
            // Atualizar interface
            this.atualizarInterface(resultado);
            
            this.mostrarMensagem('Dados carregados com sucesso', 'success');
            
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            this.mostrarErro(error.message);
            
        } finally {
            this.mostrarCarregando(false);
        }
    }
    
    /**
     * Configura botões de ação
     */
    configurarBotoesAcao() {
        const container = document.getElementById('botoesAcao');
        if (!container) return;
        
        container.innerHTML = `
            <div class="acoes-container">
                <button class="btn btn-success" id="btnExportarExcel">
                    <i class="fas fa-file-excel"></i> Exportar Excel
                </button>
                <button class="btn btn-info" id="btnExportarCSV">
                    <i class="fas fa-file-csv"></i> Exportar CSV
                </button>
                <button class="btn btn-warning" id="btnLimparCache">
                    <i class="fas fa-sync-alt"></i> Limpar Cache
                </button>
                <button class="btn btn-secondary" id="btnExpandirTodos">
                    <i class="fas fa-expand-alt"></i> Expandir Todos
                </button>
            </div>
        `;
        
        // Event listeners
        document.getElementById('btnExportarExcel')?.addEventListener('click', 
            () => this.exportar('excel')
        );
        
        document.getElementById('btnExportarCSV')?.addEventListener('click', 
            () => this.exportar('csv')
        );
        
        document.getElementById('btnLimparCache')?.addEventListener('click', 
            () => this.limparCache()
        );
        
        document.getElementById('btnExpandirTodos')?.addEventListener('click', 
            () => this.expandirTodos()
        );
    }
    
    /**
     * Exporta dados
     */
    async exportar(formato) {
        if (!this.dadosAtuais) {
            this.mostrarErro('Nenhum dado para exportar');
            return;
        }
        
        const filtros = this.filtros.obterValores();
        
        await this.api.exportar(
            formato,
            filtros.exercicio,
            filtros.mes,
            filtros.ug
        );
        
        this.mostrarMensagem(`Exportando para ${formato.toUpperCase()}...`, 'info');
    }
    
    /**
     * Limpa cache do servidor
     */
    async limparCache() {
        if (!confirm('Deseja limpar o cache? A próxima consulta será mais demorada.')) {
            return;
        }
        
        try {
            this.mostrarCarregando(true);
            
            const resultado = await this.api.limparCacheServidor();
            
            if (resultado.success) {
                this.mostrarMensagem('Cache limpo com sucesso', 'success');
                
                // Recarregar dados
                await this.carregarDados(this.filtros.obterValores());
            }
            
        } catch (error) {
            this.mostrarErro('Erro ao limpar cache');
        } finally {
            this.mostrarCarregando(false);
        }
    }
    
    /**
     * Expande todos os detalhes
     */
    expandirTodos() {
        // Implementar quando houver detalhes
        console.log('Expandir todos');
    }
    
    /**
     * Atualiza elementos da interface
     */
    atualizarInterface(dados) {
        // Badge UG
        const badgeContainer = document.getElementById('badgeUG');
        if (badgeContainer) {
            if (dados.ug && dados.ug !== 'CONSOLIDADO') {
                badgeContainer.innerHTML = `
                    <span id="ugSelecionada" class="badge bg-info">
                        UG: ${dados.ug}
                    </span>
                `;
            } else {
                badgeContainer.innerHTML = '';
            }
        }
        
        // Informações
        const infoContainer = document.getElementById('informacoes');
        if (infoContainer) {
            const nomeMes = Formatador.nomeMes(dados.mes);
            
            infoContainer.innerHTML = `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    <strong>Período:</strong> 
                    Comparando Janeiro-${nomeMes}/${dados.exercicio_atual} 
                    com Janeiro-${nomeMes}/${dados.exercicio_anterior}
                </div>
            `;
        }
    }
    
    /**
     * Mostra/oculta loading
     */
    mostrarCarregando(mostrar) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.toggle('active', mostrar);
        }
    }
    
    /**
     * Mostra mensagem
     */
    mostrarMensagem(texto, tipo = 'info') {
        console.log(`[${tipo.toUpperCase()}] ${texto}`);
        // TODO: Implementar toast/notificação
    }
    
    /**
     * Mostra erro
     */
    mostrarErro(mensagem) {
        console.error('❌', mensagem);
        this.mostrarMensagem(mensagem, 'error');
        
        // Mostrar na tabela
        const container = document.getElementById('tabelaDemonstrativo');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Erro:</strong> ${mensagem}
                </div>
            `;
        }
    }
}