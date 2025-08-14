import oracledb
import logging

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

def consultar_saldos_separados():
    """
    Executa a consulta SQL para obter o saldo de cada conta separadamente e exibe os resultados.
    """
    con = conectar_oracle()
    cursor = None

    if con:
        try:
            cursor = con.cursor()
            # SQL MODIFICADO: Seleciona a conta e o saldo, e agrupa por conta
            cursor.execute("""
                SELECT
                    cocontacontabil,
                    SUM(VACREDITO) - SUM(VADEBITO) AS saldo
                FROM
                    MIL2025.VSALDOCONTABIL
                WHERE
                    cocontacontabil IN (631100000, 622130100)
                    and coug = 110901
                GROUP BY
                    cocontacontabil
            """)
            
            print("\n--- Saldos Individuais por Conta ---")
            
            # CÓDIGO MODIFICADO: Percorre todas as linhas retornadas pela consulta
            resultados = {}
            for conta, saldo in cursor:
                print(f"📄 Conta: {conta} | Saldo: {saldo:,.2f}")
                resultados[conta] = saldo
            
            print("------------------------------------\n")
            
            # Retorna um dicionário com os resultados, ex: {631100000: 5000.00, ...}
            return resultados

        except Exception as e:
            logging.error(f"❌ Erro durante a consulta SQL: {e}")
            return None

        finally:
            if cursor:
                cursor.close()
            con.close()
            logging.info("🔒 Conexão Oracle encerrada.")
    else:
        logging.warning("⚠️ A consulta não pôde ser executada porque a conexão com o Oracle falhou.")
        return None

# --- Ponto de Entrada do Script ---
if __name__ == "__main__":
    consultar_saldos_separados()