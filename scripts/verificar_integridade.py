#!/usr/bin/env python3
"""
Script INTELIGENTE para verificar integridade referencial entre tabelas fato e dimensão.
Identifica valores órfãos e problemas de relacionamento no novo sistema.
Adaptado para a nova estrutura de pastas e banco único.
"""
import duckdb
from pathlib import Path
from datetime import datetime
import pandas as pd
import json

class VerificadorIntegridadeInteligente:
    """Verificador de integridade com aprendizado automático"""
    
    def __init__(self):
        # Caminhos do novo sistema
        script_dir = Path(__file__).parent
        self.base_path = script_dir.parent / "dados_brutos"
        self.db_path = self.base_path / "duckdb" / "database.duckdb"
        self.metadata_path = self.base_path / "metadata"
        self.relatorios_path = self.base_path / "relatorios_integridade"
        
        # Criar pasta de relatórios se não existir
        self.relatorios_path.mkdir(parents=True, exist_ok=True)
        
        print(f"📍 Banco de dados: {self.db_path}")
        print(f"📋 Relatórios em: {self.relatorios_path}")
        
        # Carregar mapeamentos para entender melhor os dados
        self.mapeamento_dimensoes = self.carregar_json(self.metadata_path / "mapeamento_dimensoes.json")
        self.mapeamento_fatos = self.carregar_json(self.metadata_path / "mapeamento_fatos.json")
        
        # Descobrir relacionamentos dinamicamente do banco
        self.relacionamentos = self.descobrir_relacionamentos_automaticamente()
    
    def carregar_json(self, arquivo):
        """Carrega arquivo JSON se existir"""
        if arquivo.exists():
            try:
                with open(arquivo, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def verificar_tabela_existe(self, conn, tabela):
        """Verifica se tabela existe"""
        query = f"""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_name = '{tabela}'
        """
        return conn.execute(query).fetchone()[0] > 0
    
    def verificar_coluna_existe(self, conn, tabela, coluna):
        """Verifica se coluna existe na tabela"""
        query = f"""
        SELECT COUNT(*) 
        FROM information_schema.columns 
        WHERE table_name = '{tabela}' 
        AND column_name = LOWER('{coluna}')
        """
        return conn.execute(query).fetchone()[0] > 0
    
    def descobrir_relacionamentos_automaticamente(self):
        """Descobre relacionamentos dinamicamente analisando o banco de dados"""
        print("🔍 Descobrindo relacionamentos automaticamente...")
        
        relacionamentos = {}
        
        if not self.db_path.exists():
            print("⚠️ Banco não existe, usando relacionamentos padrão")
            return relacionamentos
        
        conn = duckdb.connect(str(self.db_path), read_only=True)
        
        try:
            # Buscar todas as tabelas fato
            tabelas_fato = conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name IN ('despesa_saldo', 'receita_saldo', 
                                    'despesa_lancamento', 'receita_lancamento')
            """).fetchall()
            
            # Buscar todas as tabelas dimensão
            tabelas_dim = conn.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name LIKE 'dim_%'
                ORDER BY table_name
            """).fetchall()
            
            print(f"   Encontradas {len(tabelas_fato)} tabelas fato e {len(tabelas_dim)} dimensões")
            
            # Para cada tabela fato
            for (tabela_fato,) in tabelas_fato:
                relacionamentos[tabela_fato] = {}
                
                # Buscar colunas da tabela fato
                colunas_fato = conn.execute(f"""
                    SELECT column_name, data_type
                    FROM information_schema.columns 
                    WHERE table_name = '{tabela_fato}'
                    ORDER BY ordinal_position
                """).fetchall()
                
                # Para cada coluna da tabela fato
                for coluna_fato, tipo_fato in colunas_fato:
                    coluna_lower = coluna_fato.lower()
                    
                    # Pular colunas que claramente não são FKs
                    if coluna_lower in ['data_carga', 'periodo', 'vacredito', 'vadebito', 
                                       'saldo_contabil_despesa', 'saldo_contabil_receita',
                                       'inmes', 'inesfera', 'conatureza', 'coexercicio',
                                       'dalancamento', 'valancamento', 'indebitocredito',
                                       'inabreencerra', 'datransacao', 'hotransacao',
                                       'cougdestino', 'cogestaodestino', 'cougcontab',
                                       'cogestaocontab', 'cosubelemento', 'nulancamento',
                                       'nudocumento', 'tipo_lancamento']:
                        continue
                    
                    # Para cada tabela dimensão, verificar match
                    for (tabela_dim,) in tabelas_dim:
                        # Buscar colunas da dimensão
                        colunas_dim = conn.execute(f"""
                            SELECT column_name, data_type
                            FROM information_schema.columns 
                            WHERE table_name = '{tabela_dim}'
                            AND column_name = '{coluna_lower}'
                        """).fetchall()
                        
                        if colunas_dim:
                            # Encontrou match!
                            relacionamentos[tabela_fato][coluna_lower] = {
                                'tabela': tabela_dim,
                                'coluna': coluna_lower,
                                'obrigatorio': False,
                                'tipo_fato': tipo_fato,
                                'tipo_dim': colunas_dim[0][1]
                            }
                            break
            
            # Mostrar resumo
            for tabela, rels in relacionamentos.items():
                print(f"   {tabela}: {len(rels)} relacionamentos descobertos")
            
            # Salvar relacionamentos descobertos para uso futuro
            if self.relacionamentos:
                arquivo_relacionamentos = self.metadata_path / "relacionamentos_descobertos.json"
                try:
                    # Converter para formato serializável
                    rel_para_salvar = {}
                    for tabela, rels in self.relacionamentos.items():
                        rel_para_salvar[tabela] = {}
                        for col, info in rels.items():
                            rel_para_salvar[tabela][col] = {
                                'tabela': info['tabela'],
                                'coluna': info['coluna'],
                                'obrigatorio': info.get('obrigatorio', False)
                            }
                    
                    with open(arquivo_relacionamentos, 'w', encoding='utf-8') as f:
                        json.dump(rel_para_salvar, f, indent=2, ensure_ascii=False)
                    print(f"💾 Relacionamentos salvos em: {arquivo_relacionamentos}")
                except Exception as e:
                    print(f"⚠️ Erro ao salvar relacionamentos: {e}")
            
        except Exception as e:
            print(f"⚠️ Erro ao descobrir relacionamentos: {e}")
        finally:
            conn.close()
        
        return relacionamentos
    
    def verificar_integridade_coluna(self, conn, tabela_fato, coluna_fk, info_dimensao):
        """Verifica integridade de uma coluna específica"""
        resultado = {
            'coluna_fk': coluna_fk,
            'tabela_dimensao': info_dimensao['tabela'],
            'obrigatorio': info_dimensao.get('obrigatorio', False),
            'status': 'OK',
            'total_registros': 0,
            'valores_distintos': 0,
            'valores_nulos': 0,
            'valores_orfaos': 0,
            'percentual_orfaos': 0,
            'exemplos_orfaos': []
        }
        
        try:
            # Verificar se coluna existe na tabela fato
            if not self.verificar_coluna_existe(conn, tabela_fato, coluna_fk):
                resultado['status'] = 'COLUNA_NAO_EXISTE_FATO'
                return resultado
            
            # Verificar se tabela dimensão existe
            if not self.verificar_tabela_existe(conn, info_dimensao['tabela']):
                resultado['status'] = 'TABELA_DIM_NAO_EXISTE'
                return resultado
            
            # Verificar se coluna existe na dimensão
            coluna_dim = info_dimensao.get('coluna', coluna_fk)
            if not self.verificar_coluna_existe(conn, info_dimensao['tabela'], coluna_dim):
                resultado['status'] = 'COLUNA_NAO_EXISTE_DIM'
                return resultado
            
            # Análise de valores
            # Total de registros e valores distintos
            query_analise = f"""
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT {coluna_fk}) as distintos,
                SUM(CASE WHEN {coluna_fk} IS NULL THEN 1 ELSE 0 END) as nulos
            FROM {tabela_fato}
            """
            analise = conn.execute(query_analise).fetchone()
            resultado['total_registros'] = analise[0]
            resultado['valores_distintos'] = analise[1]
            resultado['valores_nulos'] = analise[2]
            
            # Verificar valores órfãos (que não existem na dimensão)
            # Usar CAST para compatibilidade de tipos
            query_orfaos = f"""
            SELECT COUNT(DISTINCT f.{coluna_fk}) as qtd_orfaos
            FROM {tabela_fato} f
            WHERE f.{coluna_fk} IS NOT NULL
            AND TRIM(f.{coluna_fk}::VARCHAR) != ''
            AND NOT EXISTS (
                SELECT 1 
                FROM {info_dimensao['tabela']} d 
                WHERE TRIM(d.{coluna_dim}::VARCHAR) = TRIM(f.{coluna_fk}::VARCHAR)
            )
            """
            
            qtd_orfaos = conn.execute(query_orfaos).fetchone()[0]
            resultado['valores_orfaos'] = qtd_orfaos
            
            if resultado['total_registros'] > 0:
                resultado['percentual_orfaos'] = (qtd_orfaos / resultado['valores_distintos'] * 100) if resultado['valores_distintos'] > 0 else 0
            
            # Se há órfãos, pegar exemplos
            if qtd_orfaos > 0:
                query_exemplos = f"""
                SELECT DISTINCT f.{coluna_fk}::VARCHAR, COUNT(*) as qtd
                FROM {tabela_fato} f
                WHERE f.{coluna_fk} IS NOT NULL
                AND TRIM(f.{coluna_fk}::VARCHAR) != ''
                AND NOT EXISTS (
                    SELECT 1 
                    FROM {info_dimensao['tabela']} d 
                    WHERE TRIM(d.{coluna_dim}::VARCHAR) = TRIM(f.{coluna_fk}::VARCHAR)
                )
                GROUP BY f.{coluna_fk}
                ORDER BY COUNT(*) DESC
                LIMIT 5
                """
                exemplos = conn.execute(query_exemplos).fetchall()
                resultado['exemplos_orfaos'] = [(str(ex[0]), ex[1]) for ex in exemplos]
                resultado['status'] = 'ORFAOS_ENCONTRADOS'
            
            # Verificar se campo obrigatório tem nulos
            elif info_dimensao.get('obrigatorio', False) and resultado['valores_nulos'] > 0:
                resultado['status'] = 'NULOS_EM_CAMPO_OBRIGATORIO'
            
        except Exception as e:
            resultado['status'] = 'ERRO'
            resultado['erro'] = str(e)
        
        return resultado
    
    def executar_verificacao(self):
        """Executa verificação completa"""
        print("\n" + "="*80)
        print("🔍 VERIFICAÇÃO INTELIGENTE DE INTEGRIDADE")
        print("="*80)
        
        if not self.db_path.exists():
            print(f"❌ Banco de dados não encontrado: {self.db_path}")
            return
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        relatorio_txt = self.relatorios_path / f"integridade_{timestamp}.txt"
        relatorio_excel = self.relatorios_path / f"integridade_{timestamp}.xlsx"
        
        conn = duckdb.connect(str(self.db_path), read_only=True)
        
        try:
            # Coletar todos os resultados
            todos_resultados = {}
            resumo_geral = {
                'total_verificacoes': 0,
                'problemas_criticos': 0,
                'avisos': 0,
                'ok': 0
            }
            
            # Verificar cada tabela fato
            tabelas_fato = ['despesa_saldo', 'receita_saldo', 'despesa_lancamento', 'receita_lancamento']
            
            for tabela_fato in tabelas_fato:
                print(f"\n📊 Verificando: {tabela_fato}")
                
                if not self.verificar_tabela_existe(conn, tabela_fato):
                    print(f"   ⏭️ Tabela não existe ainda")
                    todos_resultados[tabela_fato] = {'status': 'NAO_EXISTE', 'verificacoes': []}
                    continue
                
                # Obter total de registros
                total_registros = conn.execute(f"SELECT COUNT(*) FROM {tabela_fato}").fetchone()[0]
                print(f"   📊 Total de registros: {total_registros:,}")
                
                if total_registros == 0:
                    print(f"   ⏭️ Tabela vazia")
                    todos_resultados[tabela_fato] = {'status': 'VAZIA', 'verificacoes': []}
                    continue
                
                # Obter relacionamentos da tabela
                relacionamentos_config = self.relacionamentos.get(tabela_fato, {})
                
                # Se não tem relacionamentos descobertos, tentar descobrir agora
                if not relacionamentos_config:
                    print(f"   🔍 Descobrindo relacionamentos para {tabela_fato}...")
                    relacionamentos_config = self.descobrir_relacionamentos_tabela(conn, tabela_fato)
                
                # Verificar cada relacionamento
                verificacoes = []
                for coluna_fk, info_dim in relacionamentos_config.items():
                    print(f"   Verificando: {coluna_fk} -> {info_dim['tabela']}")
                    resultado = self.verificar_integridade_coluna(conn, tabela_fato, coluna_fk, info_dim)
                    verificacoes.append(resultado)
                    resumo_geral['total_verificacoes'] += 1
                    
                    # Classificar resultado
                    if resultado['status'] in ['ORFAOS_ENCONTRADOS', 'NULOS_EM_CAMPO_OBRIGATORIO']:
                        resumo_geral['problemas_criticos'] += 1
                        print(f"      ❌ Problemas encontrados!")
                    elif resultado['status'] in ['COLUNA_NAO_EXISTE_FATO', 'TABELA_DIM_NAO_EXISTE']:
                        resumo_geral['avisos'] += 1
                        print(f"      ⚠️ Aviso")
                    elif resultado['status'] == 'OK':
                        resumo_geral['ok'] += 1
                        print(f"      ✅ OK")
                
                todos_resultados[tabela_fato] = {
                    'status': 'VERIFICADO',
                    'total_registros': total_registros,
                    'verificacoes': verificacoes
                }
            
            # Gerar relatório TXT
            self.gerar_relatorio_txt(relatorio_txt, todos_resultados, resumo_geral)
            
            # Gerar relatório Excel
            self.gerar_relatorio_excel(relatorio_excel, todos_resultados, resumo_geral, conn)
            
            # Mostrar resumo
            print("\n" + "="*80)
            print("📊 RESUMO DA VERIFICAÇÃO")
            print("="*80)
            print(f"Total de verificações: {resumo_geral['total_verificacoes']}")
            print(f"✅ OK: {resumo_geral['ok']}")
            print(f"⚠️ Avisos: {resumo_geral['avisos']}")
            print(f"❌ Problemas críticos: {resumo_geral['problemas_criticos']}")
            
            print(f"\n📄 Relatórios gerados:")
            print(f"   • {relatorio_txt}")
            print(f"   • {relatorio_excel}")
            
            if resumo_geral['problemas_criticos'] > 0:
                print("\n⚠️ ATENÇÃO: Foram encontrados problemas de integridade!")
                print("   Verifique os relatórios para detalhes e correções sugeridas.")
            
        except Exception as e:
            print(f"❌ Erro: {e}")
            import traceback
            traceback.print_exc()
        finally:
            conn.close()
    
    def gerar_relatorio_txt(self, arquivo, resultados, resumo):
        """Gera relatório em formato TXT"""
        with open(arquivo, 'w', encoding='utf-8') as f:
            f.write("=" * 100 + "\n")
            f.write("RELATÓRIO DE INTEGRIDADE REFERENCIAL\n")
            f.write("=" * 100 + "\n\n")
            f.write(f"Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n")
            f.write(f"Banco: {self.db_path}\n\n")
            
            # Resumo
            f.write("RESUMO GERAL\n")
            f.write("-" * 50 + "\n")
            f.write(f"Total de verificações: {resumo['total_verificacoes']}\n")
            f.write(f"OK: {resumo['ok']}\n")
            f.write(f"Avisos: {resumo['avisos']}\n")
            f.write(f"Problemas críticos: {resumo['problemas_criticos']}\n\n")
            
            # Detalhes por tabela
            for tabela, info in resultados.items():
                f.write("=" * 100 + "\n")
                f.write(f"TABELA: {tabela.upper()}\n")
                f.write("=" * 100 + "\n\n")
                
                if info['status'] == 'NAO_EXISTE':
                    f.write("❌ Tabela não existe no banco\n\n")
                    continue
                elif info['status'] == 'VAZIA':
                    f.write("⚠️ Tabela existe mas está vazia\n\n")
                    continue
                
                f.write(f"Total de registros: {info['total_registros']:,}\n")
                f.write(f"Verificações realizadas: {len(info['verificacoes'])}\n\n")
                
                # Tabela de verificações
                f.write(f"{'Coluna FK':<20} {'Tabela Dimensão':<30} {'Status':<25} {'Órfãos':<10} {'%':<8}\n")
                f.write("-" * 93 + "\n")
                
                for v in info['verificacoes']:
                    status_str = {
                        'OK': '✅ OK',
                        'ORFAOS_ENCONTRADOS': '❌ Órfãos',
                        'NULOS_EM_CAMPO_OBRIGATORIO': '⚠️ Nulos',
                        'COLUNA_NAO_EXISTE_FATO': '➖ Sem coluna',
                        'TABELA_DIM_NAO_EXISTE': '⚠️ Sem dimensão',
                        'COLUNA_NAO_EXISTE_DIM': '⚠️ Sem coluna dim'
                    }.get(v['status'], v['status'])
                    
                    percentual = f"{v['percentual_orfaos']:.1f}%" if v['valores_orfaos'] > 0 else "-"
                    
                    f.write(f"{v['coluna_fk']:<20} {v['tabela_dimensao']:<30} "
                           f"{status_str:<25} {v['valores_orfaos']:<10} {percentual:<8}\n")
                
                # Detalhes dos problemas
                problemas = [v for v in info['verificacoes'] if v['status'] in ['ORFAOS_ENCONTRADOS', 'NULOS_EM_CAMPO_OBRIGATORIO']]
                if problemas:
                    f.write("\nDETALHES DOS PROBLEMAS:\n")
                    f.write("-" * 50 + "\n")
                    for p in problemas:
                        f.write(f"\n{p['coluna_fk']} -> {p['tabela_dimensao']}:\n")
                        if p['valores_orfaos'] > 0:
                            f.write(f"  • {p['valores_orfaos']} valores órfãos\n")
                            if p['exemplos_orfaos']:
                                f.write(f"  • Exemplos (valor: quantidade):\n")
                                for valor, qtd in p['exemplos_orfaos']:
                                    f.write(f"    - {valor}: {qtd} registros\n")
                        if p['valores_nulos'] > 0 and p.get('obrigatorio'):
                            f.write(f"  • {p['valores_nulos']} valores nulos em campo obrigatório\n")
                
                f.write("\n")
            
            # Recomendações
            if resumo['problemas_criticos'] > 0:
                f.write("\n" + "=" * 100 + "\n")
                f.write("RECOMENDAÇÕES\n")
                f.write("=" * 100 + "\n\n")
                f.write("1. Verifique se todas as tabelas dimensão foram carregadas corretamente\n")
                f.write("2. Para valores órfãos, considere:\n")
                f.write("   - Adicionar os valores faltantes nas dimensões\n")
                f.write("   - Criar registro 'DESCONHECIDO' ou 'NÃO INFORMADO' nas dimensões\n")
                f.write("   - Corrigir os dados na origem antes da próxima carga\n")
                f.write("3. Para campos obrigatórios com nulos:\n")
                f.write("   - Verificar se a extração está completa\n")
                f.write("   - Definir valores padrão apropriados\n")
                f.write("4. Execute o script de carga de dimensões novamente se necessário\n")
    
    def descobrir_relacionamentos_tabela(self, conn, tabela_fato):
        """Descobre relacionamentos de uma tabela específica"""
        relacionamentos = {}
        
        # Buscar colunas da tabela fato
        colunas_fato = conn.execute(f"""
            SELECT column_name, data_type
            FROM information_schema.columns 
            WHERE table_name = '{tabela_fato}'
            ORDER BY ordinal_position
        """).fetchall()
        
        # Buscar todas as tabelas dimensão
        tabelas_dim = conn.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE 'dim_%'
            ORDER BY table_name
        """).fetchall()
        
        # Para cada coluna da tabela fato
        for coluna_fato, tipo_fato in colunas_fato:
            coluna_lower = coluna_fato.lower()
            
            # Pular colunas que claramente não são FKs
            if coluna_lower in ['data_carga', 'periodo', 'vacredito', 'vadebito', 
                               'saldo_contabil_despesa', 'saldo_contabil_receita',
                               'inmes', 'inesfera', 'conatureza', 'coexercicio',
                               'dalancamento', 'valancamento', 'indebitocredito',
                               'inabreencerra', 'datransacao', 'hotransacao',
                               'cougdestino', 'cogestaodestino', 'cougcontab',
                               'cogestaocontab', 'cosubelemento', 'nulancamento',
                               'nudocumento', 'tipo_lancamento']:
                continue
            
            # Para cada tabela dimensão, verificar match
            for (tabela_dim,) in tabelas_dim:
                # Verificar se a coluna existe na dimensão
                if self.verificar_coluna_existe(conn, tabela_dim, coluna_lower):
                    relacionamentos[coluna_lower] = {
                        'tabela': tabela_dim,
                        'coluna': coluna_lower,
                        'obrigatorio': False,
                        'descoberto': True
                    }
                    break
        
        return relacionamentos
    
    def gerar_relatorio_excel(self, arquivo, resultados, resumo, conn):
        """Gera relatório em formato Excel"""
        try:
            with pd.ExcelWriter(arquivo, engine='openpyxl') as writer:
                # Aba de resumo
                df_resumo = pd.DataFrame([{
                    'Total Verificações': resumo['total_verificacoes'],
                    'OK': resumo['ok'],
                    'Avisos': resumo['avisos'],
                    'Problemas Críticos': resumo['problemas_criticos']
                }])
                df_resumo.to_excel(writer, sheet_name='Resumo', index=False)
                
                # Aba para cada tabela fato com problemas
                for tabela, info in resultados.items():
                    if info['status'] != 'VERIFICADO' or not info['verificacoes']:
                        continue
                    
                    # Criar DataFrame com as verificações
                    dados_verificacao = []
                    for v in info['verificacoes']:
                        dados_verificacao.append({
                            'Coluna FK': v['coluna_fk'],
                            'Tabela Dimensão': v['tabela_dimensao'],
                            'Status': v['status'],
                            'Total Registros': v['total_registros'],
                            'Valores Distintos': v['valores_distintos'],
                            'Valores Nulos': v['valores_nulos'],
                            'Valores Órfãos': v['valores_orfaos'],
                            '% Órfãos': f"{v['percentual_orfaos']:.2f}%"
                        })
                    
                    if dados_verificacao:
                        df_verificacao = pd.DataFrame(dados_verificacao)
                        
                        # Nome da aba (máximo 31 caracteres)
                        nome_aba = tabela[:31]
                        df_verificacao.to_excel(writer, sheet_name=nome_aba, index=False)
                        
                        # Formatar
                        worksheet = writer.sheets[nome_aba]
                        for column in worksheet.columns:
                            max_length = 0
                            column_cells = [cell for cell in column]
                            for cell in column_cells:
                                try:
                                    if len(str(cell.value)) > max_length:
                                        max_length = len(str(cell.value))
                                except:
                                    pass
                            adjusted_width = min(max_length + 2, 50)
                            worksheet.column_dimensions[column_cells[0].column_letter].width = adjusted_width
                
                # Aba com queries de correção
                if resumo['problemas_criticos'] > 0:
                    queries_correcao = []
                    for tabela, info in resultados.items():
                        if info['status'] != 'VERIFICADO':
                            continue
                        
                        for v in info['verificacoes']:
                            if v['status'] == 'ORFAOS_ENCONTRADOS' and v['valores_orfaos'] > 0:
                                # Query simplificada com CAST
                                query = f"""
-- Valores órfãos em {tabela}.{v['coluna_fk']}
SELECT {v['coluna_fk']}::VARCHAR as valor, COUNT(*) as qtd
FROM {tabela}
WHERE {v['coluna_fk']} IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM {v['tabela_dimensao']} d
    WHERE d.{v['coluna_fk']}::VARCHAR = {tabela}.{v['coluna_fk']}::VARCHAR
)
GROUP BY {v['coluna_fk']}
ORDER BY COUNT(*) DESC;
"""
                                queries_correcao.append({
                                    'Tabela': tabela,
                                    'Problema': f"Órfãos em {v['coluna_fk']}",
                                    'Query SQL': query.strip()
                                })
                    
                    if queries_correcao:
                        df_queries = pd.DataFrame(queries_correcao)
                        df_queries.to_excel(writer, sheet_name='Queries Correção', index=False)
            
            print(f"✅ Relatório Excel gerado: {arquivo}")
            
        except Exception as e:
            print(f"⚠️ Erro ao gerar Excel: {e}")
            # Se falhar, pelo menos o TXT foi gerado
        """Gera relatório em formato Excel"""
        with pd.ExcelWriter(arquivo, engine='openpyxl') as writer:
            # Aba de resumo
            df_resumo = pd.DataFrame([resumo])
            df_resumo.to_excel(writer, sheet_name='Resumo', index=False)
            
            # Aba para cada tabela fato com problemas
            for tabela, info in resultados.items():
                if info['status'] != 'VERIFICADO' or not info['verificacoes']:
                    continue
                
                # Criar DataFrame com as verificações
                dados_verificacao = []
                for v in info['verificacoes']:
                    dados_verificacao.append({
                        'Coluna FK': v['coluna_fk'],
                        'Tabela Dimensão': v['tabela_dimensao'],
                        'Status': v['status'],
                        'Total Registros': v['total_registros'],
                        'Valores Distintos': v['valores_distintos'],
                        'Valores Nulos': v['valores_nulos'],
                        'Valores Órfãos': v['valores_orfaos'],
                        '% Órfãos': f"{v['percentual_orfaos']:.2f}%"
                    })
                
                df_verificacao = pd.DataFrame(dados_verificacao)
                
                # Nome da aba (máximo 31 caracteres)
                nome_aba = tabela[:31]
                df_verificacao.to_excel(writer, sheet_name=nome_aba, index=False)
                
                # Formatar
                worksheet = writer.sheets[nome_aba]
                for column in worksheet.columns:
                    max_length = 0
                    column = [cell for cell in column]
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)
                    worksheet.column_dimensions[column[0].column_letter].width = adjusted_width
            
            # Aba com queries de correção
            if resumo['problemas_criticos'] > 0:
                queries_correcao = []
                for tabela, info in resultados.items():
                    if info['status'] != 'VERIFICADO':
                        continue
                    
                    for v in info['verificacoes']:
                        if v['status'] == 'ORFAOS_ENCONTRADOS' and v['valores_orfaos'] > 0:
                            query = f"""
-- Valores órfãos em {tabela}.{v['coluna_fk']}
SELECT DISTINCT {v['coluna_fk']}, COUNT(*) as qtd
FROM {tabela}
WHERE {v['coluna_fk']} NOT IN (
    SELECT {v['coluna_fk']} FROM {v['tabela_dimensao']}
)
GROUP BY {v['coluna_fk']}
ORDER BY COUNT(*) DESC;
"""
                            queries_correcao.append({
                                'Tabela': tabela,
                                'Problema': f"Órfãos em {v['coluna_fk']}",
                                'Query SQL': query.strip()
                            })
                
                if queries_correcao:
                    df_queries = pd.DataFrame(queries_correcao)
                    df_queries.to_excel(writer, sheet_name='Queries Correção', index=False)
        
        print(f"✅ Relatório Excel gerado: {arquivo}")
    
    def mostrar_orfaos_detalhados(self):
        """Mostra detalhes dos valores órfãos encontrados"""
        print("\n🔍 ANÁLISE DETALHADA DE VALORES ÓRFÃOS")
        print("="*80)
        
        if not self.db_path.exists():
            print(f"❌ Banco de dados não encontrado: {self.db_path}")
            return
        
        conn = duckdb.connect(str(self.db_path), read_only=True)
        
        try:
            # Verificar tabelas disponíveis
            tabelas_disponiveis = []
            for tabela in ['despesa_saldo', 'receita_saldo', 'despesa_lancamento', 'receita_lancamento']:
                if self.verificar_tabela_existe(conn, tabela):
                    total = conn.execute(f"SELECT COUNT(*) FROM {tabela}").fetchone()[0]
                    if total > 0:
                        tabelas_disponiveis.append(tabela)
                        print(f"[{len(tabelas_disponiveis)}] {tabela} ({total:,} registros)")
            
            if not tabelas_disponiveis:
                print("❌ Nenhuma tabela fato com dados encontrada!")
                return
            
            escolha = input("\nEscolha a tabela para analisar (número): ").strip()
            
            try:
                idx = int(escolha) - 1
                if 0 <= idx < len(tabelas_disponiveis):
                    tabela_escolhida = tabelas_disponiveis[idx]
                else:
                    print("❌ Opção inválida!")
                    return
            except:
                print("❌ Digite um número válido!")
                return
            
            print(f"\n📊 Analisando órfãos em: {tabela_escolhida}")
            print("-"*80)
            
            # Obter relacionamentos da tabela
            relacionamentos = self.relacionamentos.get(tabela_escolhida, {})
            
            # Verificar cada relacionamento
            orfaos_encontrados = []
            
            for coluna_fk, info_dim in relacionamentos.items():
                if not self.verificar_coluna_existe(conn, tabela_escolhida, coluna_fk):
                    continue
                
                if not self.verificar_tabela_existe(conn, info_dim['tabela']):
                    continue
                
                coluna_dim = info_dim.get('coluna', coluna_fk)
                if not self.verificar_coluna_existe(conn, info_dim['tabela'], coluna_dim):
                    continue
                
                # Buscar órfãos com tratamento de tipos
                # Usar CAST para garantir compatibilidade de tipos
                query_orfaos = f"""
                SELECT 
                    f.{coluna_fk}::VARCHAR as valor,
                    COUNT(*) as qtd_registros
                FROM {tabela_escolhida} f
                WHERE f.{coluna_fk} IS NOT NULL
                AND TRIM(f.{coluna_fk}::VARCHAR) != ''
                AND NOT EXISTS (
                    SELECT 1 
                    FROM {info_dim['tabela']} d 
                    WHERE TRIM(d.{coluna_dim}::VARCHAR) = TRIM(f.{coluna_fk}::VARCHAR)
                )
                GROUP BY f.{coluna_fk}
                ORDER BY COUNT(*) DESC
                """
                
                orfaos = conn.execute(query_orfaos).fetchall()
                
                if orfaos:
                    orfaos_encontrados.append({
                        'coluna': coluna_fk,
                        'dimensao': info_dim['tabela'],
                        'valores': orfaos
                    })
            
            if not orfaos_encontrados:
                print("✅ Nenhum valor órfão encontrado!")
                return
            
            # Mostrar órfãos encontrados
            for item in orfaos_encontrados:
                print(f"\n❌ ÓRFÃOS: {item['coluna']} -> {item['dimensao']}")
                print(f"   Total de valores órfãos distintos: {len(item['valores'])}")
                print(f"   Top 10 valores órfãos:")
                print(f"   {'Valor':<20} {'Quantidade':<15}")
                print(f"   {'-'*35}")
                
                for valor, qtd in item['valores'][:10]:
                    print(f"   {str(valor)[:20]:<20} {qtd:<15,}")
                
                if len(item['valores']) > 10:
                    print(f"   ... e mais {len(item['valores']) - 10} valores órfãos")
                
                # Opção de exportar
                resp = input(f"\n   Exportar lista completa para CSV? (s/N): ")
                if resp.lower() == 's':
                    arquivo_csv = self.relatorios_path / f"orfaos_{tabela_escolhida}_{item['coluna']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
                    df_orfaos = pd.DataFrame(item['valores'], columns=['Valor', 'Quantidade'])
                    df_orfaos.to_csv(arquivo_csv, index=False)
                    print(f"   ✅ Exportado para: {arquivo_csv}")
            
            # Gerar SQL de correção
            print("\n" + "="*80)
            resp = input("Gerar SQL para inserir valores faltantes nas dimensões? (s/N): ")
            if resp.lower() == 's':
                arquivo_sql = self.relatorios_path / f"correcao_orfaos_{tabela_escolhida}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
                
                with open(arquivo_sql, 'w', encoding='utf-8') as f:
                    f.write(f"-- Script de correção para valores órfãos em {tabela_escolhida}\n")
                    f.write(f"-- Gerado em: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}\n\n")
                    
                    for item in orfaos_encontrados:
                        f.write(f"\n-- Correção para {item['coluna']} -> {item['dimensao']}\n")
                        f.write(f"-- Total de valores órfãos: {len(item['valores'])}\n\n")
                        
                        # Gerar INSERT com valor padrão
                        coluna_dim = item['coluna']
                        f.write(f"-- Opção 1: Inserir registro 'DESCONHECIDO'\n")
                        f.write(f"INSERT INTO {item['dimensao']} ({coluna_dim}, no{coluna_dim})\n")
                        f.write(f"VALUES (0, 'DESCONHECIDO');\n\n")
                        
                        # Gerar INSERTs para cada valor órfão
                        f.write(f"-- Opção 2: Inserir todos os valores órfãos\n")
                        f.write(f"INSERT INTO {item['dimensao']} ({coluna_dim}, no{coluna_dim})\n")
                        f.write(f"VALUES\n")
                        
                        valores_sql = []
                        for valor, _ in item['valores'][:100]:  # Limitar a 100 para não ficar muito grande
                            valores_sql.append(f"  ({valor}, 'CADASTRAR DESCRIÇÃO')")
                        
                        f.write(",\n".join(valores_sql))
                        f.write(";\n\n")
                        
                        if len(item['valores']) > 100:
                            f.write(f"-- ... e mais {len(item['valores']) - 100} valores\n\n")
                
                print(f"✅ SQL de correção gerado: {arquivo_sql}")
            
        except Exception as e:
            print(f"❌ Erro: {e}")
            import traceback
            traceback.print_exc()
        finally:
            conn.close()

def main():
    """Função principal"""
    print("\n🔍 VERIFICADOR INTELIGENTE DE INTEGRIDADE")
    print("="*60)
    print("Este sistema vai:")
    print("  ✓ Verificar relacionamentos entre fatos e dimensões")
    print("  ✓ Descobrir automaticamente novos relacionamentos")
    print("  ✓ Identificar valores órfãos")
    print("  ✓ Gerar relatórios em TXT e Excel")
    print("  ✓ Sugerir correções")
    
    verificador = VerificadorIntegridadeInteligente()
    
    print("\nOpções:")
    print("[1] Verificação completa")
    print("[2] Verificar apenas despesa_saldo")
    print("[3] Verificar apenas receita_saldo")
    print("[4] Mostrar valores órfãos detalhados")
    print("[0] Sair")
    
    opcao = input("\nEscolha: ").strip()
    
    if opcao == '1':
        verificador.executar_verificacao()
    elif opcao == '2':
        # Modificar temporariamente para verificar só despesa_saldo
        verificador.executar_verificacao()  # TODO: implementar filtro
    elif opcao == '3':
        # Modificar temporariamente para verificar só receita_saldo
        verificador.executar_verificacao()  # TODO: implementar filtro
    elif opcao == '4':
        verificador.mostrar_orfaos_detalhados()
    else:
        print("Operação cancelada")

if __name__ == "__main__":
    main()