/**
 * api.js - Chamadas para API
 * Sistema de Despesa Orçamentária
 */

import { AppConfig, AppState } from './config.js';

const API = {
    /**
     * Busca lista de UGs
     */
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
                
                // Atualizar select de UGs
                const selectUG = document.getElementById('unidadeGestora');
                if (selectUG && ugs.length > 0) {
                    // Limpar opções existentes (exceto CONSOLIDADO)
                    while (selectUG.options.length > 1) {
                        selectUG.remove(1);
                    }
                    
                    // Adicionar novas opções
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
     * Exporta dados para arquivo
     */
    exportarDados: async function(formato, nomeArquivo, ug) {
        try {
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
                
                return true;
            } else {
                throw new Error('Erro ao exportar dados');
            }
        } catch (error) {
            console.error('❌ Erro ao exportar:', error);
            throw error;
        }
    },

    /**
     * Limpa o cache do servidor
     */
    limparCache: async function() {
        try {
            const response = await fetch(`${AppConfig.apiBaseUrl}/cache/limpar`, {
                method: 'POST'
            });

            const result = await response.json();
            if (result.success) {
                // Limpar estado local
                AppState.dadosCompletos = null;
                AppState.dadosFiltrados = null;
                AppState.totaisCalculados = null;
                AppState.totaisCreditos = null;
                AppState.listaUGs = null;
                
                return true;
            }
            
            throw new Error(result.message || 'Erro ao limpar cache');
        } catch (error) {
            console.error('❌ Erro ao limpar cache:', error);
            throw error;
        }
    }
};

export default API;