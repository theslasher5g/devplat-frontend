# devplat — Frontend

Marketing-Website, Auth-Flow und Demo-Dashboard für devplat (Remote-Backend für
Testcontainers). React + Vite + TypeScript + Tailwind, komplett clientseitig mit
Mock-Daten — noch ohne echte API-Anbindung (kommt in Build-Schritt 3).

## Lokal entwickeln

```bash
corepack enable
pnpm install
pnpm dev
```

## Production-Build

```bash
pnpm run build     # tsc -b && vite build → dist/
pnpm run preview   # dist/ lokal testen
```

## Deployment (VPS)

Multi-Stage-Docker-Build (Node baut, nginx liefert aus):

```bash
docker build -t devplat-frontend .
docker run -p 8080:80 devplat-frontend   # lokaler Test
```

Für den echten Betrieb: als Service in die `docker-compose.yml` der Control Plane
einhängen (siehe `devplat-vps-setup.md`, Abschnitt 8) — Traefik übernimmt TLS und Routing
auf die Hauptdomain.

## Struktur

```
src/
├── App.tsx                    Router (einfache useState-basierte Seiten-Umschaltung)
├── components/site/
│   ├── Home.tsx                Landingpage
│   ├── Technik.tsx              "So funktioniert's"
│   ├── PreiseCompliance.tsx     Preise + Datenschutz & Recht
│   ├── Auth.tsx                 Login/Registrierung (Demo)
│   ├── Dashboard.tsx             Kunden-Dashboard (Demo, 8 Bereiche)
│   └── Shared.tsx               Nav, Footer, Logo, Terminal-Demo, gemeinsame Typen
├── lib/
│   ├── demo.ts                  Mock-Daten für das Dashboard
│   └── avv-data.ts              Base64-embedded DPA-PDF-Download
└── index.css                    Design-Tokens (Farben, Fonts, Animationen)
```

## Design-System

Dot-Matrix-Font (Doto) für Zahlen/Signatur-Elemente, Space Grotesk als Haupttypo,
JetBrains Mono für Code, Swiss-Red als einziger Akzent, Hairline-Borders. Marketing-Seiten
hell, Dashboard dunkel. Details siehe `/mnt/skills/public/frontend-design` (Anthropic
Frontend-Design-Skill).

## Bekannte Baustellen

- Alle Daten sind Mock-Daten (`src/lib/demo.ts`) — echte API-Anbindung folgt in
  Build-Schritt 3.
- Kein echter Client-seitiger Router (React Router o. Ä.) — Seitenwechsel läuft aktuell
  über simplen `useState`. Reicht für den Demo-Stand, sollte aber vor dem produktiven
  Einsatz durch echtes Routing ersetzt werden (Browser-Back-Button, direkte Links
  funktionieren sonst nicht).
