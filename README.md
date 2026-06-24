# F1 Live Track

Dashboard full-stack Next.js per visualizzare una sessione Formula 1 con dati OpenF1, mappa SVG ricostruita dalle coordinate auto e classifica laterale con distacchi.

## Stack

- Next.js App Router
- TypeScript strict
- React
- Tailwind CSS
- Route Handlers server-side verso OpenF1
- Nessun database

## Avvio

```bash
npm install
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000).

Modalita demo storica:

```bash
open "http://localhost:3000?demo=true"
```

## Variabili ambiente

Copia `.env.example` in `.env.local` se hai token OpenF1 o Google Maps:

```bash
OPENF1_API_TOKEN=...
GOOGLE_MAPS_API_KEY=...
```

Il token e' usato solo lato server nelle route `/api/f1/*` e non viene esposto al client. OpenF1 indica che i dati storici sono generalmente disponibili senza autenticazione, mentre i dati live possono richiedere subscription.

`GOOGLE_MAPS_API_KEY` e' opzionale: abilita il layer Google Maps Static nello sfondo tracciato.

## Deploy su Render

Questa app usa route API server-side, quindi su Render va pubblicata come **Web Service Node**, non come Static Site.

### Deploy con Blueprint

1. Porta il progetto in un repository GitHub/GitLab/Bitbucket.
2. Committa anche `render.yaml`.
3. Nel dashboard Render scegli **New > Blueprint**.
4. Collega il repository e conferma il file `render.yaml`.
5. Inserisci le variabili quando Render le chiede:
   - `OPENF1_API_TOKEN` opzionale, consigliato per dati live
   - `GOOGLE_MAPS_API_KEY` opzionale, solo per Google Maps

Il Blueprint usa:

- runtime Node
- piano `free`
- build command `npm ci && npm run build`
- start command `npm start`
- health check `/api/health`
- Node `20.20.2`
- telemetry Next disabilitata con `NEXT_TELEMETRY_DISABLED=1`

### Deploy manuale

In alternativa crea **New > Web Service** su Render con questi valori:

- Language/Runtime: `Node`
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Environment Variable: `NODE_VERSION=20.20.2`

Se usi il piano gratuito, il servizio puo andare in sleep dopo inattivita e impiegare qualche secondo a riattivarsi.

## API interne

- `GET /api/f1/session`
- `GET /api/f1/meeting`
- `GET /api/f1/drivers`
- `GET /api/f1/location`
- `GET /api/f1/positions`
- `GET /api/f1/intervals`
- `GET /api/f1/standings`

Tutte supportano:

- `session_key`, default `latest`
- `demo=true`, che usa la sessione storica OpenF1 `9165`
- finestre temporali leggere per location e intervals
- timeout, gestione errori e cache in memoria

## Note dati

`/location` e `/intervals` possono essere molto grandi senza filtri temporali. Le route applicano `date>=` e `date<=` per ridurre payload e rischio rate limit. Se non c'e' una sessione live nel giorno corrente, la dashboard mostra l'ultimo evento disponibile in replay e offre anche la demo storica.

Il progetto non usa loghi ufficiali F1 e non e' associato a Formula 1.
