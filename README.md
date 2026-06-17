# UpSay Chatbot — Assistente Inteligente com IA

Bot de suporte ao cliente da plataforma [UpSay](https://www.upsay.com.br), alimentado por IA (DeepSeek V4 Flash) com RAG sobre a documentação oficial.

## ✨ Funcionalidades

- 🤖 **Chatbot Inteligente**: Responde dúvidas sobre a plataforma UpSay
- 📚 **RAG (Retrieval-Augmented Generation)**: Busca na documentação oficial para respostas precisas
- 🧠 **Aprendizado Contínuo**: Aprende com perguntas frequentes dos clientes
- 📊 **Painel Admin**: Dashboard com estatísticas, perguntas recorrentes e gestão de conhecimento
- ⚡ **Otimizado**: Prefix caching da DeepSeek para economia de tokens
- 🔒 **Seguro**: Autenticação admin, RLS no Supabase

## 🚀 Stack

- **Next.js 15** (App Router + TypeScript)
- **DeepSeek V4 Flash** (LLM)
- **Supabase** (PostgreSQL + Full-Text Search)
- **Vercel** (Deploy)

## 📋 Setup

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
```bash
DEEPSEEK_API_KEY=sua_chave
NEXT_PUBLIC_SUPABASE_URL=sua_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_key
```

### 3. Criar banco de dados
Execute o SQL em `supabase/migration.sql` no Supabase SQL Editor.

### 4. Popular base de conhecimento
```bash
npx tsx scripts/seed-knowledge.ts
```

### 5. Rodar localmente
```bash
npm run dev
```

## 🔑 Acesso Admin

- **URL**: `/admin`
- **Email**: `admin@upsay.com.br`
- **Senha padrão**: `upsay2024`

## 📄 Licença

Proprietário — UpSay
