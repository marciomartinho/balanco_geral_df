"""
Módulo de conexão com o banco de dados Oracle
Gerencia a configuração e pool de conexões
"""

import os
import logging
import oracledb
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from contextlib import contextmanager

# Configurar logging
logger = logging.getLogger(__name__)

class DatabaseConfig:
    """Classe para gerenciar configurações do banco de dados"""
    
    def __init__(self, env_path: Optional[Path] = None):
        """
        Inicializa as configurações do banco
        
        Args:
            env_path: Caminho para o arquivo .env (opcional)
        """
        # Carregar variáveis de ambiente
        if env_path:
            load_dotenv(env_path)
        else:
            # Procurar .env na raiz do projeto
            root_dir = Path(__file__).parent.parent
            env_file = root_dir / '.env'
            if env_file.exists():
                load_dotenv(env_file)
            else:
                logger.warning("Arquivo .env não encontrado. Usando variáveis de ambiente do sistema.")
        
        # Configurações do banco
        self.user = os.getenv('DB_USER')
        self.password = os.getenv('DB_PASSWORD')
        self.dsn = os.getenv('DB_DSN')
        self.oracle_client_path = os.getenv('ORACLE_CLIENT_PATH')
        
        # Configurações opcionais
        self.encoding = os.getenv('DB_ENCODING', 'UTF-8')
        self.min_connections = int(os.getenv('DB_MIN_CONNECTIONS', '1'))
        self.max_connections = int(os.getenv('DB_MAX_CONNECTIONS', '5'))
        self.increment = int(os.getenv('DB_INCREMENT_CONNECTIONS', '1'))
        self.environment = os.getenv('ENVIRONMENT', 'development')
        
        # Validar configurações obrigatórias
        self._validate_config()
        
        # Inicializar cliente Oracle
        self._init_oracle_client()
    
    def _validate_config(self):
        """Valida se todas as configurações obrigatórias estão presentes"""
        required_fields = ['user', 'password', 'dsn']
        missing_fields = []
        
        for field in required_fields:
            if not getattr(self, field):
                missing_fields.append(field.upper())
        
        if missing_fields:
            raise ValueError(
                f"Configurações obrigatórias ausentes: {', '.join(missing_fields)}. "
                f"Verifique o arquivo .env ou as variáveis de ambiente."
            )
    
    def _init_oracle_client(self):
        """Inicializa o cliente Oracle"""
        if self.oracle_client_path and os.path.exists(self.oracle_client_path):
            try:
                oracledb.init_oracle_client(lib_dir=self.oracle_client_path)
                logger.info(f"✅ Cliente Oracle inicializado: {self.oracle_client_path}")
            except Exception as e:
                logger.warning(f"⚠️ Erro ao inicializar cliente Oracle: {e}")
                logger.info("Tentando conexão sem cliente Oracle (thin mode)...")
        else:
            logger.info("Usando conexão thin mode (sem Oracle Client)")
    
    def get_connection_params(self) -> Dict[str, Any]:
        """Retorna os parâmetros de conexão"""
        # Removido 'encoding' pois não é aceito diretamente pelo oracledb.connect()
        return {
            'user': self.user,
            'password': self.password,
            'dsn': self.dsn
        }
    
    def get_pool_params(self) -> Dict[str, Any]:
        """Retorna os parâmetros para pool de conexões"""
        # Para o pool, o encoding pode ser configurado
        return {
            'user': self.user,
            'password': self.password,
            'dsn': self.dsn,
            'min': self.min_connections,
            'max': self.max_connections,
            'increment': self.increment
        }


class DatabaseManager:
    """Gerenciador de conexões do banco de dados"""
    
    def __init__(self, config: Optional[DatabaseConfig] = None):
        """
        Inicializa o gerenciador de banco de dados
        
        Args:
            config: Configuração do banco (opcional)
        """
        self.config = config or DatabaseConfig()
        self._pool: Optional[oracledb.ConnectionPool] = None
        self._single_connection: Optional[oracledb.Connection] = None
    
    def create_pool(self) -> oracledb.ConnectionPool:
        """Cria um pool de conexões"""
        if not self._pool:
            try:
                self._pool = oracledb.create_pool(**self.config.get_pool_params())
                logger.info(
                    f"✅ Pool de conexões criado "
                    f"(min={self.config.min_connections}, max={self.config.max_connections})"
                )
            except Exception as e:
                logger.error(f"❌ Erro ao criar pool de conexões: {e}")
                raise
        return self._pool
    
    def get_connection(self) -> oracledb.Connection:
        """
        Obtém uma conexão do pool ou cria uma conexão simples
        
        Returns:
            Conexão com o banco de dados Oracle
        """
        try:
            # Tentar usar o pool primeiro
            if self._pool:
                return self._pool.acquire()
            
            # Se não há pool, criar conexão simples
            if not self._single_connection or not self._single_connection.ping():
                logger.info("🔌 Criando nova conexão com o Oracle...")
                self._single_connection = oracledb.connect(
                    **self.config.get_connection_params()
                )
                logger.info("✅ Conexão estabelecida com sucesso")
            
            return self._single_connection
            
        except Exception as e:
            logger.error(f"❌ Erro ao obter conexão: {e}")
            raise
    
    def release_connection(self, connection: oracledb.Connection):
        """
        Libera uma conexão de volta ao pool
        
        Args:
            connection: Conexão a ser liberada
        """
        try:
            if self._pool and connection:
                self._pool.release(connection)
                logger.debug("Conexão retornada ao pool")
        except Exception as e:
            logger.error(f"Erro ao liberar conexão: {e}")
    
    def close_pool(self):
        """Fecha o pool de conexões"""
        if self._pool:
            try:
                self._pool.close()
                logger.info("🔒 Pool de conexões fechado")
                self._pool = None
            except Exception as e:
                logger.error(f"Erro ao fechar pool: {e}")
    
    def close_connection(self):
        """Fecha a conexão simples"""
        if self._single_connection:
            try:
                self._single_connection.close()
                logger.info("🔒 Conexão fechada")
                self._single_connection = None
            except Exception as e:
                logger.error(f"Erro ao fechar conexão: {e}")
    
    @contextmanager
    def get_cursor(self):
        """
        Context manager para obter um cursor
        
        Yields:
            Cursor do banco de dados
        
        Example:
            with db_manager.get_cursor() as cursor:
                cursor.execute("SELECT * FROM tabela")
                results = cursor.fetchall()
        """
        connection = None
        cursor = None
        try:
            connection = self.get_connection()
            cursor = connection.cursor()
            yield cursor
        finally:
            if cursor:
                cursor.close()
            if connection:
                self.release_connection(connection)
    
    def execute_query(self, query: str, params: Optional[Dict] = None) -> list:
        """
        Executa uma query e retorna os resultados
        
        Args:
            query: SQL query
            params: Parâmetros da query (opcional)
        
        Returns:
            Lista com os resultados
        """
        with self.get_cursor() as cursor:
            cursor.execute(query, params or {})
            return cursor.fetchall()
    
    def execute_one(self, query: str, params: Optional[Dict] = None) -> Optional[tuple]:
        """
        Executa uma query e retorna apenas um resultado
        
        Args:
            query: SQL query
            params: Parâmetros da query (opcional)
        
        Returns:
            Tupla com o resultado ou None
        """
        with self.get_cursor() as cursor:
            cursor.execute(query, params or {})
            return cursor.fetchone()
    
    def test_connection(self) -> bool:
        """
        Testa a conexão com o banco de dados
        
        Returns:
            True se a conexão está funcionando
        """
        try:
            result = self.execute_one("SELECT 1 FROM DUAL")
            if result:
                logger.info("✅ Teste de conexão bem-sucedido")
                return True
            return False
        except Exception as e:
            logger.error(f"❌ Falha no teste de conexão: {e}")
            return False


# Instância global (singleton)
_db_manager: Optional[DatabaseManager] = None

def get_db_manager() -> DatabaseManager:
    """
    Obtém a instância global do gerenciador de banco de dados
    
    Returns:
        Instância do DatabaseManager
    """
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager

def conectar_oracle() -> oracledb.Connection:
    """
    Função de compatibilidade com o código existente
    
    Returns:
        Conexão com o banco de dados Oracle
    """
    manager = get_db_manager()
    return manager.get_connection()

# Aliases para facilitar importação
connect = conectar_oracle
get_connection = conectar_oracle