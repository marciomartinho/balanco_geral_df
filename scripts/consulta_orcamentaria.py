"""
Script para executar consulta de execução orçamentária no Oracle
Utiliza a configuração existente do database.py
"""

import sys
import pandas as pd
from pathlib import Path
from datetime import datetime

# Adicionar o diretório raiz do projeto ao path
# O script está em scripts/, então precisamos subir um nível para encontrar a raiz
script_dir = Path(__file__).parent
project_root = script_dir.parent
sys.path.insert(0, str(project_root))

# Importar o gerenciador de banco de dados da pasta config
from config.database import get_db_manager, DatabaseManager
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def executar_consulta_orcamentaria():
    """
    Executa a consulta de execução orçamentária
    """
    
    # Query SQL
    query = """
    SELECT 
        T1.COCONTACORRENTE,
        T1.CONATUREZA,
        SUBSTR(T1.CONATUREZA, 1, 1) AS CATEGORIA, 
        T2.NOCATEGORIA,
        SUBSTR(T1.CONATUREZA, 2, 1) AS GRUPO, 
        T3.NOGRUPO,
        SUBSTR(T1.CONATUREZA, 3, 2) AS MODALIDADE, 
        T4.NOMODALIDADE,
        SUBSTR(T1.CONATUREZA, 5, 2) AS ELEMENTO, 
        T5.NOELEMENTO,
        COEXERCICIO,
        INMES,  
        SUM(CASE WHEN T1.COCONTACONTABIL BETWEEN 522110000 AND 522119999 THEN T1.VADEBITO - T1.VACREDITO ELSE 0 END) AS DOTACAO_INICIAL,
        SUM(CASE WHEN T1.COCONTACONTABIL BETWEEN 522120000 AND 522129999 THEN T1.VADEBITO - T1.VACREDITO ELSE 0 END) AS DOTACAO_ADICIONAL,
        SUM(CASE WHEN T1.COCONTACONTABIL BETWEEN 522150000 AND 522159999 THEN T1.VADEBITO - T1.VACREDITO ELSE 0 END) AS CANCELAMENTO_DOTACAO,
        SUM(CASE WHEN T1.COCONTACONTABIL BETWEEN 522190000 AND 522199999 THEN T1.VADEBITO - T1.VACREDITO ELSE 0 END) AS CANCEL_REMANEJA_DOTACAO,
        SUM(CASE WHEN T1.COCONTACONTABIL BETWEEN 622130000 AND 622139999 THEN T1.VACREDITO - T1.VADEBITO ELSE 0 END) AS DESPESA_EMPENHADA,
        SUM(CASE WHEN T1.COCONTACONTABIL IN (622130300, 622130400, 622130700) THEN T1.VACREDITO - T1.VADEBITO ELSE 0 END) AS DESPESA_LIQUIDADA,
        SUM(CASE WHEN T1.COCONTACONTABIL IN (622920104) THEN T1.VACREDITO - T1.VADEBITO ELSE 0 END) AS DESPESA_PAGA,
        SUM(CASE WHEN T1.COCONTACONTABIL IN (622130600) THEN T1.VACREDITO - T1.VADEBITO ELSE 0 END) AS SALDO_DOTACAO,
        T1.COFUNCAO,
        T1.COSUBFUNCAO,
        T1.COPROGRAMA,
        T1.COPROJETO,
        T1.COSUBTITULO,
        T1.INESFERA,
        T1.COFONTE,
        T1.COUG, 
        T1.COGESTAO,
        T6.INTIPOADM,
        T7.NOUG
    FROM 
        MIL2001.SALDOCONTABIL_EX T1
        LEFT JOIN MIL2025.VCATEGORIA T2 ON SUBSTR(T1.CONATUREZA,1,1) = TO_CHAR(T2.INCATEGORIA)
        LEFT JOIN MIL2025.VGRUPO T3 ON SUBSTR(T1.CONATUREZA,2,1) = TO_CHAR(T3.COGRUPO)
        LEFT JOIN MIL2025.VMODALIDADE T4 ON SUBSTR(T1.CONATUREZA,3,2) = TO_CHAR(T4.COMODALIDADE)
        LEFT JOIN MIL2025.VELEMENTO T5 ON TO_NUMBER(SUBSTR(T1.CONATUREZA, 5, 2)) = T5.COELEMENTO
        LEFT JOIN MIL2025.UNIDADEGESTORA T7 ON T1.COUG = T7.COUG
        LEFT JOIN MIL2025.GESTAO T6 ON T1.COGESTAO = T6.COGESTAO
    WHERE 
        (
            T1.COCONTACONTABIL BETWEEN 522110000 AND 522119999 OR
            T1.COCONTACONTABIL BETWEEN 522120000 AND 522129999 OR
            T1.COCONTACONTABIL BETWEEN 522150000 AND 522159999 OR
            T1.COCONTACONTABIL BETWEEN 522190000 AND 522199999 OR
            T1.COCONTACONTABIL BETWEEN 622130000 AND 622139999 OR
            T1.COCONTACONTABIL IN (622130300, 622130400, 622130700, 622920104, 622130600)
        )
        AND COEXERCICIO IN (2024, 2025)
        AND INMES <= 5
    GROUP BY 
        T1.COCONTACORRENTE,
        T1.CONATUREZA,
        T1.COUG, 
        T1.COGESTAO,
        T7.NOUG,
        T1.COEXERCICIO,
        T1.INMES,
        T1.COFUNCAO,
        T1.COSUBFUNCAO,
        T1.COPROGRAMA,
        T1.COPROJETO,
        T1.COSUBTITULO,
        T1.INESFERA,
        T1.COFONTE,
        T6.INTIPOADM,
        SUBSTR(T1.COCONTACORRENTE,-6,1),
        SUBSTR(T1.COCONTACORRENTE,-5,1),
        SUBSTR(T1.COCONTACORRENTE,-4,2),
        SUBSTR(T1.COCONTACORRENTE,-2,2),
        T2.NOCATEGORIA,
        T3.NOGRUPO,
        T4.NOMODALIDADE,
        T5.NOELEMENTO
    ORDER BY 
        COEXERCICIO,
        INMES
    """
    
    try:
        # Obter o gerenciador de banco de dados
        logger.info("🔌 Conectando ao banco de dados Oracle...")
        db_manager = get_db_manager()
        
        # Testar a conexão
        if not db_manager.test_connection():
            logger.error("❌ Falha ao conectar ao banco de dados")
            return None
        
        logger.info("✅ Conexão estabelecida com sucesso!")
        logger.info("📊 Executando consulta de execução orçamentária...")
        logger.info("⏳ Aguarde, isso pode levar alguns minutos...")
        
        # Executar a consulta usando o context manager
        with db_manager.get_cursor() as cursor:
            cursor.execute(query)
            
            # Obter os nomes das colunas
            columns = [desc[0] for desc in cursor.description]
            
            # Buscar todos os resultados
            results = cursor.fetchall()
            
            logger.info(f"✅ Consulta executada com sucesso! {len(results)} registros encontrados.")
            
            # Converter para DataFrame do pandas para melhor visualização
            df = pd.DataFrame(results, columns=columns)
            
            return df
            
    except Exception as e:
        logger.error(f"❌ Erro ao executar consulta: {e}")
        logger.error(f"Detalhes do erro: {str(e)}")
        return None

def salvar_resultados(df, formato='excel'):
    """
    Salva os resultados em arquivo
    
    Args:
        df: DataFrame com os resultados
        formato: 'excel' ou 'csv'
    """
    if df is None or df.empty:
        logger.warning("⚠️ Nenhum dado para salvar")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    try:
        if formato == 'excel':
            filename = f"execucao_orcamentaria_{timestamp}.xlsx"
            df.to_excel(filename, index=False, engine='openpyxl')
            logger.info(f"📁 Resultados salvos em: {filename}")
        else:
            filename = f"execucao_orcamentaria_{timestamp}.csv"
            df.to_csv(filename, index=False, encoding='utf-8-sig')
            logger.info(f"📁 Resultados salvos em: {filename}")
    except Exception as e:
        logger.error(f"❌ Erro ao salvar arquivo: {e}")

def exibir_resumo(df):
    """
    Exibe um resumo dos dados obtidos
    """
    if df is None or df.empty:
        logger.warning("⚠️ Nenhum dado para exibir")
        return
    
    print("\n" + "="*80)
    print("📊 RESUMO DA CONSULTA")
    print("="*80)
    
    print(f"\n📈 Total de registros: {len(df)}")
    
    # Resumo por exercício
    if 'COEXERCICIO' in df.columns:
        print("\n📅 Registros por Exercício:")
        exercicios = df['COEXERCICIO'].value_counts().sort_index()
        for exercicio, count in exercicios.items():
            print(f"   • {exercicio}: {count:,} registros")
    
    # Resumo por mês
    if 'INMES' in df.columns:
        print("\n📆 Registros por Mês:")
        meses = df['INMES'].value_counts().sort_index()
        for mes, count in meses.items():
            print(f"   • Mês {mes}: {count:,} registros")
    
    # Totais financeiros (se existirem)
    colunas_financeiras = [
        'DOTACAO_INICIAL', 'DOTACAO_ADICIONAL', 'DESPESA_EMPENHADA',
        'DESPESA_LIQUIDADA', 'DESPESA_PAGA'
    ]
    
    print("\n💰 Totais Financeiros:")
    for col in colunas_financeiras:
        if col in df.columns:
            total = df[col].sum()
            print(f"   • {col.replace('_', ' ').title()}: R$ {total:,.2f}")
    
    # Primeiras linhas
    print("\n📋 Primeiras 5 linhas dos dados:")
    print("-"*80)
    print(df.head().to_string())
    
    print("\n" + "="*80)

def main():
    """
    Função principal
    """
    print("\n" + "="*80)
    print("🚀 SISTEMA DE CONSULTA DE EXECUÇÃO ORÇAMENTÁRIA")
    print("="*80)
    
    # Executar a consulta
    df = executar_consulta_orcamentaria()
    
    if df is not None and not df.empty:
        # Exibir resumo
        exibir_resumo(df)
        
        # Perguntar se deseja salvar os resultados
        print("\n💾 Deseja salvar os resultados?")
        print("1 - Salvar em Excel")
        print("2 - Salvar em CSV")
        print("3 - Ambos")
        print("0 - Não salvar")
        
        escolha = input("\nEscolha uma opção: ").strip()
        
        if escolha == '1':
            salvar_resultados(df, 'excel')
        elif escolha == '2':
            salvar_resultados(df, 'csv')
        elif escolha == '3':
            salvar_resultados(df, 'excel')
            salvar_resultados(df, 'csv')
        
        print("\n✅ Processo concluído com sucesso!")
    else:
        print("\n❌ Não foi possível obter os dados da consulta.")
    
    print("="*80)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Operação cancelada pelo usuário")
    except Exception as e:
        logger.error(f"❌ Erro não tratado: {e}")
        import traceback
        traceback.print_exc()