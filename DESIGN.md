---
name: Colima Go
description: Noche de feria. The public landing is a walk down a Colima fair street at night, lit by a string of bulbs.
colors:
  suelo: "#0e1119"
  suelo-2: "#141926"
  suelo-3: "#1b2233"
  tinta: "#f2f1ee"
  tinta-suave: "#bfc3cd"
  tinta-tenue: "#8f96a6"
  foco: "#ffc347"
  foco-hondo: "#e9a318"
  foco-hover: "#ffd06b"
  sobre-foco: "#151822"
  lona: "#2c56a8"
  lona-hondo: "#1e3a6e"
  bandera: "#bf3828"
  cable: "#3b4254"
  vidrio: "#2a3040"
  linea: "rgba(242,241,238,0.12)"
  franja-fiestas: "#090b12"
  letra-tabla: "#f6f5f1"
  filamento: "#ffe29a"
  sombra-rotulo-foto: "rgba(0,0,0,0.35)"
  dia-suelo: "#f4f4f1"
  dia-suelo-2: "#eaebe7"
  dia-suelo-3: "#dfe1dc"
  dia-tinta: "#141824"
  dia-tinta-suave: "#3f4554"
  dia-tinta-tenue: "#5b6272"
  dia-foco: "#f7b52a"
  dia-foco-hondo: "#d99612"
  dia-foco-hover: "#ffc13f"
  dia-lona: "#1e3a6e"
  dia-lona-hondo: "#152a52"
  dia-bandera: "#b8321f"
  dia-cable: "#2a2f3c"
  dia-vidrio: "#fbfbfa"
  dia-linea: "rgba(20,24,36,0.14)"
typography:
  display:
    fontFamily: "Shrikhand, Barlow, serif"
    fontSize: "clamp(46px, 7.4vw, 112px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.005em"
  display-pausa:
    fontFamily: "Shrikhand, Barlow, serif"
    fontSize: "clamp(48px, 9vw, 148px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.005em"
  display-cierre:
    fontFamily: "Shrikhand, Barlow, serif"
    fontSize: "clamp(42px, 6.4vw, 96px)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "-0.005em"
  headline-letrero:
    fontFamily: "Shrikhand, Barlow, serif"
    fontSize: "clamp(34px, 4.4vw, 64px)"
    fontWeight: 400
    lineHeight: 0.98
  title-rotulo:
    fontFamily: "Shrikhand, serif"
    fontSize: "clamp(32px, 4vw, 52px)"
    fontWeight: 400
    lineHeight: 1
  title-calendario:
    fontFamily: "Shrikhand, serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.05
  title-platillo:
    fontFamily: "Shrikhand, serif"
    fontSize: "clamp(22px, 2.4vw, 32px)"
    fontWeight: 400
    lineHeight: 1.1
  title-tabla-portada:
    fontFamily: "Shrikhand, serif"
    fontSize: "clamp(15px, 1.45vw, 21px)"
    fontWeight: 400
    lineHeight: 1.05
  wordmark:
    fontFamily: "Shrikhand, serif"
    fontSize: "21px"
    fontWeight: 400
    lineHeight: 1
  title-tablero:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(26px, 2.6vw, 34px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "0.01em"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  body-compacto:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16.5px"
    fontWeight: 400
    lineHeight: 1.55
  body-dato:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  body-pequeno:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "15.5px"
    fontWeight: 400
    lineHeight: 1.55
  nota:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.55
  body-cierre:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.55
  body-entrada:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(17px, 1.5vw, 20px)"
    fontWeight: 400
    lineHeight: 1.55
  label-tablilla:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    letterSpacing: "0.06em"
  label-nav:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    letterSpacing: "0.03em"
  label-chip:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.04em"
  label-boton-sub:
    fontFamily: "Barlow, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.1
  label-boton:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.03em"
rounded:
  casquillo: "1px"
  subrayado: "2px"
  tabla: "6px"
  control: "8px"
  marco: "10px"
  modal: "18px"
  pastilla: "999px"
spacing:
  gutter: "20px"
  gutter-movil: "16px"
  gap-tira: "22px"
  gap-portada: "40px"
  gap-letrero: "56px"
  distrito-arriba: "40px"
  distrito-abajo: "120px"
  distrito-abajo-movil: "88px"
components:
  button-pintado:
    backgroundColor: "{colors.foco}"
    textColor: "{colors.sobre-foco}"
    typography: "{typography.label-boton}"
    padding: "14px 26px 13px"
  button-pintado-hover:
    backgroundColor: "{colors.foco-hover}"
    textColor: "{colors.sobre-foco}"
  letrero-colgante-lona:
    backgroundColor: "{colors.lona}"
    textColor: "{colors.letra-tabla}"
    typography: "{typography.headline-letrero}"
    rounded: "{rounded.tabla}"
    padding: ".2em .42em .26em"
  letrero-colgante-bandera:
    backgroundColor: "{colors.bandera}"
    textColor: "{colors.letra-tabla}"
    typography: "{typography.headline-letrero}"
    rounded: "{rounded.tabla}"
    padding: ".2em .42em .26em"
  tabla-portada:
    backgroundColor: "{colors.lona-hondo}"
    rounded: "{rounded.tabla}"
    width: "31%"
  tabla-nombre:
    backgroundColor: "{colors.lona}"
    textColor: "{colors.letra-tabla}"
    padding: "11px 8px 12px"
  pestana:
    backgroundColor: "transparent"
    textColor: "{colors.tinta-suave}"
    rounded: "{rounded.pastilla}"
    padding: "10px 20px"
  pestana-activa:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.suelo}"
    rounded: "{rounded.pastilla}"
  nav-distrito:
    textColor: "{colors.tinta-suave}"
    rounded: "{rounded.pastilla}"
    padding: "8px 12px"
  nav-distrito-hover:
    backgroundColor: "{colors.suelo-3}"
    textColor: "{colors.tinta}"
  modal-login:
    backgroundColor: "{colors.suelo-2}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.modal}"
    padding: "30px 28px 28px"
    width: "380px"
---

# Design System: Colima Go

## Overview

**Creative North Star: "Noche de feria"**

The public landing of Colima Go is a walk down a Colima fair street at night. A catenary wire of bulbs is the page's thread: it sags across the top of the first viewport and returns at the head of every district (Playas, Rincones Naturales, Fiestas del Pueblo, Sabores, Municipios). Each district title is a hand-lettered sign board hung from that wire, and the app's real photographs are the stalls. The ground is wet-asphalt indigo-black with a faint fixed grain; light comes only from the bulbs and from the saffron paint of the store buttons.

By day (light theme) the same street is whitewashed cal: the bulbs are unlit glass, the grain almost vanishes, and the awning inks (lona blue, banner red) carry the color. The theme follows the system preference unless the visitor flips the bulb switch in the bar, which is remembered (`localStorage` key `colimago-tema`, values `claro` / `oscuro`).

Density is generous and editorial: large painted display type, long district sections (120px bottom padding), photos with room around them. Motion is one orchestrated idea (bulbs light and content rises as a district enters the viewport) plus small physical gestures (boards swing, painted buttons tilt).

**Scope boundary.** This world governs only the public landing (`/`, `public/index.html`) and the `/login` Google modal it hosts. The private admin panel (`views/dashboard.html`) is a separate, pre-existing Operate surface with its own incumbent look (warm off-white ground, teal sidebar, coral accents, system font stack). It is not part of this world: do not restyle the dashboard with feria tokens, and do not bring dashboard styling into the landing.

**Key Characteristics:**
- Night ground, bulb light; saffron is light and the primary action, never decoration.
- Signs are painted boards hung on strings from a bulb wire, slightly rotated.
- Three voices of type: Shrikhand for painted signs, Barlow Condensed for board labels, Barlow for reading.
- Real photos of Colima in 10px-rounded frames; municipality illustrations in round medallions.
- Two themes from one token set: noche (default dark) and día (cal, unlit glass).

## Colors

A night palette: indigo-black asphalt, steam-white text, one warm light source (bulb saffron) and two awning inks (lona blue, banner red). All values live as CSS custom properties on `:root`; the día theme redefines the same properties (keys prefixed `dia-` in the frontmatter), applied both by `[data-tema="claro"]` and by `prefers-color-scheme: light` when no dark choice is stored.

### Primary
- **Bulb Saffron** (foco): the lit bulbs, the painted store and download buttons, focus rings, text selection, the active-nav underline and the selected-beach dot. By day it deepens slightly (dia-foco) and stays the button paint. Hover lightens the paint (foco-hover / dia-foco-hover).
- **Saffron Accent Text** (the `--acento-texto` role): by night it equals Bulb Saffron and colors the second line of the hero H1, "Go" in the wordmark, the selected beach name and the municipality nickname. By day it switches to Banner Red (dia-bandera) because saffron on cal fails contrast.

### Secondary
- **Lona Blue** (lona; by day the deeper dia-lona): the awning ink for sign boards and hero board name strips. Lona Deep (lona-hondo) backs the hero board faces while photos load. By day the Fiestas band is painted in dia-lona.

### Tertiary
- **Banner Red** (bandera / dia-bandera): the second sign ink (Playas, Fiestas del Pueblo, Municipios letreros; two hero board strips) and the tint of the login error box (16% fill, 50% border).

### Neutral
- **Wet Asphalt** (suelo / dia-suelo "Cal"): page ground. suelo-2 is the modal surface; suelo-3 is hover wash and photo-frame placeholder.
- **Steam** (tinta / dia-tinta): primary text. tinta-suave for lead and descriptive copy; tinta-tenue for captions, municipality labels and footer.
- **Wire** (cable / dia-cable): the bulb wire, board strings, bulb sockets, scrollbar thumb.
- **Glass** (vidrio / dia-vidrio): an unlit bulb.
- **Hairline** (linea / dia-linea): rules between beaches, menu rows, bar border on scroll, tab outlines, footer rule.
- **Fiesta Night** (franja-fiestas): the darker full-bleed band behind Fiestas del Pueblo at night.
- **Sign Letter White** (letra-tabla): lettering on lona and bandera boards in both themes.
- **Filament** (filamento): the pale rim of a lit bulb, night only; never used outside the lit bulb.
- **Photo Legibility Shade** (sombra-rotulo-foto): the soft text shadow under Shrikhand set directly on a photograph (the volcano pause), together with the bottom scrim.

### Named Rules
**The Only Light Rule.** Saffron means light or the one action (install the app). It paints bulbs, store buttons, focus and selection, and never a background panel or a district sign.

**The Awning Ink Rule.** District sign boards are painted only in Lona Blue or Banner Red, alternating down the page. The single saffron name strip on the hero board rack (Fiestas del Pueblo) is the only board that borrows the bulb color.

**The Day Accent Swap Rule.** Anything that uses saffron as text by night uses Banner Red by day; saffron as paint (buttons) stays saffron in both themes.

## Typography

**Display Font:** Shrikhand (fallback Barlow, serif)
**Label Font:** Barlow Condensed 500/600/700 (fallback Barlow, sans-serif)
**Body Font:** Barlow 400/500/600, italic 400 (fallback system-ui, sans-serif)

**Character:** Shrikhand is hand-painted rótulo lettering, the voice of fair signs; Barlow Condensed is stencilled board text, uppercase and tracked; Barlow is a quiet, warm grotesque for reading. All loaded from Google Fonts with `display=swap`.

### Hierarchy
- **Display** (Shrikhand 400, clamp 46–112px, line-height 0.98): the hero H1 only, two lines, second line in accent text. The volcano pause headline scales larger (clamp 48–148px) over a full-bleed photo; the closing headline sits between (clamp 42–96px, max 12ch).
- **Headline / Letrero** (Shrikhand 400, clamp 34–64px): district titles, always on a hanging sign board, single line on desktop.
- **Title / Rótulo** (Shrikhand 400, 15–52px): painted secondary titles, in descending size: municipality name in the ficha (title-rotulo), the calendar title (title-calendario), dish names on the Sabores menu (title-platillo), the modal title (26px), the wordmark (wordmark; 17px in the footer) and hero board name strips (title-tabla-portada).
- **Title / Tablero** (Barlow Condensed 700, clamp 26–34px, 1.05): beach names on the Playas board; 26px for Rincones card titles; 16px for municipality names under medallions.
- **Body** (Barlow 400, line-height 1.55, measure capped at 30–34em): body is 17px on desktop and body-compacto under 860px. Descending steps: body-cierre for the closing paragraph, lead copy (body-entrada, tinta-suave), 18px district leads, body-dato for list descriptions and the calendar note, body-pequeno for place and dish notes, 14–14.5px captions, and nota for the smallest modal footnote (tinta-tenue). Blockquote clamp 20–26px at 1.4.
- **Label / Tablilla** (Barlow Condensed 600, 13.5–17px, 0.03–0.06em tracking, uppercase): tabs at 17px; label-nav for district links, the municipality nickname and medallion names (700, sentence case); label-chip for event-type chips, "dónde" on the menu and the nav download button; label-tablilla for municipality tags.
- **Button Label** (Barlow Condensed 700, 18px, 0.03em, uppercase): painted buttons, with an optional label-boton-sub line above in sentence case ("Descárgala en").

### Named Rules
**The Sign Painter Rule.** Shrikhand is for signs and painted names only: never body copy, never labels, never UI chrome beyond the wordmark and modal title.

**The Stencil Rule.** Anything uppercase is Barlow Condensed and tracked; Barlow body text is never set in caps.

## Layout

A single centered wrapper, `min(1240px, 100% - 40px)` (32px total inset under 520px). The page is a vertical street of districts: each district opens with its own bulb wire (48px tall; hero 70px, closing 80px) and a letrero row where the sign board sits left at its lettered width and a lead paragraph sits right, aligned to the bottom (grid gap 20px / 56px). District padding is 40px top, 120px bottom (88px under 860px); the sticky nav bar is 64px tall and scroll padding is 76px.

Compositions vary per district rather than repeating a card grid: a sticky 4:3 photo beside a ruled list (Playas, 1.35fr / 1fr), a horizontal scroll-snap strip of 4:5 photos that bleeds to the right viewport edge (Rincones), a 12-column collage on a full-bleed band (Fiestas), a menu board with dotted leaders beside medallions (Sabores), and a row of ten medallions with a detail ficha (Municipios). A full-bleed photo pause (min(88vh, 820px)) sits between Playas and Rincones.

The hero is a 1.05fr / 1fr grid: painted H1, lead and store buttons left; right, the board rack (640px tall) where five boards hang from the hero wire in two staggered rows, positioned by per-board x / y / string-length values so each string meets the wire.

Breakpoints:
- **1080px:** district links leave the bar; board rack 560px; municipality medallions go 5 per row.
- **860px:** single column everywhere; board rack becomes a horizontal swipe row under the CTAs with a straight wire line on top (boards 44vw, max 200px, 16px strings, no swing); strips become 78% columns; Fiestas collage becomes two columns; menu leaders drop.
- **520px:** 16px gutters; nav download button hidden; store buttons go full width.

## Elevation & Depth

Depth is physical, not interface: boards cast a soft, long drop shadow because they hang off the wall; everything else is flat on the ground. A fixed fractal-noise grain (7% by night, 2.5% by day, inverted) gives the asphalt texture. The bar is translucent ground (86%) with a 12px backdrop blur and gains a hairline only after scrolling.

### Shadow Vocabulary
- **Hanging board** (`--sombra`: `0 18px 40px -18px rgba(0,0,0,0.75)` by night; `0 16px 34px -18px rgba(20,24,36,0.45)` by day): sign boards, hero boards, Sabores medallions.
- **Lit bulb glow** (`0 0 6px 1px rgba(255,195,71,0.9), 0 0 22px 6px rgba(255,170,40,0.28)`): lit bulbs only, night only.
- **Photo lettering** (`text-shadow: 0 2px 30px` in sombra-rotulo-foto): Shrikhand set directly on a full-bleed photo, paired with a bottom gradient scrim to rgba(10,12,18,0.72).
- **Modal** (`0 24px 60px -16px rgba(0,0,0,0.6)`): the login dialog over a `rgba(6,8,12,0.72)` scrim with 4px blur.

### Named Rules
**The Only Glow Rule.** The glow belongs to lit bulbs. No other element glows, and by day nothing glows at all.

## Shapes

Mostly rectangles with gently eased corners. Hardware details take micro radii: 1px on the bulb socket, 2px on the active-nav underline. Then 6px on hanging boards and focus rings, 8px on small controls and alerts, 10px on photo frames, 18px on the modal. Pills (999px) for nav links, tabs and chips; circles for medallions and the theme switch. Two organic forms break the geometry: the dry-brush stroke mask on painted buttons (ragged ends, stray bristle marks) and the bulb itself (a pear-shaped radius with a small socket). Sign boards carry a slight rotation (between -1.2 and +1.1 degrees) and two strings rising to the wire.

## Components

### Buttons
Painted, not drawn: a saffron brush stroke on the wall.
- **Shape:** no radius; the paint layer is a pseudo-element masked by the brush-stroke SVG (`--brochazo`), stretched to the button. The button itself is unmasked so its focus ring is not clipped.
- **Painted (primary):** saffron paint, sobre-foco ink, Barlow Condensed 700 18px uppercase, padding 14px 26px 13px, optional 22px SVG store glyph and a 12px sentence-case line above the label. Nav variant: 9px 16px, 15px.
- **Hover / Active / Focus:** hover lifts 2px and tilts -0.6deg with lighter paint (180ms, overshoot curve `cubic-bezier(.2,.9,.3,1.3)`); active presses 1px down and straightens; focus is a 3px saffron outline at 4px offset.
- **Theme switch:** 40px ghost circle with hairline border holding a bulb icon whose glass is filled saffron by night and empty by day; scales to .94 on press.

### Chips
- **Event types:** Barlow Condensed 600 15px uppercase pills (5px 12px) with a 28% ink hairline, static labels on the Fiestas band.

### Tabs
- **Style:** pill outline buttons, Barlow Condensed 600 17px uppercase, 10px 20px, hairline border, tinta-suave text.
- **Selected:** filled with tinta, text in suelo (an inverted pill). Hover brightens text and border.

### Cards / Containers
- **Photo frame:** 10px corners, overflow clipped, suelo-3 placeholder; no border, no shadow. Hover scales the photo 1.05–1.06 inside the frame. Rincones frames reveal with a bottom-up clip wipe (1.1s, staggered 0.1s).
- **Medallion:** circular, white backing for the watercolor municipality illustrations; hanging shadow in Sabores, outline ring in Municipios (2px saffron at 4px offset when selected or focused).

### Inputs / Fields
The only input is Google's hosted sign-in button in the login modal (themed `filled_black` by night, `outline` by day). Errors show in a Banner Red tinted box (8px corners).

### Navigation
Sticky translucent bar, 64px: wordmark (masked Perro de Colima mark + Shrikhand "Colima Go" with "Go" in accent text) left; district links as Barlow Condensed uppercase pills in tinta-suave, hover washed with suelo-3, current district marked by a 2px saffron underline; then the theme switch and a painted Descargar button. Under 1080px only the wordmark, switch and download remain; under 520px the download button leaves too.

### Bulb Garland (signature)
A catenary wire drawn as one SVG quadratic curve (1.5px, cable color, non-scaling) with bulbs placed along `y = 4·comba·x·(1−x)`. Bulb count is `clamp(8, data-focos, width/38)`; sag is per instance (`data-comba`, 0.3–0.85). Bulbs are 11×15px glass with a socket.
- **Unlit:** vidrio fill, cable border.
- **Lit:** when the wire enters the viewport it gains the lit state; each bulb fills saffron with a filament rim and glow, staggered 45ms per bulb (0.5s fill, 0.8s glow).
- **By day:** the lit state is suppressed; bulbs stay clear glass.

### Hanging Sign Board (letrero)
Every district title is a Shrikhand board painted in Lona Blue or Banner Red, 6px corners, hanging shadow, padding .2em .42em .26em, rotated by a per-district angle (set with the `rotate` property so the entrance transform never erases it), with two 1px strings at 14% / 86% whose length is computed so they reach that district's wire.

### Hero Board Rack (tendedero)
Five 31%-wide boards, each a 4:5 photo over a Shrikhand name strip (lona, bandera, or one saffron), strings at 18% / 82%, linking to its district. Hover or focus swings the board from its string top (`columpio`, 1.6s damped keyframes) and scales the photo 1.06; focus draws the saffron ring on the board face. The swing is disabled in the mobile swipe row.

### Motion
- **Reveal:** elements marked for reveal start 26px low and transparent (only when JS is present), and rise over 0.9s `cubic-bezier(.16,1,.3,1)` on entering the viewport (rootMargin -6% bottom); second and third items delay 0.12s / 0.24s.
- **Crossfades:** Playas photos crossfade (0.7s) with a slow 1.04 to 1 settle; the municipality ficha re-enters 8px low over 0.5s.
- **Theme:** ground and text colors transition over 0.4s.
- **Reduced motion:** all animation and transition durations collapse to 0.01ms with no delays, smooth scroll turns off, revealed content and clipped frames are shown immediately. Bulbs still light (state, not motion).

## Do's and Don'ts

### Do:
- **Do** open every new district with its own bulb garland and hang its title on a lona or bandera sign board with a small rotation and strings to the wire.
- **Do** reserve saffron for bulbs, painted action buttons, focus rings, selection and small active markers.
- **Do** swap saffron text for Banner Red in the día theme, and keep bulbs unlit by day.
- **Do** use the app's real photographs in 10px frames and the watercolor illustrations in circular medallions.
- **Do** ship every new motion behind the reduced-motion collapse and keep content visible without JS.
- **Do** define any new color as a custom property in both the noche block and the two día blocks (the `[data-tema="claro"]` block and the `prefers-color-scheme: light` block).

### Don't:
- **Don't** set body copy, labels or controls in Shrikhand; it is sign lettering only.
- **Don't** add glows, neon or light effects to anything but lit bulbs.
- **Don't** paint district sign boards saffron or use saffron as a panel background.
- **Don't** fall back to a sunny full-bleed beach hero over a grid of destination cards; districts each get their own composition.
- **Don't** apply this world to the admin dashboard (`views/dashboard.html`), or its teal/coral system to the landing.
