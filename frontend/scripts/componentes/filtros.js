/**
 * Componente de Filtros - Gerencia filtros de consulta
 */

export class FiltrosConsulta {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.valores = {
            exercicio: new Date().getFullYear(),
            mes: new Date().getMonth() + 1,
            ug: 'CONSOLIDADO'
        };
        this.onChange = null;
    }
    
    /**
     * Renderiza os filtros
     */
    renderizar() {
        if (!this.container) return;
        
        const html = `
            <div class="filter-card">
                <h5>
                    <i class="fas fa-filter"></i> 
                    Filtros de Consulta
                </h5>
                <div class="row align-items-end">
                    <div class="col-md-3 mb-3 mb-md-0">
                        <label for="exercicio" class="form-label">Exercício</label>
                        <select class="form-select" id="exercicio">
                            ${this._criarOpcoesAnos()}
                        </select>
                    </div>
                    <div class="col-md-3 mb-3 mb-md-0">
                        <label for="mes" class="form-label">Mês de Referência</label>
                        <select class="form-select" id="mes">
                            ${this._criarOpcoesMeses()}
                        </select>
                    </div>
                    <div class="col-md-4 mb-3 mb-md-0">
                        <label for="unidadeGestora" class="form-label">Unidade Gestora</label>
                        <select class="form-select" id="unidadeGestora">
                            <option value="CONSOLIDADO">CONSOLIDADO - Todas as Unidades</option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-primary w-100" id="btnConsultar">
                            <i class="fas fa-search"></i> 
                            Consultar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this._configurarEventos();
        this._definirValoresPadrao();
    }
    
    /**
     * Cria opções de anos
     */
    _criarOpcoesAnos() {
        const anoAtual = new Date().getFullYear();
        let html = '';
        
        for (let ano = 2023; ano <= anoAtual + 1; ano++) {
            const selected = ano === this.valores.exercicio ? 'selected' : '';
            html += `<option value="${ano}" ${selected}>${ano}</option>`;
        }
        
        return html;
    }
    
    /**
     * Cria opções de meses
     */
    _criarOpcoesMeses() {
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril',
            'Maio', 'Junho', 'Julho', 'Agosto',
            'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        let html = '';
        meses.forEach((mes, index) => {
            const valor = index + 1;
            const selected = valor === this.valores.mes ? 'selected' : '';
            html += `<option value="${valor}" ${selected}>${mes}</option>`;
        });
        
        return html;
    }
    
    /**
     * Define valores padrão
     */
    _definirValoresPadrao() {
        const exercicioSelect = document.getElementById('exercicio');
        const mesSelect = document.getElementById('mes');
        
        if (exercicioSelect) exercicioSelect.value = this.valores.exercicio;
        if (mesSelect) mesSelect.value = this.valores.mes;
    }
    
    /**
     * Configura eventos
     */
    _configurarEventos() {
        const btnConsultar = document.getElementById('btnConsultar');
        const exercicioSelect = document.getElementById('exercicio');
        const mesSelect = document.getElementById('mes');
        const ugSelect = document.getElementById('unidadeGestora');
        
        if (btnConsultar) {
            btnConsultar.addEventListener('click', () => this._handleConsultar());
        }
        
        // Auto-consulta ao mudar filtros
        [exercicioSelect, mesSelect, ugSelect].forEach(select => {
            if (select) {
                select.addEventListener('change', () => this._handleConsultar());
            }
        });
    }
    
    /**
     * Handler do botão consultar
     */
    _handleConsultar() {
        this.valores.exercicio = parseInt(document.getElementById('exercicio').value);
        this.valores.mes = parseInt(document.getElementById('mes').value);
        this.valores.ug = document.getElementById('unidadeGestora').value;
        
        console.log('🔍 Filtros alterados:', this.valores);
        
        if (this.onChange) {
            this.onChange(this.valores);
        }
    }
    
    /**
     * Obtém valores atuais dos filtros
     */
    obterValores() {
        return { ...this.valores };
    }
    
    /**
     * Carrega UGs no select
     */
    carregarUGs(ugs) {
        const select = document.getElementById('unidadeGestora');
        if (!select) return;
        
        // Limpar opções (exceto CONSOLIDADO)
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Adicionar UGs
        ugs.forEach(ug => {
            const option = new Option(
                `${ug.codigo} - ${ug.nome}`,
                ug.codigo
            );
            select.add(option);
        });
        
        console.log(`✅ ${ugs.length} UGs carregadas`);
    }
}