// JavaScript da Página Principal

// Função para formatar números
function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

// Carregar estatísticas básicas
async function carregarEstatisticas() {
    try {
        // Fazer requisição para obter resumo
        const response = await fetch('/despesa-orcamentaria/api/resumo');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.resumo) {
                // Atualizar total de registros
                document.getElementById('totalRegistros').textContent = formatNumber(data.resumo.total_registros || 0);
                
                // Calcular total de UGs (aproximado)
                document.getElementById('totalUGs').textContent = '85';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar estatísticas:', error);
        // Usar valores padrão se houver erro
        document.getElementById('totalRegistros').textContent = '-';
        document.getElementById('totalUGs').textContent = '-';
    }
    
    // Atualizar hora da última atualização
    const hoje = new Date();
    const hora = hoje.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('ultimaAtualizacao').textContent = hora;
}

// Carregar ao iniciar a página
document.addEventListener('DOMContentLoaded', () => {
    console.log('Página principal carregada');
    carregarEstatisticas();
    
    // Atualizar estatísticas a cada 5 minutos
    setInterval(carregarEstatisticas, 300000);
});