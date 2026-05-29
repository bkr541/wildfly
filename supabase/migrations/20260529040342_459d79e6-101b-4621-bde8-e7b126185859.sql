-- Atomic Stripe credit-pack fulfillment

-- 1) Unique constraint protecting against double-credit at the DB level
--    A given (source_type, source_id) can only be inserted once when source_id is set.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_credit_transactions_source
  ON public.credit_transactions (source_type, source_id)
  WHERE source_id IS NOT NULL;

-- 2) RPC: fulfill_stripe_credit_pack
--    Performs idempotent, atomic fulfillment: locks wallet row, inserts ledger row,
--    and increments purchased_balance in a single transaction.
CREATE OR REPLACE FUNCTION public.fulfill_stripe_credit_pack(
  p_user_id uuid,
  p_stripe_session_id text,
  p_credits integer,
  p_pack_id text,
  p_stripe_customer_id text,
  p_stripe_event_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id uuid;
  v_balance_before integer;
  v_balance_after integer;
BEGIN
  IF p_user_id IS NULL OR p_stripe_session_id IS NULL OR p_credits IS NULL OR p_credits <= 0 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  -- Idempotency: if this stripe session already produced a ledger row, no-op.
  SELECT id INTO v_existing_id
  FROM public.credit_transactions
  WHERE source_type = 'stripe_checkout'
    AND source_id = p_stripe_session_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_fulfilled', 'transaction_id', v_existing_id);
  END IF;

  -- Ensure wallet row exists, then lock it.
  INSERT INTO public.user_credit_wallet (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT purchased_balance INTO v_balance_before
  FROM public.user_credit_wallet
  WHERE user_id = p_user_id
  FOR UPDATE;

  v_balance_after := v_balance_before + p_credits;

  UPDATE public.user_credit_wallet
  SET purchased_balance = v_balance_after,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Insert ledger. Unique index guarantees exactly-once even on race.
  BEGIN
    INSERT INTO public.credit_transactions (
      user_id, transaction_type, source_type, source_id,
      amount, bucket, balance_before, balance_after, metadata
    ) VALUES (
      p_user_id, 'purchase_credit', 'stripe_checkout', p_stripe_session_id,
      p_credits, 'purchased', v_balance_before, v_balance_after,
      jsonb_build_object(
        'pack_type', p_pack_id,
        'stripe_session_id', p_stripe_session_id,
        'stripe_customer_id', p_stripe_customer_id,
        'stripe_event_id', p_stripe_event_id
      )
    );
  EXCEPTION WHEN unique_violation THEN
    -- Concurrent fulfillment won the race; roll back our wallet bump.
    RAISE EXCEPTION 'already_fulfilled_race' USING ERRCODE = '40001';
  END;

  RETURN jsonb_build_object(
    'status', 'fulfilled',
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_stripe_credit_pack(uuid, text, integer, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_stripe_credit_pack(uuid, text, integer, text, text, text) TO service_role;