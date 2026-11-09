CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_claims (
  claim_key text PRIMARY KEY,
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_inbound_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_inbound_claims FROM PUBLIC, anon, authenticated;
GRANT INSERT ON TABLE public.whatsapp_inbound_claims TO service_role;

NOTIFY pgrst, 'reload schema';
