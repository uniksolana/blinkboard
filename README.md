# BlinkBoard MVP

**SaaS platform para creadores de contenido en X que permite monetizar muros publicitarios mediante Solana Actions & Blinks.**

## 🎯 Descripción

BlinkBoard permite a los creadores:
- ✅ Crear muros de patrocinadores digitales
- ✅ Vender espacios publicitarios (slots) mediante USDC en Solana
- ✅ Actualizar automáticamente el muro tras cada compra
- ✅ Renderizar dinámicamente dentro de un Blink

## ⚡ Características MVP

### Gestión de Muros
- Registro de creadores mediante X (OAuth)
- Creación rápida de muros (< 2 minutos)
- 4 plantillas predefinidas + modo híbrido
- Algoritmo determinístico de packing de slots

### Sistema de Compra
- Compra de slots en < 30 segundos
- Pagos exclusivamente en USDC SPL
- Reserva temporal (5 minutos máximo)
- Confirmación en blockchain < 5 segundos tras webhook

### Duración de Slots
- **DAILY**: 1 día
- **WEEKLY**: 7 días  
- **MONTHLY**: 30 días

### Tiers de Slots
| Tier | Tamaño | Créditos | Precio Mínimo |
|------|--------|----------|---------------|
| STANDARD | 1x1 | 1 | 10 USDC |
| GOLD | 2x2 | 4 | 30 USDC |
| PLATINUM | 3x3 | 9 | 70 USDC |
| VIP | 4x4 | 16 | Configurable |

### Plantillas de Muros
| Plantilla | Slots | Tamaño | Tier |
|-----------|-------|--------|------|
| EXCLUSIVE | 1 | 8x8 | VIP |
| GRANDE | 4 | 4x4 | VIP |
| MEDIANA | 16 | 2x2 | GOLD |
| COMUNITARIA | 64 | 1x1 | STANDARD |
| HYBRID | Variable | - | Mix |

## 🛠️ Stack Tecnológico

**Frontend:**
- Next.js 15 (App Router)
- TypeScript
- TailwindCSS + shadcn/ui

**Backend:**
- Next.js API Routes
- Vercel (deployment)

**Base de Datos:**
- Supabase PostgreSQL
- Row Level Security (RLS)

**Blockchain:**
- Solana
- Solana Actions & Blinks
- SPL Token (USDC)
- Helius RPC + Webhooks

**Imágenes Dinámicas:**
- Satori + Resvg

**Autenticación:**
- Auth0
- Login con X

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── actions/blinkboard/[wallId]/
│   │   │   ├── route.ts                    # GET Blink metadata
│   │   │   ├── image/route.ts              # GET dynamic image
│   │   │   └── purchase/route.ts           # POST USDC transaction
│   │   ├── walls/create/route.ts           # POST wall creation
│   │   └── webhooks/helius/route.ts        # POST blockchain webhook
│   └── (dashboard)                         # Future: Dashboard UI
├── lib/
│   ├── algorithms/
│   │   └── packing.ts                      # Deterministic slot placement
│   ├── api/
│   │   ├── validation.ts                   # Zod schemas
│   │   └── errors.ts                       # Error handling
│   ├── image/
│   │   └── generator.ts                    # Dynamic image generation
│   ├── solana/
│   │   ├── actions.ts                      # Transaction logic
│   │   └── constants.ts                    # Chain constants
│   ├── supabase/
│   │   ├── client.ts                       # Browser client
│   │   ├── server.ts                       # Server client
│   │   └── database.types.ts               # Generated types
│   └── types/
│       └── index.ts                        # TypeScript interfaces
├── middleware.ts                           # Auth0 protection
└── components/                             # React components (TBD)

supabase/
└── migrations/
    └── 001_initial_schema.sql              # DB schema + RLS
```

## 🚀 Configuración Inicial

### Prerequisites
- Node.js 20+
- npm o pnpm
- Cuenta Supabase
- Proyecto Auth0
- Billetera Solana (devnet/mainnet)
- API key Helius

### Variables de Entorno

Copia `.env.example` a `.env.local`:

```bash
cp .env.example .env.local
```

Completa las variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Auth0
AUTH0_SECRET=your_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL=https://rpc.helius.xyz
HELIUS_API_KEY=your_helius_key
NEXT_PUBLIC_SOLANA_NETWORK=devnet
SOLANA_TREASURY_WALLET=your_treasury_address
USDC_MINT_ADDRESS=EPjFWaJHqjZjqjZjqjZjqjZjqjZjqjZjqjZjqjZjqjZj

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
IMAGE_CACHE_TTL=300
```

### Instalación & Configuración

```bash
# 1. Instalar dependencias
npm install

# 2. Crear tablas en Supabase
npm run db:push

# 3. Ejecutar servidor de desarrollo
npm run dev
```

La aplicación estará disponible en `http://localhost:3000`

## 📡 Endpoints API

### Blinks (Solana Actions)

**GET** `/api/actions/blinkboard/[wallId]`
- Retorna metadata del Blink
- Datos actualizados en tiempo real

**GET** `/api/actions/blinkboard/[wallId]/image`
- Genera imagen PNG dinámica del muro
- Cache invalidable (5 min por defecto)

**POST** `/api/actions/blinkboard/[wallId]/purchase`
- Construye transacción USDC
- Crea registro de compra (PENDING)
- Retorna tx serializada en base64

### Gestión de Muros

**POST** `/api/walls/create`
- Crea nuevo muro con packing de slots
- Valida suma de créditos = 64

### Webhooks

**POST** `/api/webhooks/helius`
- Valida transacciones en blockchain
- Confirma compras
- Actualiza estado de slots

## 🔐 Algoritmo de Packing

El algoritmo determinístico garantiza:
- ✅ Suma exacta de 64 créditos
- ✅ Sin solapamientos
- ✅ Sin huecos vacíos
- ✅ Posiciones consistentes

**Implementación**: Greedy por tamaño (mayor→menor), row-major ordering.

## 🔒 Seguridad

- ✅ Row Level Security (RLS) en Supabase
- ✅ Validación en backend
- ✅ Validación blockchain de transacciones
- ✅ Protección contra double-spending
- ✅ Expiración automática de reservas (5 min)
- ✅ Auth0 middleware en rutas protegidas

## 🌐 Deployment

La aplicación está configurada para **Vercel**:

```bash
# Deploy automático al push a main
git push origin main
```

Configura estas variables en Vercel:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH0_*` (todas las variables Auth0)
- `SOLANA_*` y `HELIUS_*`
- `NEXT_PUBLIC_APP_URL`

## 🚧 Roadmap Post-MVP

- [ ] Comisión de plataforma (8%)
- [ ] Dashboard de creador
- [ ] Analytics y reportes
- [ ] Custom branding
- [ ] Multi-moneda
- [ ] Admin panel

## 🤝 Contribuir

1. Fork el repositorio
2. Crea una rama: `git checkout -b feature/my-feature`
3. Commit: `git commit -am 'Add feature'`
4. Push: `git push origin feature/my-feature`
5. Open Pull Request

## 📄 Licencia

MIT

## 📧 Soporte

- Email: support@blinkboard.xyz
- X: @blinkboard_xyz

---

**Construido con ❤️ por el equipo de Unik Solana**
