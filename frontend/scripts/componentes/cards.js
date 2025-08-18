/**
 * Componente de Cards - Renderiza cards de resumo
 */

import { Formatador } from '../utilitarios/formatador.js';

export class CardsResumo {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
    }
    
    /**
     * Renderiza os cards
     */
    renderizar(totais) {
        if (!this.container || !totais) return;
        
        const { atual, anterior, registros_atual, registros_anterior } = totais;
        
        // Calcular variações
        const varEmpenhada = Formatador.variacao(
            atual.despesa_empenhada, 
            anterior.despesa_empenhada
        );
        
        const varPaga = Formatador.variacao(
            atual.despesa_paga,
            anterior.despesa_paga
        );
        
        const html = `
            <div class="row" id="summaryCards">
                <div class="col-lg-3 col-md-6 mb-3">
                    <div class="summary-card card-registros">
                        <div>
                            <div class="card-value">
                                ${Formatador.numero(registros_atual)}
                            </div>
                            <div class="card-label">
                                Total de Registros
                                <small class="d-block text-muted">
                                    ${Formatador.numero(registros_anterior)} no ano anterior
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-3 col-md-6 mb-3">
                    <div class="summary-card card-dotacao">
                        <div>
                            <div class="card-value">
                                ${Formatador.moedaCompacta(atual.dotacao_inicial)}
                            </div>
                            <div class="card-label">Dotação Inicial</div>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-3 col-md-6 mb-3">
                    <div class="summary-card card-empenhada">
                        <div>
                            <div class="card-value">
                                ${Formatador.moedaCompacta(atual.despesa_empenhada)}
                                <small class="${varEmpenhada.classe} d-block">
                                    ${varEmpenhada.icone} ${varEmpenhada.valor}
                                </small>
                            </div>
                            <div class="card-label">Despesa Empenhada</div>
                        </div>
                    </div>
                </div>
                
                <div class="col-lg-3 col-md-6 mb-3">
                    <div class="summary-card card-paga">
                        <div>
                            <div class="card-value">
                                ${Formatador.moedaCompacta(atual.despesa_paga)}
                                <small class="${varPaga.classe} d-block">
                                    ${varPaga.icone} ${varPaga.valor}
                                </small>
                            </div>
                            <div class="card-label">Despesa Paga</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    /**
     * Mostra estado de carregamento
     */
    mostrarCarregando() {
        if (!this.container) return;
        
        const html = `
            <div class="row" id="summaryCards">
                ${[1, 2, 3, 4].map(() => `
                    <div class="col-lg-3 col-md-6 mb-3">
                        <div class="summary-card">
                            <div class="text-center">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Carregando...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        this.container.innerHTML = html;
    }
}