/**
 * Cliente API - Centraliza todas as chamadas HTTP
 */

export class ApiClient {
    constructor(baseUrl = '/api/despesas') {
        this.baseUrl = baseUrl;
        this.cache = new Map();
    }
    
    /**
     * Faz uma requisição GET
     */
    async get(endpoint, params = {}) {
        // Construir query string
        const queryString = new URLSearchParams(params).toString();
        const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
        
        // Verificar cache
        const cacheKey = url;
        if (this.cache.has(cacheKey)) {
            console.log('📦 Usando cache para:', endpoint);
            return this.cache.get(cacheKey);
        }
        
        try {
            console.log('🔄 Buscando:', url);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cachear resposta bem-sucedida
            if (data.success) {
                this.cache.set(cacheKey, data);
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Erro na API:', error);
            throw error;
        }
    }
    
    /**
     * Faz uma requisição POST
     */
    async post(endpoint, data = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            console.log('📤 Enviando:', url, data);
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('❌ Erro na API:', error);
            throw error;
        }
    }
    
    /**
     * Limpa o cache
     */
    limparCache() {
        this.cache.clear();
        console.log('🧹 Cache da API limpo');
    }
}

/**
 * Serviço de Despesas - Métodos específicos
 */
export class DespesaAPI extends ApiClient {
    constructor() {
        super('/api/despesas');
    }
    
    /**
     * Busca demonstrativo comparativo
     */
    async buscarDemonstrativo(exercicio, mes, ug = 'CONSOLIDADO') {
        return await this.get('/demonstrativo', {
            exercicio: exercicio,
            mes: mes,
            ug: ug
        });
    }
    
    /**
     * Lista UGs disponíveis
     */
    async listarUGs() {
        return await this.get('/ugs');
    }
    
    /**
     * Limpa cache do servidor
     */
    async limparCacheServidor() {
        return await this.post('/cache/limpar');
    }
    
    /**
     * Status do cache
     */
    async statusCache() {
        return await this.get('/cache/status');
    }
    
    /**
     * Exporta dados
     */
    async exportar(formato, exercicio, mes, ug) {
        const params = new URLSearchParams({
            formato: formato,
            exercicio: exercicio,
            mes: mes,
            ug: ug
        });
        
        const url = `${this.baseUrl}/exportar?${params}`;
        
        // Download direto
        window.location.href = url;
    }
}