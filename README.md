# Late Fee

A browser-based video rental store sim set in the early 90s. You work the counter at **On Rewind Video** — customers walk up, drop a vague request, and you've got two minutes to match them with the right tape.

## Gameplay

| Action | Effect |
|--------|--------|
| **RENT IT** | +$3.00 per successful rental |
| **CAN'T FIND IT** | Miss — breaks your streak |
| **3x Streak** | 1.5× earnings multiplier |
| **Shift length** | 2 minutes |

Customers describe what they want in dialogue rather than asking for a title directly. You get a suggested movie to go with it — rent it or pass.

## Tech Stack

| Tool | Version |
|------|---------|
| [Phaser 3](https://phaser.io/) | ^3.80 |
| TypeScript | ^5.0 |
| Vite | ^5.0 |

Portrait layout: **480 × 854** (mobile-first, scales to desktop via `Phaser.Scale.FIT`).

## Getting Started

```bash
npm install
npm run dev      # opens Chrome automatically
npm run build    # production build → dist/
npm run preview  # preview the production build locally
```

Requires Node 18+.

## Project Structure

```
src/
  main.ts              # Phaser game config & entry point
  scenes/
    BootScene.ts       # asset loading (placeholder for future sprites)
    GameScene.ts       # all core game logic
  data/
    movies.ts          # 90s film catalog
    customers.ts       # customer archetypes & dialogue
  types/
    index.ts           # shared TypeScript interfaces
```

## Current Movie Catalog

20 titles spanning 1990–1994: *Terminator 2*, *Home Alone*, *The Lion King*, *Pulp Fiction*, *Jurassic Park*, *Forrest Gump*, *Clerks*, and more.

## Current Customers

10 regulars including Chad (explosions), Karen (Forrest Gump, always), Todd (horror for his girlfriend), Mike (anything Arnold), and Tiffany (looking for Clerks because she heard it's about a video store).

---

## Upcoming Development

### Phase 1 — Core Gameplay Polish

Foundational improvements that make the game feel complete.

- [ ] **Difficulty scaling** — customers get pickier or arrive faster as the shift progresses
- [ ] **Genre matching / scoring** — bonus points for nailing the genre hint vs. a cold suggestion
- [ ] **Inventory system** — some movies are already checked out; can't rent what isn't on the shelf
- [ ] **High score / local storage** — persist best earnings and streak between sessions
- [ ] **Sound effects** — checkout ding, miss buzz, door chime, VHS rewind
- [ ] **Background music** — lo-fi 90s store ambiance loop
- [ ] **Intro / tutorial screen** — first-time player onboarding
- [ ] **Expanded catalog** — more movies, more genres (foreign, documentary, cult)
- [ ] **Expanded customer roster** — more archetypes, more personality variety

### Phase 2 — Advanced Gameplay

Mechanics that add depth and replayability.

- [ ] **Customer patience meter** — wait too long and they walk
- [ ] **Multiple shifts / levels** — each shift ups the difficulty and customer volume
- [ ] **Random events** — late rush, holiday weekend, the guy who argues every suggestion
- [ ] **Late fee mechanic** — customers returning overdue tapes; collect or waive?
- [ ] **Daily specials** — featured titles that earn a bonus for the shift
- [ ] **Reputation system** — satisfy regulars to unlock loyalty perks; fail them enough and they stop coming in
- [ ] **Employee upgrades** — spend earnings on perks (faster transactions, hints, extra shelf space)
- [ ] **Achievements** — unlock badges for streaks, genre mastery, serving every customer type
- [ ] **Character select** — different clerks with passive bonuses (movie buff, people pleaser, speed runner)

### Phase 3 — Technical Stretch Goals

Bigger lifts that would meaningfully improve the game or codebase.

- [ ] **Pixel art assets** — replace the programmatic Phaser graphics with proper sprite sheets and animations
- [ ] **Procedural customer generator** — randomized names, colors, and dialogue combinations so no two shifts feel the same
- [ ] **PWA / offline support** — installable as a home screen app, playable without a connection
- [ ] **Online leaderboard** — backend score submission with weekly / all-time boards
- [ ] **Mobile app wrapper** — package with Capacitor for App Store / Play Store distribution
- [ ] **Accessibility pass** — keyboard navigation, screen reader support, reduced-motion mode
- [ ] **Co-op mode** — two players on one shift; one handles customer dialogue, one manages the shelves
- [ ] **Save system** — unlock persistent progress across multiple sessions (career mode)
