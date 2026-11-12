# QISMA

QISMA is a shared-expenses app for flatmates, trips and friends: split a bill, see who owes whom, settle up. This system is taken from the two QISMA mockups (Dashboard overview and My Groups): deep forest-green chrome, mint and peach tinted cards, white surfaces on a cool off-white page, and a calm, rounded geometry. Colors were pixel-sampled from the mockups; text colors that failed contrast were darkened (noted on each token).

## Voice and content

- Talk about money in words, not signs. Write **You're owed 320 MAD** and **You owe 180 MAD**; never “-180 MAD” on its own and never “You Owe -180” (double negative).
- Amount first, currency code after, with a space: `2,450 MAD`, `24.50 EUR`. Never add different currencies together; show one total per currency.
- Sentence case for everything: “Create a group”, “View group”, “Needs your action”.
- Short and direct: “Omar says he paid you 100 MAD” → buttons “Reject” / “Confirm”.
- Three languages: FR, EN, AR. Layouts use logical properties (`margin-inline-start`, `padding-inline`) so Arabic mirrors; numbers stay left-to-right inside Arabic text.

## Color

| Role | Token | Where |
|---|---|---|
| Chrome | `brand-900` | Sidebar, dark banners (`banner`) |
| Active / primary | `brand-700`, `brand-600` | Active nav item, primary buttons, links, active tab |
| Tints | `brand-100` (mint), `owe-soft` (peach) | Stat cards, owner badge, owe card |
| Page | `bg`, `surface`, `surface-sunken` | Page ground, cards, chips |
| Money | `owed` (green), `owe` (red) | Balances. Always with the words; the two also sit on different grounds (`owed-soft` mint vs `owe-soft` peach) so color is never the only signal |
| Pending | `pending` (blue) | Repayments awaiting confirmation, action counters |
| Charts | `chart-green`, `chart-mint`, `chart-amber`, `chart-purple`, `chart-grey` | Category donut, in that order |
| Decoration | `accent-green`, `accent-orange`, `accent-purple`, `owe-accent` | Group card top rules, icons, illustrations — never text |

Rules: text only in `ink`, `ink-muted`, `brand-600`, `owed`, `owe`, `pending`, `danger` (all 4.5:1+ on `surface` and their soft grounds). Control borders use `border-control` (3:1); `border` is decorative only.

## Type

Inter for UI text, Space Grotesk for page titles, section titles and every money amount (`page-title`, `section-title`, `amount-xl`, `amount-md`). Numbers use tabular figures so columns line up. Arabic falls back to IBM Plex Sans Arabic.

## Shape and space

Cards `radius-lg` (16px) with `space-6` padding; buttons, inputs and nav items `radius-md` (10px); badges `radius-sm`; avatars and status pills `radius-pill`. Cards sit `space-4` apart, sections `space-8`. Touch targets are at least 44px tall.

## Hover and interaction

Every interactive element changes on hover within `duration-fast` and settles with `ease-standard`. Lifts use `duration-base` with `ease-out`.

| Element | Rest | Hover | Pressed / focus |
|---|---|---|---|
| Primary button | `brand-600` | `brand-600-hover` + `shadow-hover`; trailing arrow slides 3px | `brand-600-active`, 1px down |
| Secondary button | `surface`, `border-control` | `surface-hover`, border `ink-muted` | 1px down |
| Ghost / outline | transparent | `brand-50` fill | — |
| Nav item | text `sidebar-ink` | `sidebar-hover` fill, icon nudges 2px | current: `brand-700`, white, 600 |
| Tab | `ink-muted` | `ink` + `border-hover` underline | selected: `brand-600` 3px underline |
| Group card (clickable) | `shadow-card`, `border` | lifts 2px, `shadow-hover`, `border-hover` | back to 0 |
| List row | transparent | `surface-hover`, chevron fades in | — |
| Input | `border-control` | border `ink-muted` | focus: border `brand-600` + 3px `brand-100` ring |
| Avatar stack | overlapped −10px | fans out 3px each | — |

Focus is never hover: every control shows a 2px `focus-ring` outline with 2px offset on keyboard focus. Nothing reveals essential information on hover only.

## Scrolling

- **Page:** the sidebar stays fixed; only the main column scrolls. Use `scroll-padding-top` equal to the sticky header height so anchored sections are not hidden.
- **Sticky headers:** card headers and table headers use `.q-sticky`; once content scrolls under them they gain `shadow-sticky` (toggle `is-scrolled` when `scrollTop > 0`).
- **Inner scroll areas** (activity feed, member list): `.q-scroll` — thin scrollbar in `scrollbar-thumb`, darkening to `scrollbar-thumb-hover`, and `overscroll-behavior: contain` so the page doesn't scroll when the list hits its end.
- **Horizontal:** tabs and group carousels scroll sideways with scroll-snap and no visible bar on tabs; never let the page body scroll sideways.
- **Smooth scroll** for in-page jumps (`duration-slow` feel); all smooth scrolling and transitions turn off under `prefers-reduced-motion`.

## Iconography

Line icons, 24px grid, 2px stroke, round caps and joins, drawn in `currentColor` (wallet, users, scale, arrows-left-right, bell, chart bars, settings). Icon tiles in cards sit on a tint circle (`brand-100`, `owe-soft`, `pending-soft`). No emoji in the UI. Photos on group cards are optional; without one, show the group initials on a tint tile.

## What was left out on purpose

The decorative wallet, plant and people illustrations, the “Go Premium” card and fake trend sparklines from the mockups are not part of the system: illustrations belong only to empty states.
