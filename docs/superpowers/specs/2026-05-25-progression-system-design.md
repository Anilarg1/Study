# Progression System Design

**Date:** 2026-05-25
**Status:** Approved for implementation planning

## Overview

A dual-axis MMO-style progression system designed to motivate users who have the desire to study but lack consistency. Two independent but complementary systems: a **global Scholar rank** that reflects total study effort, and **per-subject Flame mastery** that reflects depth in individual subjects. Neither replaces the other — rank is identity, mastery is expertise.

Design constraint: the app should not feel completely gamified. Progression is visible but subtle. The study experience remains primary.

---

## 1. XP Formula (Breaking Change)

The current flat 25 XP per session is replaced with a duration-proportional formula. This change is foundational — subject mastery depends on it.

### New Formula

**Sessions under 25 minutes** (below the Pomodoro default):
```
XP = floor(durationMins × 1)
```
1 XP per minute, flat. No bonus. Short sessions are still rewarded, just not amplified.

**Sessions 25 minutes and over:**
```
XP = floor(durationMins^1.5 / 5)
```
Continuous at the 25-minute threshold (25^1.5 / 5 = 25 XP exactly). Grows super-linearly — a 90-minute session earns ~171 XP, roughly the same as seven Pomodoros.

**Reference values:**
| Duration | XP |
|---|---|
| 10 min | 10 |
| 25 min | 25 |
| 50 min | 71 |
| 90 min | 171 |
| 120 min | 263 |

### Streak Multiplier

Applied after the base formula. Rewards consistent daily attendance over raw session length.

| Current Streak | Multiplier |
|---|---|
| 1–2 days | 1× |
| 3–6 days | 1.2× |
| 7–29 days | 1.5× |
| 30+ days | 2× |

**Full formula:**
```
XP = floor(baseXP × streakMultiplier)
```

### Break Sessions

Short and long break sessions remain flat (5 XP and 10 XP respectively). They do not contribute to subject mastery — only work sessions do.

### Historical Migration

All existing sessions have `duration_secs` stored. On migration, recalculate XP for all historical sessions using the **base formula only** (no streak multiplier — we cannot retroactively know the streak state at the time of each past session). Sessions with `duration_secs = null` keep their existing XP (legacy). The streak multiplier applies only to new sessions going forward.

---

## 2. Global Rank — Scholar's Path

A single global rank derived from total XP. 10 named tiers × 3 sub-levels = **30 total ranks**. Each tier has a distinct angular metallic SVG badge.

### Tier Names & Thresholds

Pacing is front-loaded: early tiers are fast to reward new users and build habit. Late tiers slow down significantly — users past ~500 hours are already hooked.

| Tier | Name | Sub-level Hours |
|---|---|---|
| 1 | Wanderer | I: 3h · II: 8h · III: 15h |
| 2 | Seeker | I: 25h · II: 38h · III: 54h |
| 3 | Initiate | I: 75h · II: 100h · III: 130h |
| 4 | Apprentice | I: 165h · II: 205h · III: 250h |
| 5 | Scholar | I: 300h · II: 355h · III: 415h |
| 6 | Adept | I: 480h · II: 560h · III: 650h |
| 7 | Savant | I: 800h · II: 975h · III: 1150h |
| 8 | Sage | I: 1350h · II: 1580h · III: 1830h |
| 9 | Master | I: 2100h · II: 2400h · III: 2700h |
| 10 | Luminary | I: 3000h · II: 3400h · III: 3800h |

Thresholds are expressed in hours for readability; implementation uses XP values derived from the formula (assuming average session quality, no streak bonus).

**Key pacing landmarks:**
- 6 rank-ups in the first month of consistent use
- Scholar by end of first year (~1 hr/day)
- Adept at ~500h — the "hooked" threshold where motivation is self-sustaining
- Luminary III at ~3800h — elite endgame, achievable in ~5 years

### Badge Design Language

Angular, sharp, metallic. Dark `#0d1117` fill, colored glowing outlines, geometric inner symbols. Each tier has a distinct silhouette that grows more ornate:

- **Wanderer** — thin diamond outline, compass cross, slate grey
- **Seeker** — cut-corner octagon, upward chevrons, blue
- **Initiate** — angular downward shield, flame triangle, indigo
- **Apprentice** — shield with top notches, diamond center, purple
- **Scholar** — heraldic shield, 6-pointed star, violet
- **Adept** — elongated hexagon with diagonal cuts, split gem, fuchsia
- **Savant** — winged shield with sharp tabs, 8-pointed star, rose/pink
- **Sage** — sharp 12-pointed sun star, inner diamond, orange
- **Master** — crown-topped shield with jewel points, amber/gold
- **Luminary** — radiant diamond with outer rays, center star, bright gold with glow — the only badge that bleeds outside its bounding shape

### Sub-level Indication

Each rank's badge is displayed with 3 pip dots beneath it (●●○ for sub-level II, etc.). No separate artwork per sub-level — the same badge, different pip count.

---

## 3. Subject Mastery — Flame System

Every XP earned in a work session flows into **two pools simultaneously**: the global XP total (for rank) and the subject's own XP pool (for mastery). Subject mastery tiers are thresholds on subject XP.

Break sessions do not contribute to subject mastery.

### Mastery Tiers

5 tiers, named after stages of fire. Distinct from rank names and badge shapes by design.

| Tier | Name | Approx. Subject Hours |
|---|---|---|
| 1 | Ember | 0 – 10h |
| 2 | Kindled | 10 – 30h |
| 3 | Burning | 30 – 75h |
| 4 | Blazing | 75 – 150h |
| 5 | Inferno | 150h+ |

### Badge Design Language

Diamond-shaped fire badges, distinct from the angular rank shields. Each badge shows a stylised flame inside a diamond outline. Color escalates from grey → orange → deep gold, with glow effects growing at higher tiers. The five designs are: dim ember (grey), simple flame (orange), bright flame with inner white (gold), heptagonal blazing badge with double flame (bright gold), and a 12-pointed burst with full glow (white core).

Sessions with no subject assigned do not count toward any subject mastery pool.

---

## 4. Rank-up Moments

Rank-ups should feel earned, not spammy. Two tiers of celebration:

**Sub-level rank-up** (e.g., Wanderer I → Wanderer II):
- A subtle toast notification in the bottom-right: badge icon + new rank name
- Fades after 4 seconds
- No sound, no animation beyond the toast appearing

**Tier rank-up** (e.g., Seeker → Initiate):
- A slightly larger toast with the new tier badge displayed prominently
- Brief badge entrance animation (scale up from 0.8 to 1.0)
- Optional: a single soft chime using the existing chime system

No full-screen takeovers, no confetti, no XP number floating animations. The user is studying — we don't interrupt.

---

## 5. UI Placement

### Sidebar
Below the user's name: small rank badge (32px) + rank name in muted text + a thin progress bar to the next sub-level. Compact, always visible, never dominant.

### Subject List
Each subject row gets a small mastery badge (20px) + mastery tier name to the right of the subject name. E.g., `Mathematics  🔥 Blazing`. Only shown if the subject has at least one session (Ember is hidden until first session logged).

### Stats Page — Progression Card
A new card on the Stats page showing:
- Current rank badge (large, 64px) + full rank name + XP to next sub-level
- Subject mastery table: each subject with its flame badge and tier name
- Total qualifying study hours

### Timer
No changes. The timer remains clean and distraction-free.

---

## 6. Data Model Changes

### New fields / tables

**`subject_xp` table** (new):
```sql
subject_id  uuid references subjects(id)
user_id     uuid references auth.users(id)
xp          integer not null default 0
primary key (user_id, subject_id)
```

**`user_rank` view or computed field** (derived from `sum(sessions.xp)` — no new storage needed for global rank).

### Migration

1. Recalculate `xp` on all existing sessions using the new formula (where `duration_secs` is not null).
2. Backfill `subject_xp` from historical sessions grouped by `subject_id`.
3. Sessions with `duration_secs = null` keep original XP.

---

## 7. Out of Scope

The following features were discussed and parked for later:

- Achievements & badges (milestone recognition)
- Daily / weekly challenges
- Unlockable cosmetics

See `docs/superpowers/plans/2026-05-25-motivation-backlog.md`.
