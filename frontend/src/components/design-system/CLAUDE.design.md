# QISMA design system — rules for Claude Code

The design system lives in `frontend/design-system/`. Read `frontend/design-system/README.md` before any UI work, and the matching `components/<Name>/README.md` + `preview.html` before building or restyling that component. `tokens.json` is the source of truth; `tokens.css` is generated from it.

## Wiring (already done, or do it first)
- `frontend/src/index.css` imports, in this order: `../design-system/tokens.css`, then `../design-system/tailwind-v4.css` (Tailwind v4) — or the v3 preset `design-system/tailwind-preset.cjs` in `tailwind.config` — then `../design-system/qisma.css`.
- Fonts: Inter + Space Grotesk via the Google Fonts import at the top of `qisma.css`.
- Dark mode: `data-theme="dark"` (or class `dark`) on `<html>`.
- Put class `q-root` on the app's root element (sets font, tabular numbers, focus ring for the `q-*` classes).

## Hard rules
- Never hardcode a hex, px radius, shadow or duration in components. Use tokens: Tailwind classes (`bg-brand-600`, `text-ink-muted`, `rounded-lg`, `shadow-hover`, `duration-fast`, `ease-standard`) or `var(--token)`, or the `q-*` classes in `qisma.css`.
- Money: amount then currency (`320 MAD`). Owed → `text-owed` with the words “You're owed”; owe → `text-owe` with “You owe”, never a bare minus. Never sum different currencies. API money is integer minor units (`amountMinor`, `netMinor`): format with one shared helper.
- Every interactive element has the hover / pressed / focus states in README “Hover and interaction”; focus ring is `focus-visible:outline-2 outline-focus-ring outline-offset-2`. Minimum 44px touch targets.
- Scrolling: sidebar fixed, main column scrolls; inner lists use `q-scroll`, sticky headers `q-sticky` with `is-scrolled`; respect `prefers-reduced-motion`.
- Text colors only from: `ink`, `ink-muted`, `brand-600`, `owed`, `owe`, `pending`, `danger`. `owe-accent`, `accent-*`, `chart-*` are decoration/charts only.
- Use real `<button>` / `<a>` / `<label>`; no emoji in UI; line icons (lucide-react is fine) at 2px stroke.
- Use logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`) so the AR (RTL) layout mirrors.
- Show only data the API returns (`src/types/api.ts`). No notifications badge (no API), no “Go Premium”, no decorative illustrations outside empty states.

## Refactor order
1. Wire the CSS and Tailwind theme; replace hardcoded colors app-wide.
2. Layout shell + sidebar (`NavItem`), then shared primitives: Button, Badge, Input, Card, Tabs, ListRow, BalanceAmount.
3. Pages: GroupsPage + GroupCard, then group detail tabs, then the dashboard/overview.
Keep existing hooks, services and routes; change presentation only unless asked.
