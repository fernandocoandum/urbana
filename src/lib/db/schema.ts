// DDL idempotente (só CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS), executado no cold
// start contra o banco real. Copiado verbatim do server.js legado.
export const SCHEMA_SQL = `
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          nome TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          senha TEXT NOT NULL,
          role TEXT DEFAULT 'morador',
          bairro TEXT DEFAULT '',
          criado_em TIMESTAMPTZ DEFAULT NOW(),
          termos_aceitos_em TIMESTAMPTZ,
          foto TEXT
        );
        CREATE TABLE IF NOT EXISTS ocorrencias (
          id TEXT PRIMARY KEY,
          protocolo TEXT UNIQUE NOT NULL,
          user_id TEXT NOT NULL,
          titulo TEXT NOT NULL,
          descricao TEXT DEFAULT '',
          categoria TEXT NOT NULL,
          endereco TEXT NOT NULL,
          bairro TEXT NOT NULL,
          referencia TEXT DEFAULT '',
          foto TEXT,
          status TEXT DEFAULT 'Recebida',
          criado_em TIMESTAMPTZ DEFAULT NOW(),
          atualizado_em TIMESTAMPTZ DEFAULT NOW(),
          historico JSONB DEFAULT '[]',
          mensagens JSONB DEFAULT '[]',
          lat DOUBLE PRECISION,
          lng DOUBLE PRECISION,
          apoios JSONB DEFAULT '[]',
          avaliacao JSONB,
          precisao_local TEXT DEFAULT 'manual',
          responsavel TEXT,
          setor TEXT,
          prazo TIMESTAMPTZ,
          evidencia_resolucao TEXT,
          pedidos_reabertura JSONB DEFAULT '[]',
          admin_nao_lido BOOLEAN DEFAULT false,
          cidadao_nao_lido BOOLEAN DEFAULT false
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW(),
          expira_em TIMESTAMPTZ
        );
        CREATE TABLE IF NOT EXISTS config (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chat_mensagens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          nome TEXT NOT NULL,
          texto TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS arquivos (
          id TEXT PRIMARY KEY,
          mime TEXT NOT NULL,
          dados TEXT NOT NULL,
          criado_em TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS termos_aceitos_em TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS foto TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expira_em TIMESTAMPTZ;
        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS apoios JSONB DEFAULT '[]';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS avaliacao JSONB;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS precisao_local TEXT DEFAULT 'manual';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS responsavel TEXT;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS setor TEXT;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS prazo TIMESTAMPTZ;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS evidencia_resolucao TEXT;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS pedidos_reabertura JSONB DEFAULT '[]';
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS admin_nao_lido BOOLEAN DEFAULT false;
        ALTER TABLE ocorrencias ADD COLUMN IF NOT EXISTS cidadao_nao_lido BOOLEAN DEFAULT false;
      `;

export const APOIOS_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS apoios_registro (
      ocorrencia_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      criado_em TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (ocorrencia_id, user_id)
    );
  `;
