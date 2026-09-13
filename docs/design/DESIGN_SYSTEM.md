# PLAYERSOUND — Design System

## Concept

**Retro-Cyberpunk CRT / Terminal Sci-Fi.**

This is not a modern web app with a conventional dark mode. The reference is a military/industrial
operator console from a 1985 tech dystopia. Everything on screen should look like it's powered by
phosphor and a cathode-ray tube signal.

This document is the single source of truth for the app's look and feel. Any UI/CSS work — new
component, new page, redesign of an existing screen — must be checked against this file first.
The concrete implementation of these tokens lives in `styles/tokens.css`; nothing new should be
hardcoded in a `.module.css` that isn't backed by a variable defined here.

## Color Palette (monochrome over absolute black)

The trick to this style is to never mix too many colors on one screen. The base is always
absolute black, and you pick a single dominant phosphor tone per screen (green or amber).

**Base black**
- `#000000` — pure black, 100%, for backgrounds
- `#050B05` — CRT background with a barely-there green tint

**Green Phosphor variant (primary)**
- `#39FF14` / `#00FF66` — highlight / active text (high-luminance neon)
- `#008F39` / `#00A859` — borders / reticles / secondary text
- `#00220A` — box backgrounds / shadows (near-black green)

**Amber / Alert variant (secondary)**
- `#FF5500` / `#FF7700` — primary neon
- `#8A2E00` — dim secondary

**RGB split accents**
- `#00FFFF` — electric cyan
- `#FF0055` — CRT magenta

Rule: never blend the green and amber variants on the same screen. Pick one dominant phosphor
per screen/context; use the RGB split accents only for chromatic-aberration effects and one-off
alert accents, not as a third base color.

**Ratio (60/30/10)**: black is ~60% of any screen (backgrounds), the dominant phosphor tone is
~30% (borders, body text, most icons/controls), and cyan (`--accent` in `styles/globals.css`,
aliasing `--rgb-cyan`; glow via `--glow-accent` in `styles/tokens.css`) is a site-wide ~10% accent.
This is a general rule, not a per-component exception — but it's still selective, reserved for
exactly three categories of **state, not property**:

1. **Saved/favorited indicator** — the one control marking "you saved this" (a favorite/heart
   toggle's active state).
2. **Current navigation position** — "you are here" (the sidebar's active route, an active
   playlist/tab).
3. **Keyboard focus** — "this is what you're about to activate" (a global `:focus-visible` ring).

Never apply the accent to the *resting* state of a whole class of repeated controls (all buttons,
all borders, all icons) — that turns it into a second base color instead of a rare highlight. If a
new UI moment doesn't cleanly fit one of the three categories above, it stays the dominant phosphor
tone, not cyan. The pre-existing chromatic-aberration hover effect (cyan+magenta together, home
page title) is a separate, already-established exception from the paragraph above — a one-off
decorative distortion, not a state marker — and isn't affected by this rule.

## Typography

Everything should evoke a plain-text terminal interface, not modern anti-aliased UI type.

**Recommended fonts (free, Google Fonts / dafont)**
- Body / menus / reading: `VT323`, `Share Tech Mono`, or `JetBrains Mono`
- Logos / high-impact titles: `Press Start 2P`, or a bold condensed industrial sans (Eurostile
  Bold, Chakra Petch)

**Rules**
- Text mostly in UPPERCASE
- Wide letter-spacing: `1.5px`–`2px`
- Microscopic sizes (`9px`–`11px`) for decorative technical readouts

## Structure & Components

**Boxes and borders**
- Zero border-radius, or 45° chamfered corners
- Thin, crisp borders: `1px solid` in the active phosphor color
- Prefer corner-bracket boxes (simulated with pseudo-elements, like a targeting reticle) over a
  full continuous border. Implemented as the `.hud-frame` utility class in `styles/globals.css`
  (four background-image layers, sized via `--bracket-size`/`--bracket-thickness` in
  `styles/tokens.css`) — add it alongside a component's own module class on "console/panel"
  containers (the player faceplate, the search controls bar, dropdown/flyout menus). It composes
  with any `background-color`/border the element already has, since it only ever sets
  `background-image`. Reserve it for panels, not for ordinary buttons or list rows — those keep
  the plain 1px-border treatment described above.
- **Depth.** A flat 1px outline with no bevel and no shadow reads as neither brutalism (too thin to
  have that style's weight) nor pixel art (no bevel/offset) — just flat. Give boxes actual depth
  with a hard, zero-blur offset `box-shadow` (tokens `--pixel-shadow-rest`/`--pixel-shadow-hover`/
  `--depth-offset` in `styles/tokens.css`) — the chunky beveled-button look of pixel-art UI rather
  than the soft CRT phosphor glow. This **must** be `box-shadow`, never `filter: drop-shadow(...)`:
  drop-shadow rasterizes the element's actual rendered pixels, so on any box with visible text
  (a search-controls bar, a "+ CREATE" button, a list row's title) it produces a legible offset
  *duplicate of the letters* — reads as a rendering bug, not a shadow. box-shadow only follows the
  box's own border geometry and can't do that, so it's the only correct choice here even though it
  takes more care to combine with a component's own hover-glow box-shadow (below).
  - Two utility classes in `styles/globals.css`, for two different kinds of thing:
    - **`.pixel-depth`** — actually actionable elements: buttons, tabs, a dropdown menu's own
      "add"/"create" button, list rows (**only on `:hover`**, once the row has an opaque background
      — at rest a list row has no fill, so there's no clean card shape to shadow yet). Hover lifts,
      press sinks (next paragraph).
    - **`.pixel-depth-static`** — passive panels/containers that hold their *own* interactive
      children rather than being one button themselves (the search controls bar, a dropdown menu's
      outer box). Just the fixed shadow, no hover/press motion ever. Giving a container the
      interactive class by mistake makes hovering any control inside it (a `<select>`, a checkbox)
      shift the *entire panel*, reading as "the whole bar is one giant button."
  - Inputs stay flat/recessed, not raised — don't add either class there. Skip both on a box that's
    already flush against a viewport edge (e.g. the docked player console) — the shadow would just
    render off-screen.
  - Apply via CSS Modules `composes: pixel-depth from global;` (or `pixel-depth-static`) on the
    component's own class when that class is a single, simple selector (most buttons, panels,
    tabs). `composes` does not work on grouped (`.a, .b { }`) or compound/descendant
    (`.parent button`) selectors — split a grouped rule into one rule per class first; for an
    element with no dedicated class at all (an inline `<button>` styled only via a parent-descendant
    selector), add the raw global class directly in JSX (`className="pixel-depth"`) instead.
  - **Hover lifts, press sinks** (`.pixel-depth` only). On mouse hover the box shifts up-left by
    `--depth-lift` while its shadow grows by the same amount, so the shadow's own screen position
    stays put — reads as the box lifting off a fixed surface. On `:active` it moves down-right by
    `--depth-offset` into that shadow and the shadow disappears — flush, pressed in. The hover rule
    is wrapped in `@media (hover: hover) and (pointer: fine)` — real hover doesn't exist on touch,
    and without that guard a tap can leave a button visually "stuck" lifted (a well-known touch
    `:hover` quirk) until something else is tapped. Touch devices only ever see the `:active` sink,
    which is the behavior that actually matters there.
  - **Combining with a component's own hover glow.** Most buttons already have their own
    `.foo:hover { box-shadow: var(--glow-box) }` rule. `.pixel-depth`'s hover rule is deliberately
    written as `:where(.pixel-depth):hover` — `:where()` zeroes its own specificity, so a
    component's own (more specific) `:hover` rule wins the `box-shadow` property and shows its glow
    instead of the grown pixel-shadow, while the *lift* `transform` (a property that hover-glow
    rule doesn't touch) still applies uncontested. Net effect: the button lifts position and shows
    its normal glow — no fighting, no explicit combining needed in most components. The one place
    that does need explicit combining is a rule *you* write that already sets `box-shadow` for
    another reason in the same breath as depth (e.g. `.row:hover` needs both the row's own glow and
    the depth shadow) — list both as comma-separated values in that one declaration
    (`box-shadow: var(--glow-box), var(--pixel-shadow-rest);`), since box-shadow only accepts one
    value per rule and can't be composed across separate rules the way `.hud-frame`'s
    `background-image` can.

**Buttons and interactivity**
- Resting state: text wrapped in `[ BRACKETS ]`, or a transparent box with a 1px border
- Hover/active state: full inversion — solid neon phosphor background, text clipped in black

**Imagery**
- All graphic assets should be processed with 1-bit/2-bit dithering or halftone screening
- Avoid modern studio-lit photography

## Screen Effects (the "magic touch")

Three post-processing effects turn this from flat to alive:

**Scanlines**
A fixed, `pointer-events: none` overlay (`::after`) with a repeating horizontal gradient of
semi-transparent black lines, ~2px thick.

**Phosphor glow (bloom)**
Active text and borders don't just get color — they get emissive glow:
```css
text-shadow: 0 0 8px rgba(0, 255, 102, 0.7);
box-shadow: 0 0 12px rgba(0, 255, 102, 0.25);
```

**Subtle chromatic aberration**
On hover or on key titles, offset the shadow in red and cyan:
```css
text-shadow: -2px 0 #00ffff, 2px 0 #ff0055;
```

## Player Cover Art

The track-art thumbnail in the player modal (`.player__img`, `player.module.css`) is a deliberate
exception to the monochrome-tinted-thumbnail treatment used everywhere else in the app (search
rows use `grayscale(.4) contrast(1.1)`; the home/about hero art is fully re-tinted to a single
phosphor hue). This is the one "screen" the UI wants you to sit and stare at — it keeps the track
art's real, boosted color (`contrast(1.2) saturate(1.6) brightness(.95)`, no `grayscale`/`sepia`/
`hue-rotate`) instead of forcing it green, plus a scanline overlay (`::after`) and a soft glow
(`box-shadow`) so it reads like a small glowing CRT display, not a printed photo. Don't reuse this
treatment on other thumbnails (list rows, hero art) — those stay monochrome on purpose, per the
60/30/10 rule; this is a one-off "hero screen," not a new default for images.

## Player Transport

**Layout.** The console faceplate (`modal.jsx`) is two rows: a "windows row" (thumbnail, the
spinning globe, and the track-info readout — three equal-height windows sharing the row via
`flex:1` on the info box) and, below it, the full-width transport bar. Don't put the track-info
box back beside the transport panel in a fixed-width column — that was tried and produced uneven
dead space (the info box far shorter than the panel it sat beside, and unused background to its
right); as a third window in the row above, it fills exactly the space the layout has for it.

The transport bar (VU meter, seek bar, and buttons) is its own bordered "cassette body" container
(`.player__panel` + `hud-frame` in `player.jsx`/`player.module.css`, background
`--crt-black-tint`) inset into the console faceplate, not loose controls floating directly in it —
mirrors a real deck's transport unit being its own panel. Inside it, `.player__controls__container`
is a CSS grid (`1fr auto 1fr`), not flex `justify-content:space-between` — with three unevenly-sized
groups (fav / transport cluster / volume), space-between scatters them across the full width instead
of keeping the transport buttons centered under the seek bar above them; the grid guarantees that
regardless of how wide fav/volume end up.

Standalone numeric readouts (the player's elapsed/duration counters, list-row duration badges) use
`--font-digits` (`'Doto'`, a dot-matrix/LED Google Font) with `font-variant-numeric: tabular-nums`,
instead of the regular `--font-body` — this is for isolated numbers only, never for
prose/labels/uppercase text elsewhere. They're also colored cyan (`var(--accent)` +
`--glow-text-accent`), not the dominant green, on the same "small LED readout" logic as the
track-info text below — dim green digits at this small size read as barely-there, not legible. The
player's elapsed/duration counters (`.time`) additionally sit in their own small bordered "LCD
window" (`border` + `background: var(--crt-black-tint)`), not bare floating text — closer to a
car-stereo segmented time display than plain digits on the panel background.

The track-info readout text (`.player__meta h2`/`.player__title`) is cyan, not the dominant green —
another deliberate, bounded exception to the 60/30/10 rule's "cyan is state, not property," same
category as the VU meter's peak cap. It reads as its own small LED display within the console. Its
glow uses `--glow-text-accent` (tighter blur than `--glow-text`) specifically for legibility at this
text size — don't reuse the wider `--glow-accent`/`--glow-text` blur here.

The transport controls (fav/rewind/play-pause/forward/volume) are each an icon button plus a tiny
uppercase caption underneath (`.controlUnit`/`.controlLabel` in `styles/player.module.css`) —
a cassette-deck faceplate reads as labeled buttons, not bare icons. The caption is hidden below
the `700px` breakpoint; there isn't room for it once the transport bar shrinks. The currently
"engaged" control (playback running) gets a held-down look — border/background/glow brighten in
the same dominant phosphor tone (`.controlUnitActive`) — not a new accent color; this is a
state-of-the-same-control change, distinct from the cyan 60/30/10 accent categories above.

Above the seek bar, a purely decorative neon VU-meter bar-graph (`.vuMeter`) bounces while a track
is playing and sits low/dim in the secondary phosphor tone when paused — same spirit as the
loader's fake telemetry readouts (below): a technical-readout flourish, not real audio analysis.
Each column has a fixed cyan "peak cap" pinned near the top (like the fixed amber/red zone marked
on a real VU meter's dial) that briefly flashes as that column's fill swings up near it. This is a
momentary animation flash, not a resting-state color — same category of exception as the
chromatic-aberration hover below, not a fourth base color added to the palette.

## Loader Screen Spec

Forget spinning circular progress bars. The loader should work like this:

- **Container**: a centered box with a 1px technical border and a header reading
  `SYSTEM INITIALIZING...`
- **Central visual**: a 4-frame looping pixel-art/dithered icon (a floppy disk inserting, a chip
  with traveling data lines, or a layered topography scan)
- **Progress bar**: segmented into rectangular blocks that fill step by step
  (`█ █ █ █ ░ ░ ░ ░`)
- **Live telemetry**: below the bar, fast-changing fake readouts
  (e.g. `MEM_CHECK: 0x80F4A... OK`, `CALIBRATING 24%`)

## Background

**Blueprint grid.** Full-bleed page containers (home, search/library lists, about) use
`background: var(--bg-grid)` instead of the plain `var(--bg)` black — a faint graph-paper grid
(`--grid-line` at ~7-8% opacity over `--crt-black`, cell size `--grid-size`) reinforcing the
"operator console" concept from a small physical distance. `--grid-line` re-tints per phosphor
variant the same way the other tokens do; don't hardcode a grid color in a `.module.css`. Smaller
chrome (the sidebar rail, the player console faceplate, modal backdrops) intentionally stays plain
`var(--bg)`/`var(--phosphor-box-bg)` — the grid marks "this is the content viewport", not every
surface.

## Implementation Notes

- All values above are implemented as CSS custom properties in `styles/tokens.css` — see that
  file for the exact variable names.
- The green-phosphor variant is the `:root` default; the amber variant is opt-in via
  `[data-theme="amber"]` on a container.
- This document covers the target aesthetic. It has been applied to the player modal
  (`player.jsx`/`modal.jsx`), the search controls bar, playlist dropdown menus, and the four
  full-bleed page containers (home, search, library, about); remaining spots (`sideBar.jsx`'s nav
  markers, individual row styling) still just follow the base palette/typography rules above
  without the `.hud-frame`/grid treatment — that's a deliberate contrast (rail vs. viewport), not
  an oversight, but re-check this file before assuming a component is "done."
