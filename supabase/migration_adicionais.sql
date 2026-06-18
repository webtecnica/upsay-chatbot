-- UpSay Chatbot - ADICIONAIS (Itens Adicionais)
-- Execute este SQL no Supabase SQL Editor

-- ============================================
-- 1. TABELA additional_items
-- ============================================

CREATE TABLE IF NOT EXISTS additional_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('incidentes', 'avisos', 'melhorias', 'recomendacoes')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  expires_at TIMESTAMPTZ,          -- Para incidentes: quando o alerta expira
  is_active BOOLEAN DEFAULT true,  -- Flag para desativar sem deletar
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_additional_category ON additional_items(category);
CREATE INDEX IF NOT EXISTS idx_additional_active ON additional_items(is_active);
CREATE INDEX IF NOT EXISTS idx_additional_expires ON additional_items(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================
-- 3. RLS (Row Level Security)
-- ============================================

ALTER TABLE additional_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON additional_items FOR ALL USING (true) WITH CHECK (true);
