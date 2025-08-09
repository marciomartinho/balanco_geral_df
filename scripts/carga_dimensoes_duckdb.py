#!/usr/bin/env python3
"""
Script INTELIGENTE para carregar dimensões no DuckDB.
Aprende e lembra dos mapeamentos arquivo->tabela usando um arquivo JSON.
Gera documentação automática da estrutura do banco.
"""
import pandas as pd
import duckdb
from pathlib import Path
from datetime import datetime
import logging
import re
import json
import hashlib
import sys
import argparse

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CarregadorInteligenteDimensoes:
    """Carregador que aprende e lembra dos mapeamentos"""
    
    def __init__(self):
        # Definir caminhos base - relativos ao diretório do script
        script_dir = Path(__file__).parent
        self.base_path = script_dir.parent / "dados_brutos"
        
        # Criar estrutura de pastas se não existir
        self.db_path = self.base_path / "duckdb" / "database.duckdb"
        self.dimensao_path = self.base_path / "dimensao"
        self.metadata_path = self.base_path / "metadata"
        
        # Criar pastas se não existirem
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.dimensao_path.mkdir(parents=True, exist_ok=True)
        self.metadata_path.mkdir(parents=True, exist_ok=True)
        
        print(f"📍 Diretório base: {self.base_path.absolute()}")
        print(f"📂 Verificando pasta de dimensões: {self.dimensao_path.absolute()}")
        
        # Arquivos de metadados
        self.mapeamento_file = self.metadata_path / "mapeamento_dimensoes.json"
        self.historico_file = self.metadata_path / "historico_cargas.json"
        self.estrutura_file = self.metadata_path / f"estrutura_duckdb_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        # Carrega mapeamentos salvos ou cria novo
        self.mapeamentos = self.carregar_mapeamentos()
        self.historico = self.carregar_historico()
    
    def carregar_mapeamentos(self):
        """Carrega mapeamentos salvos do arquivo JSON"""
        if self.mapeamento_file.exists():
            try:
                with open(self.mapeamento_file, 'r', encoding='utf-8') as f:
                    mapeamentos = json.load(f)
                print(f"📚 Mapeamentos carregados: {len(mapeamentos)} registros conhecidos")
                return mapeamentos
            except Exception as e:
                print(f"⚠️ Erro ao carregar mapeamentos: {e}")
                return {}
        else:
            print("📝 Criando novo arquivo de mapeamentos...")
            return {}
    
    def salvar_mapeamentos(self):
        """Salva mapeamentos aprendidos no arquivo JSON"""
        try:
            with open(self.mapeamento_file, 'w', encoding='utf-8') as f:
                json.dump(self.mapeamentos, f, indent=2, ensure_ascii=False)
            print(f"💾 Mapeamentos salvos: {len(self.mapeamentos)} registros")
        except Exception as e:
            print(f"❌ Erro ao salvar mapeamentos: {e}")
    
    def carregar_historico(self):
        """Carrega histórico de cargas realizadas"""
        if self.historico_file.exists():
            try:
                with open(self.historico_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def salvar_historico(self, arquivo, tabela, acao, registros):
        """Salva no histórico cada operação realizada"""
        if arquivo not in self.historico:
            self.historico[arquivo] = []
        
        self.historico[arquivo].append({
            'data': datetime.now().isoformat(),
            'tabela': tabela,
            'acao': acao,
            'registros': registros
        })
        
        try:
            with open(self.historico_file, 'w', encoding='utf-8') as f:
                json.dump(self.historico, f, indent=2, ensure_ascii=False)
        except:
            pass
    
    def calcular_hash_arquivo(self, caminho):
        """Calcula hash do arquivo para detectar mudanças"""
        hash_md5 = hashlib.md5()
        with open(caminho, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    
    def gerar_nome_tabela_inteligente(self, nome_arquivo):
        """Gera nome de tabela usando aprendizado ou sugestão"""
        # Primeiro verifica se já aprendeu este mapeamento
        if nome_arquivo in self.mapeamentos:
            info = self.mapeamentos[nome_arquivo]
            print(f"   🧠 Mapeamento conhecido: {nome_arquivo} → {info['tabela']}")
            return info['tabela']
        
        # Se não conhece, gera sugestão
        nome = nome_arquivo.replace('.xlsx', '').replace('.xls', '').replace('.csv', '')
        
        # Converte CamelCase para snake_case
        nome = re.sub('([A-Z]+)([A-Z][a-z])', r'\1_\2', nome)
        nome = re.sub(r'([a-z\d])([A-Z])', r'\1_\2', nome)
        nome = nome.lower()
        
        # Adiciona prefixo dim_ se não tiver
        if not nome.startswith('dim_') and not nome.startswith('fato_'):
            nome = 'dim_' + nome
        
        print(f"   💡 Sugestão de nome: {nome}")
        return nome
    
    def detectar_chave_primaria(self, df, nome_tabela):
        """Detecta chave primária inteligentemente"""
        colunas = df.columns.str.lower()
        
        # Se já conhece este arquivo, usa a PK salva
        for arquivo, info in self.mapeamentos.items():
            if info['tabela'] == nome_tabela and 'pk' in info:
                if info['pk'] in colunas:
                    return info['pk']
        
        # Senão, tenta detectar
        candidatos = []
        
        for col in colunas:
            # Calcula score para cada coluna
            score = 0
            
            # Padrões comuns
            if col.startswith('co'):
                score += 3
            if col.startswith('id'):
                score += 3
            if 'codigo' in col or 'code' in col:
                score += 2
            if col.endswith('id'):
                score += 1
            
            # Verifica unicidade
            if len(df[col].dropna()) > 0:
                unicidade = df[col].nunique() / len(df)
                if unicidade == 1.0:
                    score += 5
                elif unicidade > 0.95:
                    score += 3
                elif unicidade > 0.8:
                    score += 1
            
            if score > 0:
                candidatos.append((col, score))
        
        # Ordena por score e pega o melhor
        if candidatos:
            candidatos.sort(key=lambda x: x[1], reverse=True)
            return candidatos[0][0]
        
        return colunas[0]
    
    def gerar_documentacao_estrutura(self):
        """Gera documentação completa da estrutura do banco de dados"""
        print("\n📄 Gerando documentação da estrutura do banco...")
        
        if not self.db_path.exists():
            print("❌ Banco de dados não existe ainda!")
            return False
        
        conn = duckdb.connect(str(self.db_path))
        
        try:
            # Obter lista de tabelas
            tabelas = conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'main'
                ORDER BY table_name
            """).fetchall()
            
            if not tabelas:
                print("⚠️ Nenhuma tabela encontrada no banco!")
                return False
            
            with open(self.estrutura_file, 'w', encoding='utf-8') as f:
                # Cabeçalho
                f.write("=" * 100 + "\n")
                f.write("DOCUMENTAÇÃO DA ESTRUTURA DO BANCO DE DADOS DUCKDB\n")
                f.write("=" * 100 + "\n\n")
                
                f.write(f"Arquivo: {self.db_path}\n")
                f.write(f"Data da análise: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
                
                # Tamanho do arquivo
                tamanho_mb = self.db_path.stat().st_size / (1024 * 1024)
                f.write(f"Tamanho do arquivo: {tamanho_mb:.2f} MB\n")
                
                # Versão do DuckDB
                versao = conn.execute("SELECT version()").fetchone()[0]
                f.write(f"Versão do DuckDB: {versao}\n\n")
                
                # Resumo
                f.write("=" * 100 + "\n")
                f.write(f"RESUMO: {len(tabelas)} tabela(s) encontrada(s)\n")
                f.write("-" * 100 + "\n")
                
                # Lista resumida de tabelas
                for idx, (tabela,) in enumerate(tabelas, 1):
                    count = conn.execute(f"SELECT COUNT(*) FROM {tabela}").fetchone()[0]
                    f.write(f"  {idx:2}. {tabela:40} - {count:15,} registros\n")
                
                f.write("\n")
                
                # Detalhes de cada tabela
                for idx, (tabela,) in enumerate(tabelas, 1):
                    f.write("=" * 100 + "\n")
                    f.write(f"TABELA {idx}: {tabela.upper()}\n")
                    f.write("=" * 100 + "\n\n")
                    
                    # Total de registros
                    count = conn.execute(f"SELECT COUNT(*) FROM {tabela}").fetchone()[0]
                    f.write(f"Total de registros: {count:,}\n\n")
                    
                    # Estrutura da tabela
                    f.write("ESTRUTURA DA TABELA:\n")
                    f.write("-" * 100 + "\n")
                    f.write(f"{'#':5} {'Campo':30} {'Tipo':20} {'Nulo?':10} {'Padrão':30}\n")
                    f.write("-" * 100 + "\n")
                    
                    colunas = conn.execute(f"""
                        SELECT 
                            column_name,
                            data_type,
                            is_nullable,
                            column_default
                        FROM information_schema.columns
                        WHERE table_name = '{tabela}'
                        ORDER BY ordinal_position
                    """).fetchall()
                    
                    for i, (col, tipo, nullable, default) in enumerate(colunas, 1):
                        nullable_str = "SIM" if nullable == "YES" else "NÃO"
                        default_str = str(default) if default else "-"
                        if len(default_str) > 30:
                            default_str = default_str[:27] + "..."
                        f.write(f"{i:<5} {col[:30]:<30} {tipo[:20]:<20} {nullable_str:<10} {default_str:<30}\n")
                    
                    # Amostra de dados
                    if count > 0:
                        f.write("\nAMOSTRA DE DADOS (5 primeiros registros):\n")
                        f.write("-" * 100 + "\n")
                        
                        # Pegar primeiras 8 colunas para não estourar a largura
                        cols_limit = min(8, len(colunas))
                        cols_names = [col[0] for col in colunas[:cols_limit]]
                        
                        # Cabeçalho
                        header = ""
                        for col in cols_names:
                            header += f"{col[:15]:<16}"
                        f.write(header + "\n")
                        f.write("-" * len(header) + "\n")
                        
                        # Dados
                        query = f"SELECT {', '.join(cols_names)} FROM {tabela} LIMIT 5"
                        amostra = conn.execute(query).fetchall()
                        
                        for row in amostra:
                            linha = ""
                            for val in row:
                                val_str = str(val) if val is not None else "NULL"
                                if len(val_str) > 13:
                                    val_str = val_str[:10] + "..."
                                linha += f"{val_str:<16}"
                            f.write(linha + "\n")
                    
                    f.write("\n")
                
                # Rodapé
                f.write("=" * 100 + "\n")
                f.write("FIM DO RELATÓRIO\n")
                f.write("=" * 100 + "\n")
            
            print(f"✅ Documentação gerada: {self.estrutura_file}")
            return True
            
        except Exception as e:
            print(f"❌ Erro ao gerar documentação: {e}")
            return False
        finally:
            conn.close()
    
    def analisar_situacao_completa(self):
        """Análise completa e inteligente da situação"""
        print("\n" + "="*80)
        print("🧠 ANÁLISE INTELIGENTE COMPLETA")
        print("="*80)
        
        # Listar arquivos Excel e CSV
        arquivos_excel = list(self.dimensao_path.glob("*.xlsx")) + \
                        list(self.dimensao_path.glob("*.xls")) + \
                        list(self.dimensao_path.glob("*.csv"))
        
        print(f"📊 Arquivos encontrados na pasta: {len(arquivos_excel)}")
        if arquivos_excel:
            print("📋 Lista de arquivos:")
            for arq in arquivos_excel[:10]:  # Mostra até 10 arquivos
                print(f"   • {arq.name}")
            if len(arquivos_excel) > 10:
                print(f"   ... e mais {len(arquivos_excel) - 10} arquivos")
        else:
            print("⚠️ Nenhum arquivo Excel ou CSV encontrado!")
            print(f"   Verifique se os arquivos estão em: {self.dimensao_path.absolute()}")
        
        # Listar tabelas no banco
        tabelas_banco = set()
        if self.db_path.exists():
            conn = duckdb.connect(str(self.db_path))
            try:
                result = conn.execute("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'main'
                """).fetchall()
                tabelas_banco = {t[0] for t in result}
                print(f"🗄️ Tabelas no banco: {len(tabelas_banco)}")
            finally:
                conn.close()
        else:
            print("🗄️ Banco de dados ainda não existe")
        
        # Classificar arquivos
        status_arquivos = {
            'novos': [],
            'conhecidos_existentes': [],
            'conhecidos_ausentes': [],
            'modificados': [],
            'desconhecidos_com_tabela': []
        }
        
        for arquivo in arquivos_excel:
            nome_arquivo = arquivo.name
            hash_atual = self.calcular_hash_arquivo(arquivo)
            
            if nome_arquivo in self.mapeamentos:
                # Arquivo conhecido
                info = self.mapeamentos[nome_arquivo]
                nome_tabela = info['tabela']
                
                if nome_tabela in tabelas_banco:
                    # Tabela existe
                    if info.get('hash') != hash_atual:
                        status_arquivos['modificados'].append({
                            'arquivo': nome_arquivo,
                            'tabela': nome_tabela,
                            'ultima_carga': info.get('ultima_carga', 'desconhecida'),
                            'caminho': arquivo
                        })
                    else:
                        status_arquivos['conhecidos_existentes'].append({
                            'arquivo': nome_arquivo,
                            'tabela': nome_tabela,
                            'ultima_carga': info.get('ultima_carga', 'desconhecida'),
                            'caminho': arquivo
                        })
                else:
                    # Tabela não existe (foi deletada?)
                    status_arquivos['conhecidos_ausentes'].append({
                        'arquivo': nome_arquivo,
                        'tabela': nome_tabela,
                        'caminho': arquivo
                    })
            else:
                # Arquivo desconhecido
                nome_sugerido = self.gerar_nome_tabela_inteligente(nome_arquivo)
                
                if nome_sugerido in tabelas_banco:
                    # Pode ser um arquivo renomeado
                    status_arquivos['desconhecidos_com_tabela'].append({
                        'arquivo': nome_arquivo,
                        'tabela_sugerida': nome_sugerido,
                        'caminho': arquivo
                    })
                else:
                    # Completamente novo
                    status_arquivos['novos'].append({
                        'arquivo': nome_arquivo,
                        'tabela_sugerida': nome_sugerido,
                        'caminho': arquivo
                    })
        
        return status_arquivos, tabelas_banco
    
    def processar_arquivo_com_aprendizado(self, info_arquivo):
        """Processa arquivo e aprende o mapeamento"""
        arquivo = info_arquivo['arquivo']
        caminho = info_arquivo['caminho']
        
        # Determina nome da tabela
        if 'tabela' in info_arquivo:
            nome_tabela = info_arquivo['tabela']
        else:
            nome_tabela = info_arquivo.get('tabela_sugerida', 
                                          self.gerar_nome_tabela_inteligente(arquivo))
        
        print(f"\n📄 Processando: {arquivo}")
        
        try:
            # Ler arquivo (suporta Excel e CSV)
            if caminho.suffix.lower() == '.csv':
                df = pd.read_csv(caminho)
            else:
                df = pd.read_excel(caminho)
            
            df.columns = df.columns.str.lower()
            
            print(f"   📊 {len(df):,} linhas, {len(df.columns)} colunas")
            
            # Detectar PK
            pk = self.detectar_chave_primaria(df, nome_tabela)
            print(f"   🔑 Chave primária detectada: {pk}")
            
            # Perguntar confirmação
            print(f"   📋 Tabela: {nome_tabela}")
            resp = input("   Confirmar (Enter), digitar outro nome (n), ou pular (p)? ").strip()
            
            if resp.lower() == 'p':
                print("   ⏭️ Pulado")
                return False
            elif resp.lower() == 'n':
                novo_nome = input("   Digite o nome da tabela: ").strip()
                if novo_nome:
                    nome_tabela = novo_nome
            
            # Verificar se tabela existe
            conn = duckdb.connect(str(self.db_path))
            try:
                existe = conn.execute(f"""
                    SELECT COUNT(*) FROM information_schema.tables 
                    WHERE table_name = '{nome_tabela}'
                """).fetchone()[0] > 0
                
                if existe:
                    count = conn.execute(f"SELECT COUNT(*) FROM {nome_tabela}").fetchone()[0]
                    print(f"   ⚠️ Tabela existe com {count:,} registros")
                    resp = input("   Substituir? (s/N): ")
                    if resp.lower() != 's':
                        return False
                    conn.execute(f"DROP TABLE {nome_tabela}")
                
                # Criar tabela
                conn.register('df_temp', df)
                conn.execute(f"CREATE TABLE {nome_tabela} AS SELECT * FROM df_temp")
                conn.unregister('df_temp')
                
                count_final = conn.execute(f"SELECT COUNT(*) FROM {nome_tabela}").fetchone()[0]
                print(f"   ✅ {count_final:,} registros carregados!")
                
                # APRENDER E SALVAR o mapeamento
                self.mapeamentos[arquivo] = {
                    'tabela': nome_tabela,
                    'pk': pk,
                    'hash': self.calcular_hash_arquivo(caminho),
                    'ultima_carga': datetime.now().isoformat(),
                    'registros': count_final,
                    'colunas': list(df.columns)
                }
                self.salvar_mapeamentos()
                
                # Salvar no histórico
                self.salvar_historico(arquivo, nome_tabela, 'carga', count_final)
                
                return True
                
            finally:
                conn.close()
                
        except Exception as e:
            print(f"   ❌ Erro: {e}")
            return False
    
    def menu_principal(self):
        """Menu principal inteligente"""
        print("\n" + "="*80)
        print("🧠 CARREGADOR INTELIGENTE DE DIMENSÕES")
        print("="*80)
        print(f"📁 Pasta de dimensões: {self.dimensao_path}")
        print(f"🗄️  Banco de dados: {self.db_path}")
        print(f"📋 Metadados: {self.metadata_path}")
        
        # Análise
        status, tabelas = self.analisar_situacao_completa()
        
        # Mostrar resumo
        if status['novos']:
            print(f"\n🆕 Arquivos COMPLETAMENTE NOVOS: {len(status['novos'])}")
            for item in status['novos']:
                print(f"   • {item['arquivo']}")
        
        if status['modificados']:
            print(f"\n📝 Arquivos MODIFICADOS: {len(status['modificados'])}")
            for item in status['modificados']:
                print(f"   • {item['arquivo']} (última carga: {item['ultima_carga'][:10]})")
        
        if status['conhecidos_existentes']:
            print(f"\n✅ Arquivos SINCRONIZADOS: {len(status['conhecidos_existentes'])}")
        
        if status['conhecidos_ausentes']:
            print(f"\n⚠️ Tabelas DELETADAS do banco: {len(status['conhecidos_ausentes'])}")
            for item in status['conhecidos_ausentes']:
                print(f"   • {item['arquivo']} → {item['tabela']} (tabela não existe mais)")
        
        # Menu
        print("\n" + "="*80)
        print("OPÇÕES:")
        print("[1] Carregar apenas NOVOS")
        print("[2] Atualizar MODIFICADOS")
        print("[3] Recriar tabelas DELETADAS")
        print("[4] Processar TUDO")
        print("[5] Ver histórico de cargas")
        print("[6] Gerar documentação da estrutura")
        print("[7] Resetar aprendizado")
        print("[0] Sair")
        
        opcao = input("\nEscolha: ").strip()
        
        if opcao == '1':
            if not status['novos']:
                print("ℹ️ Nenhum arquivo novo para carregar!")
            else:
                for item in status['novos']:
                    self.processar_arquivo_com_aprendizado(item)
        
        elif opcao == '2':
            for item in status['modificados']:
                print(f"\n📝 Arquivo modificado: {item['arquivo']}")
                resp = input("   Atualizar? (s/N): ")
                if resp.lower() == 's':
                    self.processar_arquivo_com_aprendizado(item)
        
        elif opcao == '3':
            for item in status['conhecidos_ausentes']:
                self.processar_arquivo_com_aprendizado(item)
        
        elif opcao == '4':
            todos = (status['novos'] + status['modificados'] + 
                    status['conhecidos_ausentes'])
            for item in todos:
                self.processar_arquivo_com_aprendizado(item)
        
        elif opcao == '5':
            print("\n📜 HISTÓRICO DE CARGAS:")
            for arquivo, historico in self.historico.items():
                print(f"\n{arquivo}:")
                for h in historico[-3:]:  # Últimas 3 operações
                    print(f"   • {h['data'][:19]} - {h['acao']} - {h['registros']} registros")
        
        elif opcao == '6':
            self.gerar_documentacao_estrutura()
        
        elif opcao == '7':
            resp = input("⚠️ Isso apagará todo o aprendizado. Confirma? (s/N): ")
            if resp.lower() == 's':
                self.mapeamentos = {}
                self.historico = {}
                self.salvar_mapeamentos()
                print("🧹 Aprendizado resetado!")
        
        print("\n✨ Operação concluída!")

def main():
    """Função principal com suporte a argumentos"""
    parser = argparse.ArgumentParser(description='Carregador Inteligente de Dimensões para DuckDB')
    parser.add_argument('--estrutura', action='store_true', 
                       help='Apenas gera a documentação da estrutura do banco')
    
    args = parser.parse_args()
    
    carregador = CarregadorInteligenteDimensoes()
    
    if args.estrutura:
        # Apenas gera a estrutura
        print("🔍 Modo: Apenas gerar estrutura do banco")
        carregador.gerar_documentacao_estrutura()
    else:
        # Menu interativo normal
        carregador.menu_principal()

if __name__ == "__main__":
    main()