-- Secure customer QR token support.
-- Run this before deploying customer QR Edge Functions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.table_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_table_qr_tokens_table_active
  ON public.table_qr_tokens(table_id, is_active);

ALTER TABLE public.table_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rotate_table_qr_token(p_table_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  raw_token text;
BEGIN
  raw_token := encode(gen_random_bytes(32), 'hex');

  UPDATE public.table_qr_tokens
  SET is_active = false,
      rotated_at = now()
  WHERE table_id = p_table_id
    AND is_active = true;

  INSERT INTO public.table_qr_tokens (table_id, token_hash)
  VALUES (p_table_id, encode(digest(raw_token, 'sha256'), 'hex'));

  RETURN raw_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.active_table_qr_tokens()
RETURNS TABLE(table_id text, token_hash text, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT table_qr_tokens.table_id, table_qr_tokens.token_hash, table_qr_tokens.created_at
  FROM public.table_qr_tokens
  WHERE is_active = true
  ORDER BY table_id;
$$;

REVOKE ALL ON FUNCTION public.rotate_table_qr_token(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.active_table_qr_tokens() FROM PUBLIC, anon, authenticated;


