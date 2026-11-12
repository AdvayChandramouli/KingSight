---
name: KingSight
description: A planning model of the May 2014–May 2015 King County sales market, read on cool paper.
colors:
  ink: "#14161a"
  evergreen-strong: "#2c3138"
  surface: "#f3f4f6"
  canvas: "#e6e8eb"
  ink-muted: "#3e4450"
  fir: "#1a1f24"
  basswood: "#d7d1c6"
  land: "#d7d1c6"
  water: "#3a4d5c"
  deep-blue: "#1a3d52"
  clay: "#8d5a3a"
  clay-ink: "#6a3d28"
  clay-soft: "#f3e7de"
  mist: "#d5e0e7"
  mist-soft: "#e7eef2"
  brass: "#745218"
  evergreen: "#14161a"
  evergreen-soft: "#d5d8de"
  sand: "#e4ddd2"
  sand-soft: "#efeae3"
  border: "#c4c7cc"
  control: "#5a616b"
  danger: "#8c2f2c"
  danger-soft: "#f8e6e3"
  warning: "#6b4a10"
  warning-soft: "#f4ead4"
typography:
  display:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 600
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0em"
  label:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0.01em"
  caption:
    fontFamily: "Schibsted Grotesk Variable, Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.02em"
  id:
    fontFamily: "Red Hat Mono Variable, Red Hat Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "0em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "8px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.evergreen-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-field:
    backgroundColor: "{colors.basswood}"
    textColor: "{colors.fir}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    height: "44px"
---

# Design System: KingSight

## Overview

**Creative North Star: "A planning model on a studio table"**

KingSight is a historical instrument for King County residential sales from May 2014 through May 2015. The interface is the paper beside a physical relief model: cool gray sheets, basswood land, a darker water inset, and a few metal pins. Daylight is north light. The personality is precise and tactile, without HUD chrome, scanlines, or neon.

The product’s subject is two readings of the same sale. The property-feature model and the neighborhood-graph model each have an ink. Geography is pins, threads, and captions. Photography and the relief scene prove place. They are not evidence of today’s market, and the copy must not imply current listings, live prices, or present-day predictions.

Explorer and landing consume the tokens in `app/src/styles/index.css`. They must not introduce a one-off hex palette. When a renderer cannot read CSS variables, copy the hex from this file.

**Key Characteristics:**

- Cool paper for type, fir black for the model table
- One grotesque for everything except property ids
- Two model inks, plus brass for the selected pin
- Rectangular controls, hairline borders, 8px radius at most
- Historical scope stays in the folio and in every estimate label

## Colors

The palette is the model’s materials. Ink is the action on paper. Color is scarce, and it is never the only signal.

### Primary

- **Ink** (`--color-ink`): Near-black text and the primary button on paper.
- **Action hover** (`--color-evergreen-strong`): The lighter press state of that same ink button. The name is legacy. The color is not green.
- **Paper** (`--color-surface`): The sheet a control or panel sits on. Primary button text uses this.
- **Page** (`--color-canvas`): The cool gray page behind the sheet.

### Secondary

- **Water** (`--color-water`): The relief model’s water inset and the map’s water. Darker and slightly blue, clearly not land.
- **Property-feature ink** (`--color-deep-blue`): The same water hue, darker, for text and small marks. Text-safe on paper. Always with the Rows icon and the words for that model.
- **Water wash** (`--color-mist`, `--color-mist-soft`): Quiet field behind property-feature material. Not a second action color.

### Tertiary

- **Cedar** (`--color-clay`): Graph-model material for bars and dots.
- **Cedar ink** (`--color-clay-ink`): Darker cedar for text. Text-safe on paper and on `--color-clay-soft`. Always with the Network icon and the words for that model.
- **Cedar wash** (`--color-clay-soft`): Quiet field behind graph material.

### Neutral

- **Fir** (`--color-fir`): Cool, low-chroma black for the model table and for scrims. Not a text color on paper.
- **Basswood** (`--color-basswood` and `--color-land`): Light warm gray. Land on the model and the map. Also the action fill when a control sits on fir. `--color-land` and `--color-basswood` are the same value.
- **Muted ink** (`--color-ink-muted`): Secondary text. At least 4.5:1 on canvas, surface, basswood, and the soft washes.
- **Hairline** (`--color-border`): Panel and control borders.
- **Control** (`--color-control`): Input borders, at least 3:1 on paper.
- **Sand** (`--color-sand`, `--color-sand-soft`): Basswood-adjacent fills for tracks and hovers.
- **Brass** (`--color-brass`): The selection pin. Text-safe on paper and on basswood. Below 3:1 on fir, so it is never brass-only on the dark field.

### Semantic

- **Danger** (`--color-danger`, `--color-danger-soft`): Errors. A red, distinct from cedar. White-equivalent paper text on the solid is text-safe. Pair with an icon and a sentence.
- **Warning** (`--color-warning`, `--color-warning-soft`): Cautions, including the historical note when it needs a tone. Amber, distinct from brass. Pair with an icon and a full sentence.

### Legacy evergreen

Green is not the brand. These names stay so existing utilities keep working:

| Token | Value | What it means now |
|---|---|---|
| `--color-evergreen` | `#14161a` | Paper-action ink. Same value as `--color-ink`. Not a model color and not a selection color. |
| `--color-evergreen-strong` | `#2c3138` | Hover and pressed state of that action ink. |
| `--color-evergreen-soft` | `#d5d8de` | Quiet cool wash for legacy soft fills. Not selection. |

New work uses `ink` for actions and `brass` for selection. Do not paint a third brand green back into these tokens.

### Token table

| Token | Value | Role |
|---|---|---|
| `--color-canvas` | `#e6e8eb` | Cool gray page |
| `--color-surface` | `#f3f4f6` | Paper sheet and text on ink buttons |
| `--color-ink` | `#14161a` | Near-black text and primary button |
| `--color-ink-muted` | `#3e4450` | Secondary text, ≥4.5:1 on paper |
| `--color-fir` | `#1a1f24` | Model table and scrims |
| `--color-basswood` | `#d7d1c6` | Light warm gray; action fill on fir |
| `--color-land` | `#d7d1c6` | Map and model land; alias of basswood |
| `--color-water` | `#3a4d5c` | Darker blue-gray water material |
| `--color-deep-blue` | `#1a3d52` | Property-feature model ink |
| `--color-clay` | `#8d5a3a` | Graph-model cedar material |
| `--color-clay-ink` | `#6a3d28` | Graph-model text |
| `--color-clay-soft` | `#f3e7de` | Cedar wash |
| `--color-mist` | `#d5e0e7` | Water wash |
| `--color-mist-soft` | `#e7eef2` | Lighter water wash |
| `--color-brass` | `#745218` | Selection pin |
| `--color-sand` | `#e4ddd2` | Warm neutral track |
| `--color-sand-soft` | `#efeae3` | Warm hover wash |
| `--color-border` | `#c4c7cc` | Hairline |
| `--color-control` | `#5a616b` | Input border |
| `--color-danger` | `#8c2f2c` | Error |
| `--color-danger-soft` | `#f8e6e3` | Error wash |
| `--color-warning` | `#6b4a10` | Caution |
| `--color-warning-soft` | `#f4ead4` | Caution wash |
| `--color-evergreen` | `#14161a` | Legacy action ink, same as ink |
| `--color-evergreen-strong` | `#2c3138` | Legacy action hover |
| `--color-evergreen-soft` | `#d5d8de` | Legacy cool wash |

**The Two Ink Rule.** Property features are water blue. The graph is cedar. Each reading also carries an icon and its name. Green is not a third model.

**The Square Pin Rule.** An idle geographic mark is a circle (`pin-idle`, ink). The selected mark is a brass square with a 2px paper collar (`pin-selected`). On fir, the idle mark is basswood (`pin-idle-on-fir`) and the collar is basswood (`pin-selected-on-fir`), because brass alone fails contrast on fir. Segmented controls repeat the rule: the selected item is semibold and shows a brass square; the others do not.

**The Paper Action Rule.** On paper, the primary button is ink with paper text. Basswood is the button fill only when the control sits on fir (`variant="field"`).

## Typography

**Display Font:** Schibsted Grotesk Variable (with system sans)
**Body Font:** Schibsted Grotesk Variable (with system sans)
**Label/Mono Font:** Red Hat Mono Variable, property ids only

**Character:** One news grotesque. Headlines are large, linear, and tight. There is no italic romance and no second display family.

`--font-display` and `--font-sans` are the same stack. `--font-mono` is Red Hat Mono and is only for property ids. Prices and areas stay in the grotesque with `tabular` (tabular lining figures). Captions use the grotesque at label size with more tracking (`text-caption`).

### Hierarchy

- **Display** (600, 2.5rem, 1.12, −0.02em): Landing headlines. Pages may scale between 2.5rem and 3rem. Do not exceed 6rem.
- **Headline** (600, 1.5rem, 1.2): Section titles.
- **Title** (600, 1.25rem, 1.25): Panel titles.
- **Body** (400, 1rem / 16px, 1.5): Prose. Keep explanatory copy near 65–75 characters.
- **Label** (500, 0.8125rem / 13px, 1.35, 0.01em): Controls, the folio, metadata.
- **Caption** (400, 13px, 1.4, 0.02em): Photo and model captions.
- **Id** (Red Hat Mono 500, 13px): Property ids only.

### Named Rules

**The One Family Rule.** Schibsted Grotesk does every job except property ids. Do not use Fraunces, Inter, Space Grotesk, Space Mono, or IBM Plex.

**The Tabular Rule.** Currency and areas use tabular lining figures. Dollar amounts do not count up.

## Layout

The page sits on an 8px rhythm. Landing is a fixed split: the model bleeds off the left, and the reading column is a real column of about 36–42rem on paper, not a card floating on the scene. Explorer keeps its map and list workspace. The header is one compact paper bar on every route.

Groups inside a record stay tight. Sections separate by more space than the gap under a heading. Explanatory prose wraps near 65–75 characters. The header folio wraps onto its own line below 540px so the market window stays readable.

## Elevation & Depth

Surfaces are flat paper. Depth is a step of tone (canvas, then surface) and a 1px hairline. Shadows are contact, not a glow.

### Shadow Vocabulary

- **Contact** (`--shadow-soft`): A 1px offset blur under a pressed paper control.
- **Sheet** (`--shadow-lift`): The drawer and dialog only, a soft vertical shadow in fir black.

### Motion

Arrivals use `--ease-out-expo`, which is `cubic-bezier(0.16, 1, 0.3, 1)`. No spring overshoot on dollar figures or drawers.

| Token | Duration | Use |
|---|---|---|
| `--duration-feedback` | 160ms | Color, border, and selection feedback |
| `--duration-drawer` | 250ms | Drawer and sheet |
| `--duration-route` | 300ms | Route transition. Unmount the relief scene first |
| `--duration-photo` | 400ms | Photograph crossfade |
| `--duration-connections` | 500ms | Connection threads drawing on, capped under 700ms total |

**The Still Duration Rule.** `prefers-reduced-motion` does not set durations to 0.01ms. Opacity, color, and selection changes keep their durations. Transform travel, camera motion, and looping motion (spin, pulse, bounce) drop. The relief scene renders at the settled camera, connections appear without a draw, and the photograph cuts. Scroll smoothing is off.

## Shapes

Controls are rectangular. Radius stops at 8px: 4px, 6px, 8px, 8px (`--radius-sm` through `--radius-xl`). Borders are 1px hairlines. Pills are not part of the system.

The selected pin changes shape, from a circle to a square, and gains a collar. Focus is a 2px ring, offset 2px: ink on paper, paper (`surface`) on fir. The ring is the shape. Brass is not the focus color.

## Components

Shared controls live in `app/src/components`. They are paper, hairline, and rectangular. Primary actions are ink. `field` is the basswood button for fir. Quiet actions are text, not a second filled button. Danger is the red button, still with the ink focus ring.

### Buttons

- **Shape:** 6px radius (`rounded-md`), 44px minimum height.
- **Primary:** Ink fill, paper text. Hover lightens to the action-hover ink.
- **Secondary:** Paper fill, hairline, ink text. Hover warms to sand.
- **Field:** Basswood fill, fir text, paper focus ring. Only on fir.
- **Quiet / ghost:** Ink or muted ink, no fill. Quiet underlines on hover.
- **Danger:** Danger fill, paper text, icon plus a label when the action is destructive.
- **Focus:** The global 2px ink ring. Field uses the paper ring.
- **Disabled:** Opacity, still the same shape.

### Navigation

The header is compact solid paper on every route, with a hairline under it. Contents, in order: the grotesque wordmark (home, `/`), the folio “King County · May 2014–May 2015”, one text link, and one ink primary action. Landing’s text link points at `/#how-it-works`. Explorer’s text link is a button that opens the existing how-it-works drawer. The primary action is `/explore`. Those targets do not change. Demo data, when the app is in mock mode, is a hairline label with an icon, not a cedar chip.

### Notices

Icon plus sentence on a wash. Info is paper and ink, so it is not mistaken for the property-feature model. Warning and error use their semantic washes and icons. No thick colored side stripe.

### Segmented control

A rectangular track. The selected segment is paper, semibold, and preceded by a brass square.

### Drawer and confirm

Paper sheet, hairline, 8px top radius on the mobile sheet. The drawer travels for 250ms and fades in place when motion is reduced. Focus returns to the trigger.

### Model tag

`ModelTag` renders the model’s icon, its perspective label, and its ink. `modelFamilyStyle` maps `tabular` to deep-blue and `graph` to cedar.

### Pins

Use `pin-idle` and `pin-selected`. Do not recolor a circle and call it selected.

### Frozen integration

These files are not implemented in the foundations pass. Landing owns them. The props are frozen so the scene and the photograph plate share one contract.

`ReliefStage` at `app/src/features/landing/relief/ReliefStage.tsx`:

- Props: `propertyId`, `zip`, `latitude`, `longitude`, `neighbors` (`{ id, zip, latitude, longitude }[]`), `showConnections`, optional `className`.
- Returns `null`, and must not load Three.js, when the viewport is under 768px, `prefers-reduced-motion` is set, or WebGL is missing. The parent shows the photograph plate.
- Three.js is a dynamic import inside the scene chunk. Do not static-import `three`, `@react-three/fiber`, or `@react-three/drei` from the explorer, from the map module, or from a module that still evaluates on the fallback path.

Photography manifest at `app/src/features/landing/media/ledger.ts` exports `heroPhotograph` and `fabricPhotograph`, each `{ id, src, alt, caption, credit, license, sourceUrl, geography }`.

## Do's and Don'ts

### Do:

- **Do** take every color from the token table. Copy the hex only when a canvas API cannot see the CSS variable.
- **Do** keep “King County · May 2014–May 2015”, or the historical-estimates label, visible wherever an estimate is shown.
- **Do** identify each model with an icon and words as well as its ink.
- **Do** change a selected mark from a circle to a brass square with a collar.
- **Do** keep opacity and color motion when reduced motion is on, and drop travel, camera moves, and loops.
- **Do** set property ids in Red Hat Mono and prices in tabular grotesque figures.

### Don't:

- **Don't** add a local palette, a brand green, or a neon accent in landing or explorer.
- **Don't** use Fraunces, Inter, Space Grotesk, Space Mono, or IBM Plex.
- **Don't** imply current listings, live housing prices, or present-day predictions.
- **Don't** select, warn, or name a model by color alone.
- **Don't** set reduced-motion durations to 0.01ms.
- **Don't** put the relief scene and the explorer MapLibre canvas on screen together.
