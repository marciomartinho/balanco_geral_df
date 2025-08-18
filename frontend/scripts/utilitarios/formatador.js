/**
 * Formatador - Utilitário para formatação de valores
 * Centraliza toda formatação de moeda, números e variações
 */

export class Formatador {
    /**
     * Formata valor monetário em Reais
     */
    static moeda(valor) {
        if (!valor && valor !== 0) return 'R$ 0,00';
        
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }
    
    /**
     * Formata número com separadores de milhar
     */
    static numero(valor) {
        if (!valor && valor !== 0) return '0';
        
        return new Intl.NumberFormat('pt-BR').format(valor);
    }
    
    /**
     * Formata valor monetário compacto (mil, mi, bi)
     */
    static moedaCompacta(valor) {
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
    }
    
    /**
     * Calcula e formata variação percentual
     */
    static variacao(atual, anterior) {
        if (!anterior || anterior === 0) {
            if (atual > 0) return { 
                valor: '+100.00%', 
                classe: 'variacao-positiva',
                icone: '▲'
            };
            return { valor: '-', classe: 'variacao-neutra', icone: '' };
        }
        
        const varPct = ((atual / anterior) - 1) * 100;
        const sinal = varPct > 0 ? '+' : '';
        
        let classe = 'variacao-neutra';
        let icone = '';
        
        if (varPct > 0) {
            classe = 'variacao-positiva';
            icone = '▲';
        } else if (varPct < 0) {
            classe = 'variacao-negativa';
            icone = '▼';
        }
        
        return {
            valor: `${sinal}${varPct.toFixed(2)}%`,
            classe: classe,
            icone: icone,
            percentual: varPct
        };
    }
    
    /**
     * Formata data no padrão brasileiro
     */
    static data(data) {
        if (!data) return '';
        
        const d = new Date(data);
        return d.toLocaleDateString('pt-BR');
    }
    
    /**
     * Formata mês por extenso
     */
    static nomeMes(numeroMes) {
        const meses = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril',
            'Maio', 'Junho', 'Julho', 'Agosto',
            'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        
        return meses[numeroMes - 1] || '';
    }
}