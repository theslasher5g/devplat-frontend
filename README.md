# devplat — Frontend

Marketing-Website, Auth-Flow und Kunden-Dashboard für devplat (Remote-Backend für
Testcontainers). React + Vite + TypeScript + Tailwind + React Router, angebunden an die
Control-Plane-API (`devplat-backend`, produktiv `api.devplat.ch`).

## Lokal entwickeln

```bash
corepack enable
pnpm install
pnpm dev            # erwartet die API auf http://localhost:3000
```

Andere API-Adresse: `VITE_API_URL=http://localhost:3100 pnpm dev` (siehe `.env.example`).

## Production-Build

```bash
pnpm run build     # tsc -b && vite build → dist/
pnpm run preview   # dist/ lokal testen
```

## Deployment (VPS)

Multi-Stage-Docker-Build (Node baut, nginx liefert aus). Die API-Basis-URL wird beim
Build eingebrannt (Default: `https://api.devplat.ch`):

```bash
docker build -t devplat-frontend .                                  # Produktion
docker build --build-arg VITE_API_URL=http://localhost:3000 -t devplat-frontend .  # lokal
```

Für den echten Betrieb: als Service in die `docker-compose.yml` der Control Plane
einhängen (siehe `devplat-vps-setup.md`, Abschnitt 8) — Traefik übernimmt TLS und Routing
auf die Hauptdomain.

## Routen

```
/                    Landingpage
/how-it-works        "So funktioniert's"
/pricing             Preise
/legal               Datenschutz & Recht
/auth                Login / Registrierung / Passwort vergessen
/verify-email        E-Mail-Bestätigung (Link aus der Mail)
/reset-password      Neues Passwort setzen (Link aus der Mail)
/invite              Team-Einladung annehmen (Link aus der Mail)
/app · /app/:view    Dashboard (geschützt) — overview/runs/pipelines/cache/tokens/billing/team/settings
/admin               Plattform-Admin-Dashboard (geschützt, nur is_platform_admin)
```

## Struktur

```
src/
├── App.tsx                    React-Router-Setup + Page→Pfad-Adapter (useGo)
├── components/site/
│   ├── Home.tsx                Landingpage
│   ├── Technik.tsx              "So funktioniert's"
│   ├── PreiseCompliance.tsx     Preise + Datenschutz & Recht
│   ├── Auth.tsx                 Login/Registrierung/Reset/Verify/Invite (echte API)
│   ├── Dashboard.tsx             Kunden-Dashboard — Tokens/Team/Billing/Settings echt,
│   │                             Runs/Cache/Overview-Charts noch Sample-Daten (Data Plane fehlt)
│   ├── Admin.tsx                Plattform-Admin: Host-Auslastung, Abonnenten, Fehlerrate
│   └── Shared.tsx               Nav, Footer, Logo, Terminal-Demo, gemeinsame Typen
├── lib/
│   ├── api.ts                   Fetch-Client (VITE_API_URL) + API-Response-Typen
│   ├── auth.tsx                 AuthProvider (/auth/me), RequireAuth-Guard
│   ├── demo.ts                  Sample-Daten für noch nicht angebundene Bereiche
│   └── avv-data.ts              Base64-embedded DPA-PDF-Download
└── index.css                    Design-Tokens (Farben, Fonts, Animationen)
```

## Design-System

Dot-Matrix-Font (Doto) für Zahlen/Signatur-Elemente, Space Grotesk als Haupttypo,
JetBrains Mono für Code, Swiss-Red als einziger Akzent, Hairline-Borders. Marketing-Seiten
hell, Dashboard dunkel.

## Bekannte Baustellen

- Testläufe, Image-Cache und die Overview-Charts zeigen weiter Sample-Daten (im UI
  entsprechend markiert) — echte Daten gibt es erst mit der Data Plane
  (Firecracker-Scheduler, eigener Auftrag).
- Session läuft über ein httpOnly-Cookie der API (`.devplat.ch`); lokal funktioniert das
  über `localhost` ohne weitere Konfiguration.
