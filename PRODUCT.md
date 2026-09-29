# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Visitors to colimago.mx** (public landing, `/`): people who live in or are planning to visit the state of Colima, México, deciding whether the Colima Go app is worth installing. Spanish-speaking first.
- **The Colima Go administrator** (`/login` → `/dashboard.html`): a single Google account that reviews events detected from municipal Facebook pages, publishes them to the app, and maintains local places, the places directory and the Facebook pages directory.

## Product Purpose

Colima Go is a free mobile app (iOS and Android), described by its own copy as a social network for discovering and sharing the places and events of Colima. This repo (`colimago`) serves its public landing page and the private admin panel. The landing succeeds when a visitor installs the app from the App Store or Google Play.

## Positioning

Colima Go covers only Colima: its ten municipalities, its natural spots and its town festivals. Its event feed is built from what the municipal governments themselves publish, which the administrator reviews before it goes live.

## Operating Context

- The app's main sections (from the ColimaApp repo): Inicio (feed), Explorar (Fiestas Charrotaurinas / **Fiestas del Pueblo**, **Rincones Naturales** — ríos, playas, lagunas, montañas — Playas, **Municipios**), Calendario, Favoritos.
- Event types used by the panel: Deportivo, Social, Musical, Cultural, Ganadero, Religioso, Gastronómico, Otro.
- Local catalog categories: Ríos, Playas, Lagos/Lagunas, Montañas, Hoteles, Restaurantes.

## Capabilities and Constraints

- Express server (`server.js`) deployed on Vercel; `public/` is static, `views/dashboard.html` is session-gated. No build step, no front-end framework; the landing is a single static HTML file and must stay dependency-free.
- `/login` opens the Google sign-in modal on the landing page; the login is intentionally not advertised on the public page. This behavior and the Google client id must be preserved.
- The landing's content is static. There is no public events endpoint; the landing must not show dated events that can go stale.

## Brand Commitments

- Name: **Colima Go** (logo files in the ColimaApp data folder: `ColimaGo.png` / `ColimaGo.svg`). Footer credit: "© Colima 360".
- App store links: App Store `id1665801713`, Google Play `mx.shago.colimaapp`.
- Voice: warm, local, Spanish; the app's own copy speaks of "Rincones Naturales", "Fiestas del Pueblo", "Pueblo Mágico", "del volcán al mar".

## Evidence on Hand

- Real photography from the app (`~/Documents/React Native/ColimaApp/assets/images`): beaches (La Boquita, El Paraíso, Tecuanillo, El Real, Boca de Pascuales), rivers/balnearios (Los Amiales, El Sauce, Parajes, Agua Fría, Manantiales de Zacualpan), lagoons (La María, Carrizalillo, El Naranjal), mountains (El Terrero, La Gloria Escondida), festivals (cabalgata, mojigangos, La Petatera, recibimientos), plus municipality photos (`src/img/logos`) and hand-painted watercolor municipality illustrations (`src/img/avatars`). The user approved using all of it on the landing, excluding third-party event flyers.
- Real copy: the ten municipality descriptions and place descriptions in the app's `es.json` and `assets/catalog/catalog.json`.
- Absent, never to be fabricated: download counts, ratings, reviews/testimonials, user numbers, press, social media URLs, live event dates.

## Product Principles

1. Colima is the protagonist; the app is the way in.
2. Only what is real: real places, real photos, real municipal content.
3. Everything the landing shows has to exist in the app.
4. The admin path stays out of sight on the public page.

## Accessibility & Inclusion

Public page: WCAG AA contrast, full keyboard use, and support for reduced-motion preferences.
