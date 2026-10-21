# BlinkBoard

**SaaS para creadores de contenido en X: muros de patrocinadores que se venden en USDC mediante Solana Actions y Blinks.**

## Qué hace

- El creador inicia sesión con X (Privy), crea un muro de 8x8 a partir de una plantilla y fija el precio diario de cada tier.
- El muro se comparte en X como Blink: los compradores eligen tamaño y duración y pagan sin salir del timeline.
- También se puede comprar un espacio concreto desde la web (`/walls/:id`).
- El pago va **directamente a la wallet del creador** (con comisión opcional para la plataforma en la misma transacción).
- El servidor verifica el pago en la blockchain antes de ocupar el espacio, y lo libera automáticamente cuando termina el periodo.

## Tiers y precios

| Tier | Tamaño | Créditos | Precio mínimo / día |
|------|--------|----------|---------------------|
| STANDARD | 1x1 | 1 | 10 USDC |
| GOLD | 2x2 | 4 | 30 USDC |
| PLATINUM | 3x3 | 9 | 70 USDC |
| VIP | 4x4 | 16 | 150 USDC |

Duración: 1 día (x1), 7 días (x5), 30 días (x15). El precio **siempre se calcula en el servidor** (`src/lib/pricing.ts`).

## Flujo de compra

```
1. POST /api/actions/blinkboard/:wallId/purchase
     -> reserva atómica del slot (5 min) + compra PENDING
     -> devuelve transacción sin firmar: memo + transferencias USDC
2. El comprador firma y envía la transacción
3. Confirmación (cualquiera de las dos vías, son idempotentes):
     a) El navegador llama a POST /api/purchase/confirm con la firma
     b) Helius llama a POST /api/webhooks/helius
   En ambos casos el servidor lee la tx de la blockchain y comprueba:
     memo = id de la compra, firmante = comprador, mint = USDC,
     importes recibidos por el creador y la tesorería
4. confirm_purchase() (SQL) ocupa el slot de forma atómica
5. release_expired_slots() libera reservas abandonadas y anuncios caducados
```

Si alguien paga tarde y el slot ya lo ocupó otra persona, la compra queda en `FAILED` con `failure_reason = SLOT_TAKEN_REFUND_REQUIRED` para reembolsarla manualmente.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Supabase Postgres (solo accesible desde el servidor con service role)
- Privy (login con X, verificación de sesión con `jose`)
- Solana web3.js + SPL Token (USDC), Solana Actions v2
- `next/og` para la imagen dinámica del muro
- Helius (RPC + webhooks), Vercel (hosting + cron)

## Puesta en marcha

1. `npm install`
2. Copia `.env.example` a `.env.local` y rellena las variables (todas están documentadas ahí).
3. Aplica las migraciones en orden en Supabase (SQL editor o `supabase db push`):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_functions.sql`
   - `supabase/migrations/003_secure_payments.sql`
4. En Helius crea un webhook sobre la wallet de tesorería o las wallets de creadores (tipo *enhanced* o *raw*) apuntando a `https://TU_DOMINIO/api/webhooks/helius` y pon `HELIUS_WEBHOOK_SECRET` en el campo **Auth Header**. Es opcional: la confirmación desde el navegador ya basta, el webhook cubre el caso de que el usuario cierre la pestaña.
5. `npm run dev`

Para probar en devnet usa `NEXT_PUBLIC_SOLANA_NETWORK=devnet` y consigue USDC de prueba en [faucet.circle.com](https://faucet.circle.com).

## API

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/auth/sync` | Privy | Sincroniza el usuario con datos verificados de Privy |
| GET | `/api/walls/mine` | Privy | Muros del creador |
| POST | `/api/walls/create` | Privy | Crea un muro y sus slots |
| GET | `/api/walls/:wallId` | — | Datos públicos del muro |
| GET | `/api/actions/blinkboard/:wallId` | — | Metadatos del Blink |
| POST | `/api/actions/blinkboard/:wallId/purchase` | Blink / Privy | Prepara la transacción de compra |
| GET | `/api/actions/blinkboard/:wallId/image.png` | — | Imagen dinámica del muro |
| POST | `/api/purchase/confirm` | — (verificación on-chain) | Confirma una compra |
| POST | `/api/webhooks/helius` | `HELIUS_WEBHOOK_SECRET` | Confirmación por webhook |
| GET | `/api/cron/release` | `CRON_SECRET` | Libera slots caducados (Vercel Cron) |
