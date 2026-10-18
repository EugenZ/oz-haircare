# ROOT / RITUAL Design System

> Category: Health & Wellness. Warm editorial care for a bilingual trichology and hair-restoration practice.

## Brand character

ROOT / RITUAL feels calm, expert, tactile, and personal. Pair clinical clarity
with editorial warmth. Avoid sterile hospital styling, beauty-salon glamour,
generic wellness gradients, and exaggerated medical claims.

## Color roles

- Paper `#fbfaf6` is the main canvas.
- Cream `#f5f1e9` separates quiet sections and light controls.
- Botanical sage `#dfe6da` supports treatment and journal sections.
- Forest ink `#26342d` carries primary text and dark booking surfaces.
- Clay `#c66d4e` is the restrained accent for eyebrows, links, and emphasis.
- Light clay `#e9b89c` is reserved for content on forest ink.
- Keep clay limited; it should guide attention, not flood the page.

## Typography

Use Georgia or Times New Roman for display headings, numbers, signatures, and
editorial italics. Use Arial or Helvetica for body text, navigation, controls,
and form labels. Headings use normal weight, tight line-height, and negative
tracking. Body copy stays compact but readable with generous leading.

## Layout and rhythm

Use full-width sections, strong vertical rhythm, and responsive side gutters.
Desktop sections use about `104px` vertical padding and `6vw` gutters. Alternate
paper, cream, sage, clay, and forest surfaces. Prefer asymmetrical editorial
grids, hairline dividers, overlapping image notes, and ample negative space.

## Components

Buttons are square-edged and typographic. Primary buttons use forest ink on
light surfaces; booking buttons use cream on forest ink. Links use a thin
underline and small diagonal-arrow movement. Cards are mostly border-separated,
not boxed. Forms use transparent fields with bottom borders. Treatment details
open in a centered modal. Focus states must remain visible.

## Imagery

Use real, licensed close-up hair, scalp, process, and specialist photography.
Favor natural light, muted saturation, and editorial crops. Avoid synthetic
before-and-after results, unrelated spa imagery, excessive retouching, or any
image implying outcomes the specialist cannot substantiate.

## Interaction and motion

Motion is quiet: `200ms` color and position changes, gentle arrow movement,
small button lift, slow gallery zoom, and continuous ticker motion. Preserve
keyboard operation. Under `prefers-reduced-motion: reduce`, stop decorative
animation and remove nonessential smooth movement.

## Responsive behavior

At tablet widths, reduce image and grid density without changing section order.
At phone widths, use a menu button, single-column content, stacked actions,
two-column process steps where space permits, and touch targets near `44px`.
Russian strings often run longer than English strings; never use fixed widths
that clip either language.

## Bilingual content

Russian and English are equal product surfaces. Preserve the `ru | en` language
model, existing content structure, and `document.documentElement.lang` updates.
Do not translate names, prices, durations, or claims without explicit source
copy. New visible content requires both languages.

## Accessibility

Maintain semantic landmarks, heading order, form labels, alt text, dialog
semantics, Escape support, visible focus, and sufficient contrast. Color cannot
be the sole state indicator. Body text should remain at least `14px`; controls
must work with keyboard and touch.

## Production boundaries

Preserve mobile navigation, language switching, treatment modal, gallery,
journal, and booking confirmation while redesigning. The booking form is an
interface only until a real endpoint is connected. Do not deploy, publish, add
analytics, or replace placeholder business details without explicit approval.
