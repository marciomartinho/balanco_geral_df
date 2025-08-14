import oracledb
import logging
from datetime import datetime
from decimal import Decimal

# --- Configuração Inicial ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Inicialização do Cliente Oracle ---
try:
    oracledb.init_oracle_client(lib_dir=r"C:\instantclient_23_9")
    logging.info("✅ Cliente Oracle inicializado com sucesso.")
except Exception as e:
    logging.error(f"❌ Falha ao inicializar o cliente Oracle. Verifique o caminho do Instant Client: {e}")
    exit()

def conectar_oracle():
    """
    Cria e retorna uma conexão com o banco de dados Oracle
    usando credenciais fixas no código (hardcoded).
    """
    try:
        logging.info("🔌 Conectando ao Oracle com dados fixos...")
        connection = oracledb.connect(
            user="usefp28",
            password="rema2",
            dsn="DIS11"
        )
        logging.info("🔗 Conexão Oracle estabelecida com sucesso.")
        return connection
    except Exception as e:
        logging.error(f"❌ Erro na conexão: {e}")
        return None

def formatar_valor(valor):
    """Formata o valor para exibição com separadores de milhares"""
    if valor is None or valor == 0:
        return "0,00"
    return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def gerar_relatorio_balanco_orcamentario(ano=2025, mes=12, coug='110901'):
    """
    Gera o relatório de Balanço Orçamentário da Receita conforme layout especificado
    """
    con = conectar_oracle()
    cursor = None
    
    if not con:
        logging.error("❌ Não foi possível conectar ao banco de dados")
        return None
    
    try:
        cursor = con.cursor()
        logging.info(f"📊 Gerando relatório de Balanço Orçamentário - Ano: {ano}, Mês: {mes}, UG: {coug}")
        
        # Query principal para buscar dados agregados
        query = """
        SELECT 
            T2.cocategoriareceita,
            T2.nocategoriareceita,
            T3.cofontereceita,
            T3.nofontereceita,
            T4.cosubfontereceita,
            T4.nosubfontereceita,
            -- Previsão Inicial
            SUM(CASE 
                WHEN T1.COCONTACONTABIL BETWEEN 521110000 AND 521119999 
                THEN T1.VADEBITO - T1.VACREDITO 
                ELSE 0 
            END) AS previsao_inicial,
            -- Previsão Atualizada
            SUM(CASE 
                WHEN T1.COCONTACONTABIL BETWEEN 521110000 AND 521219999 
                THEN T1.VADEBITO - T1.VACREDITO 
                ELSE 0 
            END) AS previsao_atualizada,
            -- Receita Realizada no Mês
            SUM(CASE 
                WHEN T1.COCONTACONTABIL BETWEEN 621210000 AND 621399999 
                AND T1.INMES = :mes
                THEN T1.VACREDITO - T1.VADEBITO 
                ELSE 0 
            END) AS receita_mes,
            -- Receita Realizada Até o Mês
            SUM(CASE 
                WHEN T1.COCONTACONTABIL BETWEEN 621210000 AND 621399999 
                AND T1.INMES <= :mes
                THEN T1.VACREDITO - T1.VADEBITO 
                ELSE 0 
            END) AS receita_ate_mes
        FROM 
            MIL2001.SALDOCONTABIL_EX T1
            LEFT JOIN MIL2025.vcategoriareceita T2 
                ON SUBSTR(T1.cocontacorrente,1,1) = T2.cocategoriareceita
            LEFT JOIN MIL2025.vfontereceita T3 
                ON SUBSTR(T1.cocontacorrente,1,2) = T3.cofontereceita
            LEFT JOIN MIL2025.vsubfontereceita T4 
                ON SUBSTR(T1.cocontacorrente,1,3) = T4.cosubfontereceita
        WHERE 
            T1.COEXERCICIO = :ano
            AND T1.COUG = :coug
            AND T2.cocategoriareceita IN ('1', '2', '7', '9')
        GROUP BY 
            T2.cocategoriareceita, T2.nocategoriareceita,
            T3.cofontereceita, T3.nofontereceita,
            T4.cosubfontereceita, T4.nosubfontereceita
        HAVING 
            ABS(SUM(CASE WHEN T1.COCONTACONTABIL BETWEEN 521110000 AND 521119999 
                    THEN T1.VADEBITO - T1.VACREDITO ELSE 0 END)) > 0.01
        ORDER BY 
            T2.cocategoriareceita, T3.cofontereceita, T4.cosubfontereceita
        """
        
        params = {
            'ano': ano,
            'mes': mes,
            'coug': coug
        }
        
        cursor.execute(query, params)
        resultados = cursor.fetchall()
        
        logging.info(f"✅ Query retornou {len(resultados)} registros")
        
        # Processar e estruturar os dados
        estrutura = processar_estrutura_relatorio(resultados)
        
        # Buscar lançamentos contábeis relacionados
        logging.info("📝 Buscando lançamentos contábeis relacionados...")
        lancamentos = buscar_lancamentos_contabeis(cursor, ano, mes, coug)
        
        # Exibir relatório formatado
        exibir_relatorio_formatado(estrutura, ano, mes, coug)
        
        # Exibir lançamentos contábeis
        if lancamentos:
            exibir_lancamentos_contabeis(lancamentos)
        
        return estrutura
        
    except Exception as e:
        logging.error(f"❌ Erro durante a execução: {e}")
        import traceback
        traceback.print_exc()
        return None
        
    finally:
        if cursor:
            cursor.close()
        con.close()
        logging.info("🔒 Conexão Oracle encerrada.")

def buscar_lancamentos_contabeis(cursor, ano, mes, coug):
    """
    Busca os lançamentos contábeis relacionados às receitas
    """
    try:
        # Primeiro, vamos verificar se existem lançamentos para debug
        query_debug = """
        SELECT COUNT(*) as total
        FROM MIL2001.LANCAMENTOCONTABIL_EX
        WHERE COEXERCICIO = :ano
        AND COUG = :coug
        AND INMES <= :mes
        """
        
        cursor.execute(query_debug, {'ano': ano, 'mes': mes, 'coug': coug})
        total_debug = cursor.fetchone()[0]
        logging.info(f"Debug: Total de lançamentos na UG {coug}: {total_debug}")
        
        # Query principal - buscar lançamentos relacionados às contas de receita
        query_lancamentos = """
        SELECT 
            L.NULANCAMENTO,
            L.COEVENTO,
            L.VALANCAMENTO,
            L.COCONTACONTABIL,
            L.COCONTACORRENTE,
            L.INMES
        FROM 
            MIL2001.LANCAMENTOCONTABIL_EX L
        WHERE 
            L.COEXERCICIO = :ano
            AND L.INMES <= :mes
            AND L.COUG = :coug
            AND L.COCONTACONTABIL IN (
                -- Buscar as contas contábeis que têm saldo no relatório principal
                SELECT DISTINCT S.COCONTACONTABIL
                FROM MIL2001.SALDOCONTABIL_EX S
                WHERE S.COEXERCICIO = :ano
                AND S.COUG = :coug
                AND (
                    -- Contas de Previsão
                    (S.COCONTACONTABIL BETWEEN 521110000 AND 521219999)
                    OR
                    -- Contas de Receita Realizada
                    (S.COCONTACONTABIL BETWEEN 621210000 AND 621399999)
                )
            )
        ORDER BY 
            L.COCONTACONTABIL, L.INMES DESC, L.NULANCAMENTO DESC
        """
        
        params = {
            'ano': ano,
            'mes': mes,
            'coug': coug
        }
        
        cursor.execute(query_lancamentos, params)
        lancamentos = cursor.fetchall()
        
        logging.info(f"✅ Encontrados {len(lancamentos)} lançamentos contábeis relacionados às receitas")
        
        # Se não encontrou, vamos buscar qualquer lançamento de receita para teste
        if len(lancamentos) == 0:
            logging.info("Buscando lançamentos de receita sem filtro de JOIN...")
            query_simples = """
            SELECT 
                L.NULANCAMENTO,
                L.COEVENTO,
                L.VALANCAMENTO,
                L.COCONTACONTABIL,
                L.COCONTACORRENTE,
                L.INMES
            FROM 
                MIL2001.LANCAMENTOCONTABIL_EX L
            WHERE 
                L.COEXERCICIO = :ano
                AND L.INMES <= :mes
                AND L.COUG = :coug
                AND (
                    (L.COCONTACONTABIL BETWEEN 521110000 AND 521219999)
                    OR
                    (L.COCONTACONTABIL BETWEEN 621210000 AND 621399999)
                )
                AND ROWNUM <= 50
            ORDER BY L.INMES DESC, L.NULANCAMENTO DESC
            """
            
            cursor.execute(query_simples, params)
            lancamentos = cursor.fetchall()
            logging.info(f"Encontrados {len(lancamentos)} lançamentos sem filtro de categoria")
        
        return lancamentos
        
    except Exception as e:
        logging.error(f"⚠️ Erro ao buscar lançamentos: {e}")
        import traceback
        traceback.print_exc()
        return []

def exibir_lancamentos_contabeis(lancamentos):
    """
    Exibe os lançamentos contábeis em formato tabular simplificado
    """
    if not lancamentos:
        print("\n" + "="*90)
        print(" "*25 + "LANÇAMENTOS CONTÁBEIS RELACIONADOS")
        print("="*90)
        print("  Nenhum lançamento contábil encontrado para os critérios selecionados.")
        print("="*90)
        return
        
    print("\n" + "="*90)
    print(" "*25 + "LANÇAMENTOS CONTÁBEIS RELACIONADOS")
    print("="*90)
    
    # Cabeçalho da tabela
    print(f"{'Nº LANÇAMENTO':<20} {'EVENTO':<15} {'VALOR':>20} {'MÊS':<5} {'CONTA CONTÁBIL':<15}")
    print("-"*90)
    
    total_lancamentos = 0
    lancamentos_por_tipo = {
        'previsao_inicial': {'qtd': 0, 'valor': 0},
        'previsao_atualizada': {'qtd': 0, 'valor': 0},
        'realizada': {'qtd': 0, 'valor': 0}
    }
    
    for lanc in lancamentos:
        nu_lancamento = str(lanc[0] if lanc[0] else '')
        co_evento = str(lanc[1] if lanc[1] else '')
        valor = float(lanc[2] if lanc[2] else 0)
        conta = str(lanc[3] if lanc[3] else '')
        conta_corrente = str(lanc[4] if lanc[4] else '')
        mes = str(lanc[5] if lanc[5] else '')
        
        # Classificar tipo de lançamento baseado na conta contábil
        if conta.startswith('52111'):
            tipo = 'previsao_inicial'
            tipo_desc = 'Prev.Inicial'
        elif conta.startswith('5212'):
            tipo = 'previsao_atualizada'
            tipo_desc = 'Prev.Atualiz.'
        elif conta.startswith('62'):
            tipo = 'realizada'
            tipo_desc = 'Rec.Realizada'
        else:
            tipo = 'outro'
            tipo_desc = 'Outros'
        
        # Atualizar totalizadores
        if tipo in lancamentos_por_tipo:
            lancamentos_por_tipo[tipo]['qtd'] += 1
            lancamentos_por_tipo[tipo]['valor'] += abs(valor)
        
        total_lancamentos += abs(valor)
        
        # Exibir linha
        print(f"{nu_lancamento:<20} {co_evento:<15} {formatar_valor(abs(valor)):>20} {mes:<5} {conta:<15} [{tipo_desc}]")
    
    # Resumo por tipo
    print("\n" + "-"*90)
    print("RESUMO DOS LANÇAMENTOS POR TIPO:")
    
    if lancamentos_por_tipo['previsao_inicial']['qtd'] > 0:
        print(f"  Previsão Inicial:      {lancamentos_por_tipo['previsao_inicial']['qtd']:>4} lançamentos - Total: {formatar_valor(lancamentos_por_tipo['previsao_inicial']['valor']):>20}")
    
    if lancamentos_por_tipo['previsao_atualizada']['qtd'] > 0:
        print(f"  Previsão Atualizada:   {lancamentos_por_tipo['previsao_atualizada']['qtd']:>4} lançamentos - Total: {formatar_valor(lancamentos_por_tipo['previsao_atualizada']['valor']):>20}")
    
    if lancamentos_por_tipo['realizada']['qtd'] > 0:
        print(f"  Receita Realizada:     {lancamentos_por_tipo['realizada']['qtd']:>4} lançamentos - Total: {formatar_valor(lancamentos_por_tipo['realizada']['valor']):>20}")
    
    print("-"*90)
    print(f"  TOTAL GERAL:           {len(lancamentos):>4} lançamentos - Total: {formatar_valor(total_lancamentos):>20}")
    print("="*90)

def processar_estrutura_relatorio(resultados):
    """
    Processa os resultados e organiza em estrutura hierárquica
    """
    estrutura = {
        '1': {'nome': 'RECEITAS CORRENTES', 'fontes': {}, 'total': 0},
        '2': {'nome': 'RECEITAS DE CAPITAL', 'fontes': {}, 'total': 0},
        '7': {'nome': 'RECEITAS CORRENTES INTRA-ORÇAMENTÁRIAS', 'fontes': {}, 'total': 0},
        '9': {'nome': 'RECEITAS DE CAPITAL INTRA-ORÇAMENTÁRIAS', 'fontes': {}, 'total': 0}
    }
    
    # Mapeamento específico de categorias
    categorias_map = {
        '11': 'IMPOSTOS, TAXAS E CONTRIBUIÇÕES DE MELHORIA',
        '12': 'RECEITA CONTRIBUIÇÕES',
        '13': 'RECEITA PATRIMONIAL',
        '14': 'RECEITA AGROPECUÁRIA',
        '15': 'RECEITA INDUSTRIAL',
        '16': 'RECEITA DE SERVIÇOS',
        '17': 'TRANSFERÊNCIAS CORRENTES',
        '19': 'OUTRAS RECEITAS CORRENTES',
        '21': 'OPERAÇÕES DE CRÉDITO',
        '22': 'ALIENAÇÃO DE BENS',
        '23': 'AMORTIZAÇÃO DE EMPRÉSTIMOS',
        '24': 'TRANSFERÊNCIAS DE CAPITAL',
        '25': 'OUTRAS RECEITAS DE CAPITAL',
        '71': 'RECEITAS CORRENTES INTRA-ORÇAMENTÁRIAS',
        '72': 'RECEITAS DE CAPITAL INTRA-ORÇAMENTÁRIAS'
    }
    
    for row in resultados:
        cat_cod = row[0] if row[0] else ''
        cat_nome = row[1] if row[1] else ''
        fonte_cod = row[2] if row[2] else ''
        fonte_nome = row[3] if row[3] else ''
        subfonte_cod = row[4] if row[4] else ''
        subfonte_nome = row[5] if row[5] else ''
        previsao_inicial = float(row[6] if row[6] else 0)
        
        # Identificar categoria principal (1, 2, 7 ou 9)
        if cat_cod in estrutura:
            categoria = estrutura[cat_cod]
            
            # Adicionar fonte se não existir
            if fonte_cod not in categoria['fontes']:
                # Usar o nome do mapeamento se disponível
                nome_display = categorias_map.get(fonte_cod, fonte_nome)
                categoria['fontes'][fonte_cod] = {
                    'nome': nome_display,
                    'subfontes': {},
                    'total': 0
                }
            
            # Adicionar subfonte
            if subfonte_cod not in categoria['fontes'][fonte_cod]['subfontes']:
                categoria['fontes'][fonte_cod]['subfontes'][subfonte_cod] = {
                    'nome': subfonte_nome,
                    'valor': previsao_inicial
                }
            
            # Atualizar totais
            categoria['fontes'][fonte_cod]['total'] += previsao_inicial
            categoria['total'] += previsao_inicial
    
    return estrutura

def exibir_relatorio_formatado(estrutura, ano, mes, coug):
    """
    Exibe o relatório formatado conforme layout do anexo
    """
    print("\n" + "="*90)
    print(" "*30 + "BALANÇO ORÇAMENTÁRIO")
    print(" "*25 + f"EXERCÍCIO: {ano} - UG: {coug}")
    print("="*90)
    print(f"{'RECEITAS ORÇAMENTÁRIAS':<60} {'PREVISÃO INICIAL':>28}")
    print(f"{'':<60} {'(a)':>28}")
    print("="*90)
    
    total_geral = 0
    
    # Processar cada categoria principal
    for cat_cod in ['1', '2', '7', '9']:
        if cat_cod not in estrutura or estrutura[cat_cod]['total'] == 0:
            continue
            
        categoria = estrutura[cat_cod]
        
        # Imprimir categoria principal
        print(f"\n{categoria['nome']} ({cat_cod})")
        print(f"{'':<60} {formatar_valor(categoria['total']):>28}")
        
        # Processar fontes
        for fonte_cod, fonte_data in sorted(categoria['fontes'].items()):
            if fonte_data['total'] == 0:
                continue
                
            # Imprimir fonte
            print(f"  {fonte_data['nome']}")
            print(f"{'':<60} {formatar_valor(fonte_data['total']):>28}")
            
            # Processar subfontes
            for subfonte_cod, subfonte_data in sorted(fonte_data['subfontes'].items()):
                if subfonte_data['valor'] == 0:
                    continue
                    
                # Imprimir subfonte
                nome_subfonte = subfonte_data['nome']
                if nome_subfonte and nome_subfonte != fonte_data['nome']:
                    print(f"    {nome_subfonte}")
                    print(f"{'':<60} {formatar_valor(subfonte_data['valor']):>28}")
        
        total_geral += categoria['total']
    
    # Linha de subtotal
    print("\n" + "-"*90)
    print(f"{'SUBTOTAL DAS RECEITAS (III) = (I + II)':<60} {formatar_valor(total_geral):>28}")
    
    # Refinanciamento (geralmente zero)
    print(f"{'SUBTOTAL COM REFINANCIAMENTO (V) = (III + IV)':<60} {formatar_valor(total_geral):>28}")
    
    # Déficit
    print(f"{'DÉFICIT (VI)':<60} {'0,00':>28}")
    
    # Total
    print("="*90)
    print(f"{'TOTAL (VII) = (V + VI)':<60} {formatar_valor(total_geral):>28}")
    
    # Saldos de exercícios anteriores
    print(f"{'SALDOS DE EXERCÍCIOS ANTERIORES':<60} {'0,00':>28}")
    print("="*90)
    
    print(f"\nRelatório gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

# --- Ponto de Entrada do Script ---
if __name__ == "__main__":
    import sys
    
    # Valores padrão
    ano = 2025
    mes = 12
    coug = '110901'
    
    # Verificar argumentos da linha de comando
    if len(sys.argv) > 1:
        ano = int(sys.argv[1])
    if len(sys.argv) > 2:
        mes = int(sys.argv[2])
    if len(sys.argv) > 3:
        coug = sys.argv[3]
    
    print(f"Gerando relatório para: Ano={ano}, Mês={mes}, UG={coug}")
    
    # Gerar relatório
    gerar_relatorio_balanco_orcamentario(ano, mes, coug)