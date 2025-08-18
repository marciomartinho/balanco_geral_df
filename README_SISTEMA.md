📋 DOCUMENTAÇÃO DO SISTEMA - BALANÇO GERAL DF
README_SISTEMA.md
markdown# Sistema de Balanço Geral - Governo do Distrito Federal

## 📌 Visão Geral

Sistema web para acompanhamento da execução orçamentária das despesas do GDF, desenvolvido em Python (Flask) com banco de dados Oracle.

**Status:** ✅ Em produção (versão híbrida)  
**Última atualização:** Agosto/2025

## 🏗️ Arquitetura Atual (Híbrida)

O sistema está em processo de migração, funcionando em modo HÍBRIDO:
- **Backend:** Flask com APIs antiga e nova coexistindo
- **Frontend:** Templates HTML com JavaScript vanilla
- **Banco:** Oracle sem views (por restrição de privilégios)
- **Cache:** Sistema de cache em arquivo (.pkl)

## 📁 Estrutura de Pastas
balanco_geral_df/
├── app.py                    # Aplicação principal Flask (versão híbrida)
├── .env                      # Configurações de ambiente (DB_USER, DB_PASSWORD, etc)
│
├── backend/                  # NOVA estrutura (parcialmente implementada)
│   ├── api/                 # Endpoints API v1 (usando serviço antigo)
│   │   ├── despesas.py      # API REST v1 - /api/v1/despesas
│   │   └── docs.py          # Documentação Swagger
│   ├── servicos/            # Serviços novos (preparados mas não usados)
│   └── dados/               # Repositórios (preparados para views Oracle)
│
├── config/                   # Configurações do sistema
│   └── database.py          # ⚠️ CRÍTICO: Conexão com Oracle (NÃO DELETAR)
│
├── services/                 # Serviços ANTIGOS (ainda em uso)
│   └── despesa_orcamentaria_service.py  # ⚠️ CRÍTICO: Lógica principal (NÃO DELETAR)
│
├── queries/                  # Consultas SQL
│   └── despesa_orcamentaria.sql  # ⚠️ CRÍTICO: Query principal (NÃO DELETAR)
│
├── templates/                # Templates HTML
│   ├── index.html           # Página inicial
│   └── despesa_orcamentaria/
│       └── index.html       # Página principal de despesas
│
├── static/                   # Arquivos estáticos
│   ├── css/
│   │   └── despesa_orcamentaria.css  # Estilos principais
│   └── js/
│       └── despesa_orcamentaria/
│           └── main.js      # ⚠️ CRÍTICO: JavaScript principal (1300+ linhas)
│
├── cache/                    # Cache de dados
│   └── *.pkl                # Arquivos de cache (gerados automaticamente)
│
└── exports/                  # Exportações Excel/CSV
└── *.xlsx / *.csv       # Arquivos gerados

## 🔧 Como Funciona

### **1. Fluxo de Dados**
[Oracle DB] → [Query SQL] → [Python/Pandas] → [Cache] → [API] → [JavaScript] → [HTML]

1. **Busca no Banco:** Query complexa (`despesa_orcamentaria.sql`) traz ~100.000 registros
2. **Processamento Python:** Service agrupa e calcula totais usando Pandas
3. **Cache:** Salva resultado em arquivo .pkl (válido por 12h)
4. **API:** Retorna JSON para o frontend
5. **JavaScript:** Renderiza tabelas e gráficos
6. **HTML:** Exibe para o usuário

### **2. APIs Disponíveis**

#### **API Antiga (FUNCIONANDO)**
- `POST /despesa-orcamentaria/api/dados-completos` - Endpoint principal
- `GET /despesa-orcamentaria/api/ugs` - Lista UGs
- `POST /despesa-orcamentaria/api/cache/limpar` - Limpa cache

#### **API Nova v1 (HÍBRIDA - usa serviço antigo)**
- `GET /api/v1/despesas` - Lista despesas
- `GET /api/v1/health` - Health check
- `GET /api/v1/info` - Informações da API

### **3. Sistema de Cache**

- **Localização:** pasta `cache/`
- **Formato:** Pickle (.pkl)
- **Validade:** 12 horas
- **Tamanho:** ~50MB com dados completos
- **Limpeza:** Manual via interface ou API

### **4. Processamento de Dados**

O serviço `despesa_orcamentaria_service.py` faz:
1. Busca 2 anos de dados (atual + anterior)
2. Filtra por exercício, mês e UG
3. Agrupa por categoria (3, 4, 9) e grupo (31, 32, 33, 44, 45, 46)
4. Calcula totais e variações percentuais
5. Retorna estrutura JSON complexa

## ⚠️ Problemas Conhecidos

### **1. Sem Permissão para Views Oracle**
- **Problema:** Usuário sem privilégio CREATE VIEW (ORA-01031)
- **Solução Atual:** Python faz agregações (mais lento)
- **Solução Ideal:** DBA criar as views

### **2. JavaScript Monolítico**
- **Problema:** main.js com 1300+ linhas
- **Solução Parcial:** Módulos criados em `frontend/scripts/` mas não integrados
- **Estado:** Usando arquivo antigo

### **3. Python Processando Demais**
- **Problema:** Python fazendo groupby/sum que Oracle poderia fazer
- **Impacto:** Lentidão na primeira consulta (60s)
- **Solução:** Views Oracle (quando tiver permissão)

## 🚀 Como Executar

### **Desenvolvimento**
```bash
# Ativar ambiente virtual
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows

# Instalar dependências
pip install -r requirements.txt

# Configurar .env
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_DSN=servidor:porta/servico

# Executar
python app.py

# Acessar
http://localhost:5000
Produção
bash# Usar Gunicorn ou similar
gunicorn -w 4 -b 0.0.0.0:5000 app:app
📊 Dados Importantes
Estrutura de Categorias (hardcoded)
pythonESTRUTURA_CATEGORIAS = {
    '3': 'DESPESAS CORRENTES',
    '4': 'DESPESAS DE CAPITAL',
    '9': 'RESERVA DE CONTINGÊNCIA'
}
Grupos de Despesa

Categoria 3: Grupos 1, 2, 3
Categoria 4: Grupos 4, 5, 6
Categoria 9: Sem grupos

Contas Contábeis Principais

522110000-522119999: Dotação Inicial
522120000-522129999: Dotação Adicional
622130000-622139999: Despesa Empenhada
622920104: Despesa Paga

🔄 Estado da Migração
Concluído ✅

Nova estrutura de pastas criada
API v1 funcionando (modo híbrido)
Módulos JavaScript escritos (não integrados)

Pendente ⏳

 Criar views no Oracle (sem permissão)
 Migrar JavaScript para módulos
 Substituir serviço antigo pelo novo
 Implementar repositório com views
 Remover dependência do Pandas

Cancelado ❌

Views Oracle (falta permissão)

📝 Notas para Próximas Conversas

Sistema FUNCIONA mas é lento na primeira consulta
NÃO tem permissão para criar views no Oracle
Cache é ESSENCIAL - sem ele, cada consulta demora 60s
Código antigo e novo coexistem - modo híbrido
JavaScript antigo ainda em uso (main.js monolítico)
Pandas processa o que Oracle deveria fazer

🆘 Comandos Úteis
bash# Limpar cache
rm -rf cache/*.pkl

# Ver logs
tail -f app.log

# Testar conexão Oracle
python -c "from config.database import get_db_manager; db = get_db_manager(); print(db.test_connection())"

# Ver tamanho do cache
du -sh cache/

# Contar registros no banco
python -c "from services.despesa_orcamentaria_service import DespesaOrcamentariaService; s = DespesaOrcamentariaService(); df = s._buscar_dados_completos(); print(f'Total: {len(df)} registros')"
👥 Contatos

Desenvolvimento: [seu email]
DBA Oracle: [contato DBA para pedir CREATE VIEW]
Repositório: [link do git se houver]


Última atualização: 17/08/2025
Versão: 2.0 (Híbrida)
Status: ✅ Produção