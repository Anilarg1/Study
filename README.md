# Notebook

A Linear-inspired study productivity app — Pomodoro timer, subjects, streaks, XP, and more.

**Live:** [Vercel → shaaifipad-9810's projects → study](https://vercel.com)

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript (`strict: true`) |
| Styling | Custom CSS variables + Tailwind utility classes |
| State | Zustand (persisted to localStorage) |
| Backend | Supabase — Postgres, Auth, Realtime |
| Deploy | Vercel (auto-deploy on push to `main`) |

---

## Features

### Timer
- Pomodoro work / short-break / long-break modes
- Animated ring + sliding bars that follow the active subject colour
- Session persisted to `localStorage` (`expiresAt` timestamp — survives reloads)
- **Audio chime** at timer end; mute toggle in Settings → Notifications

### Sessions
- **New Session** modal (`C` or topbar button) — choose subject + custom duration
- XP awarded on completion: work → 25 · short break → 5 · long break → 10
- All stats derived from `sessions` table (no pre-computed aggregates)

### Subjects
- Create / edit / delete subjects with a colour swatch
- SubjectPicker dropdown in New Session modal and filter bar
- Sessions tagged to subjects; colour drives timer ring accent

### Sidebar
- Linear-style 3-column shell: nav · main · right rail
- **Collapsible sidebar** — `[` shortcut or chevron button; 232 px ↔ 48 px icon-rail mode (220 ms CSS transition)
- Practice section: Timer, Streak, Today, Stats (soon), Timetable (soon)
- Library section: Notes (soon), Flashcards (soon)
- Subjects list with colour dots

### Command palette
- Open with `Ctrl+K` / `⌘K` or click the topbar search bar
- Grouped sections: **Actions** (New session, Go to Timer, Go to Settings) · **Subjects**
- Full-text search filters across all items
- Keyboard nav: `↑↓` move · `↵` select · `Esc` close

### Streaks & XP
- Daily login streak with full-month calendar card
- XP bar + level (`floor(√(xp / 100))`) in right rail
- `daily_logins` table — one row per user per calendar day

### Auth
- Supabase email/password + OAuth (Google)
- Interactive dot-grid canvas login page

### Settings
- Account: display name, email, password change
- Interface: theme (dark/light/system), density (comfortable/compact), font scale, high-contrast
- Notifications: sound alerts toggle

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Ctrl+K` / `⌘K` | Open command palette |
| `C` | New session modal |
| `[` | Toggle sidebar collapse |
| `Esc` | Close modal / palette |
| `↑↓` / `↵` | Navigate / confirm command palette |

---

## Database schema

```
users            id, xp
sessions         id, user_id, type, xp, subject_id FK, completed_at, duration_secs
daily_logins     id, user_id, date  (streak source of truth)
subjects         id, user_id, name, color, created_at
notes            id, user_id, subject_id FK, title, body, created_at
flashcard_decks  id, user_id, subject_id FK, name
flashcards       id, deck_id FK, front, back, next_review, ease_factor
timetable_blocks id, user_id, subject_id FK, …
past_papers      id, user_id, subject_id FK, year, series, paper_number, type, url, title
```

---

## Local development

```bash
npm install
npm run dev        # → http://localhost:5173
```

Env vars needed (`.env.local`):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

> Always run `npm run build` before `git push` — Vercel builds from source on every push to `main`.

---

## Roadmap

### Quick wins
- [x] Collapsible sidebar
- [x] Audio chime on timer end
- [x] Command palette (`Ctrl+K`)
- [ ] Nav Subjects "+" → inline add-subject panel
- [ ] Filter bar "+ Tag" → subject picker dropdown

### Medium
- [ ] Nav routing — Streak and Today navigate to dedicated views
- [ ] Right rail Week tab — 7-day bar chart + weekly total
- [ ] Right rail All-time tab — lifetime totals + per-subject breakdown
- [ ] Mobile UI — responsive below 900 px; bottom tab bar
- [ ] Focus mode — hides sidebar + rail; `F` shortcut

### Big features
- [ ] **Stats dashboard** — daily/weekly/monthly focus time, per-subject charts, streak heatmap
- [ ] **Notes** — rich-text editor linked to subjects; searchable library
- [ ] **Flashcards** — SM-2 spaced repetition; Anki import/export
- [ ] **Timetable** — dnd-kit weekly schedule grid
- [ ] **Past Papers** — Edexcel IAL library; QP + MS paired; in-app PDF viewer
