# Stripe Webhook Deployment Notes

## JWT Verification

The `stripe-webhook` Edge Function **must be deployed with JWT verification disabled** (`verify_jwt = false`). This is configured in `supabase/config.toml` under `[functions.stripe-webhook]`.

Stripe webhooks are external server-to-server requests. Stripe signs each request with a Stripe signature header (`stripe-signature`) — it does **not** send a Supabase JWT. Disabling JWT verification ensures Stripe can reach the function so the handler can verify the Stripe signature and fulfill purchases.

## Webhook Security

Webhook security relies entirely on **Stripe signature verification** performed inside the function code:

- Every incoming request is validated with `stripe.webhooks.constructEventAsync(...)`.
- Requests missing or bearing an invalid `stripe-signature` header are rejected with a 400 response.
- No purchase fulfillment proceeds unless the Stripe signature is verified.

## Post-Deployment Testing

After each deployment of the `stripe-webhook` function, the Stripe webhook endpoint should be re-tested to confirm:

1. Stripe can successfully deliver events (no 401/403 rejections).
2. Signature verification still rejects invalid signatures.
3. Valid checkout session events are processed and credits are fulfilled.
