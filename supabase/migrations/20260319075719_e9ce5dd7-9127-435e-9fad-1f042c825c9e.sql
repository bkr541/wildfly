
-- ══════════════════════════════════════════════════════════════
-- 1. Add stripe_price_id, is_active, billing_period to plans
-- ══════════════════════════════════════════════════════════════
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS billing_period text NOT NULL DEFAULT 'monthly';

-- ══════════════════════════════════════════════════════════════
-- 2. Create credit_packs table
-- ══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.credit_packs (
  id text PRIMARY KEY,
  name text NOT NULL,
  credits_amount integer NOT NULL,
  stripe_price_id text,
  price_usd numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Credit packs are publicly readable"
  ON public.credit_packs FOR SELECT USING (true);

CREATE POLICY "Credit packs insert blocked"
  ON public.credit_packs FOR INSERT WITH CHECK (false);

CREATE POLICY "Credit packs update blocked"
  ON public.credit_packs FOR UPDATE USING (false);

CREATE POLICY "Credit packs delete blocked"
  ON public.credit_packs FOR DELETE USING (false);

-- ══════════════════════════════════════════════════════════════
-- 3. Seed credit packs
-- ══════════════════════════════════════════════════════════════
INSERT INTO public.credit_packs (id, name, credits_amount, price_usd, display_order)
VALUES
  ('credit_pack_10',  '10 Credits',  10,  4.99, 1),
  ('credit_pack_25',  '25 Credits',  25, 10.99, 2),
  ('credit_pack_50',  '50 Credits',  50, 18.99, 3),
  ('credit_pack_100', '100 Credits', 100, 29.99, 4)
ON CONFLICT (id) DO NOTHING;
