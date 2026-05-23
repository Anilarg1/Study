# UI Friendliness Improvements

_Started 2026-05-23 11:59 UTC_

---

## User

can you make this ui design more user friendly and satisfying to use

## Assistant

_[tool: view_image]_

_[tool: list_files]_

_[tool: update_todos]_

I'll redesign the study timer with focus on making it feel alive and satisfying — better information hierarchy, a progress ring that visibly fills as you study, richer session tracking, and warmer typography. Let me start.

_[tool: copy_starter_component]_

_[tool: write_file]_

Now I'll build the redesign. My direction:

**Design system declaration:**
- Type: Geist + Geist Mono (Google Fonts) — clean grotesk with a mono companion for time/labels
- Palette: warm dark (subtle warmth in the blacks) with mode-driven accents — amber for Focus, sage for Short Break, blue for Long Break, soft lilac for XP
- Layout: three-zone — slim nav · timer hero · activity rail, so the whole canvas is purposeful instead of an empty center
- Hero: animated progress ring that fills as time elapses + ambient glow + breathing pulse when running — the core satisfaction beat
- Replace generic dropdown with subject chips, add a real "today" visualization, streak card with mini-week, and recent sessions

_[tool: done]_

_[tool: fork_verifier_agent]_

Redesigned as **Study Timer.html**. The core moves:

- **Animated progress ring** that fills as time elapses + ambient glow that breathes when running — the satisfaction beat the original lacked
- **Mode-driven palette** — amber for Focus, sage for Short Break, blue for Long Break; the whole UI (ring, glow, active tab, today-grid) tints with the mode
- **Three-zone layout** — slim nav · timer hero · activity rail, so the empty canvas now carries real content
- **Subject chips** with color swatches replace the dropdown — one tap to switch what you're studying
- **Session pips** with shimmer on the active one, and a label telling you what comes next
- **Right rail** — today's focus-hours timeline, streak card with a flame and last-7-days mini-week, level/XP with smooth fill, recent sessions list
- **Keyboard control** — Space pause, R reset, → skip, 1/2/3 mode, with on-screen hints
- **Warmer dark** — subtle warmth in the blacks and an off-white text color, away from the cold grey original

Click the play button or hit Space to see the ring animate down in real time.

## User

i want the site to look like a mix of this and linear.app

## User

i want the site to look like a mix of this and linear.app

## User

i want the site to look like a mix of this and linear.app

## Assistant

_[tool: copy_files]_

Got it — Linear's aesthetic DNA: cool slate near-black, refined Inter typography, tight density, gradient-edged cards with subtle top-light, keyboard shortcuts surfaced everywhere, a top header bar with ⌘K command hint, and very restrained accent color used as signal rather than decoration. Let me restyle.

_[tool: write_file]_

_[tool: done]_

_[tool: fork_verifier_agent]_

**Study Timer v2.html** — Linear-influenced restyle. What changed:

- **Palette** — switched warm dark → cool slate near-black (`#08090a`) with cool whites, Linear-style refined indigo as the focus accent
- **Typography** — Inter Display feel (Inter w/ stylistic sets enabled), Geist Mono retained for time/numerals; tighter sizes & letter-spacing throughout
- **Top header bar** — added the full Linear chrome: brand corner with workspace switcher, breadcrumb, big `⌘K` command palette, notifications, **+ New session** primary button with inline keyboard hint
- **Filter bar** — issue-list-style filter pills (Focus session, Mathematics, +Tag) with a view toggle on the right
- **Nav** — denser with Practice / Library / Subjects sections, per-row keyboard shortcuts (`G T`) revealed on hover, color-dot subject favorites, presence dot on avatar
- **Cards** — subtle top-light gradient inside each card, hairline 1px borders at low opacity, refined inset shadows
- **Mode tabs** — inline kbd hints (`1` `2` `3`) right in the tabs, recessed pill style
- **Primary button** — rectangular rounded with gradient sheen + glow ring instead of round play, more app-like
- **Right rail** — segmented Today / Week / All time tabs at top, tighter card density

