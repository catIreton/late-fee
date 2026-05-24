# Late Fee

A browser-based video rental store sim set in the early 90s. You work the counter at **On Rewind Video** — customers walk up, drop a vague request, and you've got two minutes to match them with the right tape.

## Gameplay

| Action | Effect |
|--------|--------|
| **RENT IT** | +$3.00 per successful rental |
| **Genre Match** | +$1.50 bonus when the suggestion fits what they're looking for |
| **Daily Special** | +$2.00 extra bonus for renting a featured title |
| **CAN'T FIND IT** | Miss — breaks your streak |
| **3× Streak** | 1.5× earnings multiplier |
| **COLLECT late fee** | +$2.00 + 1 rep |
| **WAIVE late fee** | +3 rep (goodwill) |
| **Shift length** | 2 minutes, escalating difficulty each shift |

Customers arrive and show a **?** bubble above their head. Walk up and tap them to hear what they want, then pick the right genre section and choose a tape. Late-fee return visits show a **$** bubble instead; tap to COLLECT or WAIVE the fee. Some tapes are already checked out. A patience bar drains above the customer — serve them before they leave. Every 1-2 shifts a random event (Late Rush, Holiday Weekend…) shakes things up. Between shifts you can spend career earnings on upgrades.

## Tech Stack

| Tool | Version |
|------|---------|
| [Phaser 3](https://phaser.io/) | ^3.80 |
| TypeScript | ^5.0 |
| Vite | ^5.0 |
| Vitest | ^2.0 |

Portrait layout: **480 × 854** (mobile-first, scales to desktop via `Phaser.Scale.FIT`).

## Getting Started

```bash
npm install
npm run dev      # opens Chrome automatically
npm run build    # production build → dist/
npm run preview  # preview the production build locally
npm test         # run unit tests (vitest)
npm run deploy   # build + push to GitHub Pages
```

Requires Node 18+.

## Project Structure

```
src/
  main.ts              # Phaser game config & entry point
  scenes/
    BootScene.ts             # asset loading; routes to CharacterSelectScene
    CharacterSelectScene.ts  # clerk picker (Alex / Sam / Chris)
    BetweenShiftScene.ts     # shift summary + employee upgrades
    GameScene.ts             # all core game logic
  data/
    movies.ts          # 90s film catalog (40 titles, 10 genres)
    customers.ts       # customer archetypes & dialogue (20 characters, browser/help-seeker)
    clerks.ts          # 3 playable clerks with passive bonuses
    events.ts          # random shift event definitions
    achievements.ts    # achievement definitions (8 badges)
    upgrades.ts        # employee upgrade definitions (3 perks)
  types/
    index.ts           # shared TypeScript interfaces
  utils/
    scoring.ts         # pure scoring functions + shift config + clerk/event bonuses
    inventory.ts       # pure inventory functions (pickMovie, getInitialCheckedOut)
    sound.ts           # Web Audio procedural sound engine
    achievements.ts    # achievement check logic + localStorage helpers
    reputation.ts      # rep tiers, patience bonus, localStorage helpers
    events.ts          # shift event rolling + effect application
    upgrades.ts        # upgrade localStorage helpers (shared by GameScene + BetweenShiftScene)
  __tests__/
    movies.test.ts
    customers.test.ts
    scoring.test.ts
    inventory.test.ts
    clerks.test.ts
    achievements.test.ts
    reputation.test.ts
    events.test.ts
    upgrades.test.ts
```

## Movie Catalog

40 titles spanning 1990–1994 across 10 genres: Action, Comedy, Drama, Crime, Sci-Fi, Animation, Horror, Thriller, Romance, Western.

*Terminator 2, Pulp Fiction, Goodfellas, The Silence of the Lambs, Forrest Gump, Jurassic Park, The Lion King, Ghost, Unforgiven, Clerks,* and 30 more.

## Customer Roster

20 regulars — Chad (explosions), Karen (Forrest Gump, always), Todd (horror for his girlfriend), Gary (westerns only), Donna (thriller twists), and 15 others — each with a genre hint that drives matching and bonus scoring.

---

## Development Phases

### Phase 1 — Core Gameplay Polish ✅

- [x] **Difficulty scaling** — customer pace increases over the 2-minute shift
- [x] **Genre matching / scoring** — +$1.50 bonus when the suggestion fits the customer's genre hint
- [x] **Inventory system** — 4 tapes start checked out each shift; rented tapes leave the shelf
- [x] **High score / local storage** — best earnings and streak persisted between sessions
- [x] **Sound effects** — checkout ding, miss buzz, door chime, VHS rewind (Web Audio, no assets)
- [x] **Background music** — lo-fi Dm drone + vinyl crackle ambient loop
- [x] **Intro / tutorial screen** — first-time employee handbook; returning players see their best
- [x] **Expanded catalog** — 40 titles, 10 genres (including Thriller, Romance, Western)
- [x] **Expanded customer roster** — 20 archetypes with personality and genre preference

### Phase 2 — Advanced Gameplay ✅

Mechanics that add depth and replayability.

- [x] **Customer patience meter** — draining colour bar above the customer; they walk if you take too long
- [x] **Multiple shifts / levels** — each shift ups the difficulty (more checked-out tapes, faster spawns, less patience); `BetweenShiftScene` bridges shifts
- [x] **Random events** — Late Rush, Holiday Weekend, Difficult Customer, Summer Rush; rolled at shift start and shown in the HUD
- [x] **Late fee mechanic** — returning customers appear 20% of the time; COLLECT $2 or WAIVE for rep points
- [x] **Daily specials** — 2 featured titles picked each shift; renting them earns a +$2.00 bonus (shown with ★ in the movie list)
- [x] **Reputation system** — serve customers / collect or waive fees to earn rep; tiers (New Hire → Regular → Trusted → Local Legend) grant patience bonuses and persist across sessions
- [x] **Employee upgrades** — spend career earnings on Speedy Service, Genre Guide, or Stocked Shelves between shifts
- [x] **Achievements** — 8 badges (Hot Streak, On Fire, VHS Legend, Genre Master, Clean Sheet, Late Fee King, Daily Special, Regular Hero); toast notification on unlock
- [x] **Character select** — Alex (Movie Buff), Sam (People Pleaser), Chris (Speed Runner) — each with a passive bonus; selected once per session
- [x] **Customer behavior types** — browsers linger at the shelves before approaching; help-seekers walk straight to the counter

### Phase 3 — Technical Stretch Goals

Bigger lifts that would meaningfully improve the game or codebase.

- [ ] **Pixel art assets** — replace the programmatic Phaser graphics with hand-drawn sprite sheets made in [Aseprite](https://www.aseprite.org/). Art to create: top-down store tileset (carpet, shelf tops, counter, walls), customer character sprites (overhead walk cycle, per-customer color variants), UI elements (card border, button frames, HUD icons), and the adult section with its bead curtain. Export from Aseprite as indexed PNG sprite sheets; load via `BootScene.ts` (`this.load.image` / `this.load.spritesheet`), then swap the `g.fillRect` calls in `drawBackground()` and `drawCustomer()` for `this.add.image` / `this.add.sprite` references.
- [ ] **Procedural customer generator** — randomized names, colors, and dialogue combinations so no two shifts feel the same
- [ ] **PWA / offline support** — installable as a home screen app, playable without a connection
- [ ] **Online leaderboard** — backend score submission with weekly / all-time boards
- [ ] **Mobile app wrapper** — package with Capacitor for App Store / Play Store distribution
- [ ] **Accessibility pass** — keyboard navigation, screen reader support, reduced-motion mode
- [ ] **Co-op mode** — two players on one shift; one handles customer dialogue, one manages the shelves
- [ ] **Save system** — unlock persistent progress across multiple sessions (career mode)
