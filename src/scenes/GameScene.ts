import Phaser from 'phaser';
import { MOVIES } from '../data/movies';
import { CUSTOMERS } from '../data/customers';
import { CLERKS } from '../data/clerks';
import type { Movie, CustomerData, Clerk, RandomEventDef, ShiftStats } from '../types';
import { SoundEngine } from '../utils/sound';
import {
  calcEarnings, isGenreMatch, spawnDelay,
  applyClerkBonus, applyEventBonus,
  calcLateFee, calcDailySpecialBonus,
  getShiftConfig,
  BASE_RENTAL_FEE, LATE_FEE_AMOUNT,
} from '../utils/scoring';
import { getInitialCheckedOut, availableCount } from '../utils/inventory';
import {
  checkAchievements, loadEarnedAchievements, saveEarnedAchievements, getAchievementName,
} from '../utils/achievements';
import {
  loadReputation, saveReputation,
  loadCustomerVisits, saveCustomerVisits,
  loadTotalFeesCollected, saveTotalFeesCollected,
  getRepTier, repPatienceBonus, addRep,
  REP_SERVE, REP_WAIVE_FEE, REP_COLLECT, REP_MISS,
} from '../utils/reputation';
import { rollShiftEvent } from '../utils/events';
import { loadUpgrades } from '../utils/upgrades';

const W = 480;
const H = 854;

// ── Store layout constants ────────────────────────────────────────────────────
const ADULT_TOP  = 104;
const ADULT_BOT  = 172;
const WALL_BOT   = 188;
const COUNTER_Y  = 406;
const COUNTER_H  = 28;
const STORE_BOT  = 460;
const DOOR_TOP   = 398;
const DOOR_BOT   = 440;

// localStorage keys
const LS_HIGH     = 'lateFee_highScore';
const LS_STREAK   = 'lateFee_bestStreak';
const LS_TUTORIAL = 'lateFee_tutorialDone';
const LS_CLERK    = 'lateFee_clerkId';

// Genre layout
const GENRE_ROWS: [string, string, string, string, string][] = [
  ['Action', 'Comedy', 'Drama', 'Crime', 'Sci-Fi'],
  ['Animation', 'Horror', 'Thriller', 'Romance', 'Western'],
];
const GENRE_BTN_XS = [53, 146, 239, 332, 425];

enum State { Ready, Idle, Arriving, Waiting, Selecting, Leaving, Over }

// ── Player / movement constants ───────────────────────────────────────────────
const DOOR_POS    = { x: 14,  y: 420 };
const PLAYER_HOME = { x: 240, y: 428 };
const REWIND_POS  = { x: 394, y: 210 };
const NEW_RELEASES_MIN_YEAR = 1993;
const INTERACT_DIST   = 66;
const REWIND_SECS     = 3;
const MAX_BROWSERS    = 3;

// Shelf-browsing spots for browser customers
const SHELF_SLOTS = [
  { x: 128, y: 308 },
  { x: 240, y: 308 },
  { x: 352, y: 308 },
] as const;

// Reaction lines
const RX_EXACT = ['PERFECT!', "Yes! That's the one!", '★ You know your stuff!'];
const RX_MATCH = ['Thanks!', "That'll work!", 'Grab it!'];
const RX_ALT   = ['Eh, close enough.', 'I guess that works.'];

// ── Per-browser-customer state ─────────────────────────────────────────────────
enum BrowserState { Arriving, AtShelf, BeingHelped, Leaving }

interface BrowserCustomer {
  data: CustomerData;
  state: BrowserState;
  container: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Container | null;
  bubbleTween: Phaser.Tweens.Tween | null;
  shelfSlot: number;
}

// ── Scene data received from other scenes ────────────────────────────────────
interface SceneData {
  shiftNumber?: number;
  clerkId?: string;
  reputation?: number;
  totalScore?: number;
}

export class GameScene extends Phaser.Scene {
  // Core game state
  private state      = State.Ready;
  private score      = 0;
  private streak     = 0;
  private peakStreak = 0;
  private timeLeft   = 120;
  private shiftNumber = 1;

  // Persistent / cross-shift data
  private clerk:        Clerk | null = null;
  private highScore  = 0;
  private bestStreak = 0;
  private reputation = 0;
  private customerVisits: Record<string, number> = {};
  private earnedAchievements: Set<string> = new Set();
  private ownedUpgrades: Set<string> = new Set();
  private totalFeesCollected = 0;

  // Shift-specific
  private checkedOut   = new Set<string>();
  private dailySpecials: string[] = [];
  private activeEvent: RandomEventDef | null = null;
  private eventConsumed = false; // for one-shot patience_drain events

  // Stats for achievement checking
  private shiftStats: ShiftStats = this.blankStats();

  private sfx!: SoundEngine;

  // HUD text refs
  private scoreText!:    Phaser.GameObjects.Text;
  private timeText!:     Phaser.GameObjects.Text;
  private streakText!:   Phaser.GameObjects.Text;
  private stockText!:    Phaser.GameObjects.Text;
  private repText!:      Phaser.GameObjects.Text;
  private specialsText!: Phaser.GameObjects.Text;
  private eventText!:    Phaser.GameObjects.Text;

  // Customer visuals
  private customerGfx!:        Phaser.GameObjects.Graphics;
  private customerNameLabel!:  Phaser.GameObjects.Text;
  private patienceMeterGfx!:   Phaser.GameObjects.Graphics;

  // Request card
  private cardGfx!:      Phaser.GameObjects.Graphics;
  private cardName!:     Phaser.GameObjects.Text;
  private cardDialogue!: Phaser.GameObjects.Text;
  private cardGenre!:    Phaser.GameObjects.Text;

  // Current customer
  private currentCustomer!: CustomerData;
  private customerQueue: CustomerData[] = [];
  private isLateFeeVisit = false;
  private lateFeeTitle   = '';

  // Patience timer
  private patienceTimer: Phaser.Time.TimerEvent | null = null;
  private patienceTotal = 0;
  private patienceLeft  = 0;

  // Dynamic UI
  private genreObjs:  Phaser.GameObjects.GameObject[] = [];
  private panelObjs:  Phaser.GameObjects.GameObject[] = [];
  private lateFeeObjs: Phaser.GameObjects.GameObject[] = [];

  private readonly customerPos = { x: -80 };
  private readonly CUSTOMER_X  = 148;
  private readonly CUSTOMER_Y  = 424;
  private readonly SHELF_X     = 280; // browser pauses here

  // ── Player ──
  private player       = { ...PLAYER_HOME };
  private playerGfx!:  Phaser.GameObjects.Graphics;
  private playerLabel!: Phaser.GameObjects.Text;
  private playerTween: Phaser.Tweens.Tween | null = null;
  private rewinding    = false;
  private rewindMachGfx!: Phaser.GameObjects.Graphics;
  private returnPile   = 0;
  private returnPileText!: Phaser.GameObjects.Text;

  // ── Browser customers ──
  private browsers:      BrowserCustomer[] = [];
  private shelfSlotsOcc: Set<number>       = new Set();
  private helpingBrowser: BrowserCustomer | null = null;

  // ── Counter customer interaction bubble ──
  private customerBubble: Phaser.GameObjects.Container | null = null;
  private customerBubbleTween: Phaser.Tweens.Tween | null = null;
  private customerBubbleText: Phaser.GameObjects.Text | null = null;
  private customerZone: Phaser.GameObjects.Zone | null = null;
  private waitingForInteraction = false;

  constructor() { super({ key: 'GameScene' }); }

  // ── Init (receives data from CharacterSelectScene / BetweenShiftScene) ──────
  init(data: SceneData) {
    this.shiftNumber = data.shiftNumber ?? 1;
    const clerkId = data.clerkId ?? this.loadClerkId();
    this.clerk = CLERKS.find(c => c.id === clerkId) ?? CLERKS[0];
    this.reputation = data.reputation ?? loadReputation();
  }

  // ── Create ────────────────────────────────────────────────────────────────
  create() {
    const cfg = getShiftConfig(this.shiftNumber);

    this.score      = 0;
    this.streak     = 0;
    this.peakStreak = 0;
    this.timeLeft   = cfg.durationSeconds;
    this.state      = State.Ready;
    this.shiftStats = this.blankStats();
    this.isLateFeeVisit = false;
    this.eventConsumed  = false;

    this.customerQueue = Phaser.Utils.Array.Shuffle([...CUSTOMERS, ...CUSTOMERS]);
    this.ownedUpgrades = loadUpgrades();

    // Shelves bonus
    const shelveUpg = this.ownedUpgrades.has('stocked_shelves') ? 2 : 0;
    this.checkedOut  = getInitialCheckedOut(MOVIES, Math.max(0, cfg.initialCheckedOut - shelveUpg));

    this.highScore   = this.loadStat(LS_HIGH);
    this.bestStreak  = this.loadStat(LS_STREAK);
    this.earnedAchievements = loadEarnedAchievements();
    this.customerVisits     = loadCustomerVisits();
    this.totalFeesCollected = loadTotalFeesCollected();

    this.sfx = new SoundEngine((this.sound as any).context as AudioContext ?? null);

    // Roll random event for this shift
    this.activeEvent = rollShiftEvent();

    // Pick 2 daily specials
    const available = MOVIES.filter(m => !this.checkedOut.has(m.title));
    const shuffled  = Phaser.Utils.Array.Shuffle([...available]);
    this.dailySpecials = (shuffled as Movie[]).slice(0, 2).map(m => m.title);

    this.player       = { ...PLAYER_HOME };
    this.rewinding    = false;
    this.returnPile   = 0;
    this.browsers     = [];
    this.shelfSlotsOcc.clear();
    this.helpingBrowser = null;

    this.drawBackground();
    this.createHUD();
    this.createCustomerLayer();
    this.createPlayerSprite();
    this.createRequestCard();
    this.setupInput();
    this.updateStockText();
    this.updateRepText();
    this.updateSpecialsText();

    this.time.delayedCall(350, () => this.showOpenOverlay());
  }

  // ── Open overlay ──────────────────────────────────────────────────────────
  private showOpenOverlay(): void {
    const objs: Phaser.GameObjects.GameObject[] = [];
    const firstTime = !this.loadBool(LS_TUTORIAL);

    const bg = this.add.graphics().setDepth(4);
    bg.fillStyle(0x000000, 0.65);
    bg.fillRect(0, ADULT_TOP, W, STORE_BOT - ADULT_TOP);
    objs.push(bg);

    const cords = this.add.graphics().setDepth(5);
    cords.fillStyle(0x777777);
    cords.fillRect(W / 2 - 68, ADULT_TOP + 4, 2, 30);
    cords.fillRect(W / 2 + 66, ADULT_TOP + 4, 2, 30);
    objs.push(cords);

    const signG = this.add.graphics().setDepth(5);
    signG.fillStyle(0x8b0000);
    signG.fillRoundedRect(W / 2 - 70, ADULT_TOP + 34, 140, 50, 7);
    signG.fillStyle(0xcc2222);
    signG.fillRoundedRect(W / 2 - 70, ADULT_TOP + 34, 140, 4, { tl: 7, tr: 7, bl: 0, br: 0 });
    signG.fillStyle(0x660000);
    signG.fillRect(W / 2 - 70, ADULT_TOP + 80, 140, 4);
    objs.push(signG);

    objs.push(this.add.text(W / 2, ADULT_TOP + 59, 'CLOSED', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '30px', color: '#ffffff', stroke: '#550000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(6));

    if (firstTime) {
      objs.push(this.add.text(W / 2, 218, 'EMPLOYEE HANDBOOK', {
        fontFamily: '"Courier New", monospace',
        fontSize: '13px', color: '#f5a623', letterSpacing: 2,
      }).setOrigin(0.5).setDepth(5));

      const rules = [
        '• Customer walks up and asks for something',
        '• Pick the right genre section',
        '• Choose a tape — wrong genre = miss',
        '',
        '  Correct pick       $3.00',
        '  Named the title   +$1.50 bonus',
        '  Daily special     +$2.00 bonus',
        '  3-in-a-row        ×1.5 earnings',
        '',
        '  Late fee: COLLECT $2 or WAIVE for rep',
        '',
        "2 minutes. Don't blow it.",
      ].join('\n');

      objs.push(this.add.text(W / 2, 244, rules, {
        fontFamily: '"Courier New", monospace',
        fontSize: '11px', color: '#cccccc',
        align: 'left', lineSpacing: 5,
      }).setOrigin(0.5, 0).setDepth(5));
    } else {
      const shiftLabel = this.shiftNumber > 1 ? `Shift ${this.shiftNumber}` : 'Ready for your shift?';
      objs.push(this.add.text(W / 2, 250, shiftLabel, {
        fontFamily: '"Courier New", monospace', fontSize: '15px', color: '#dddddd',
      }).setOrigin(0.5).setDepth(5));

      if (this.highScore > 0) {
        objs.push(this.add.text(W / 2, 282, `Best: $${this.highScore.toFixed(2)}`, {
          fontFamily: '"Courier New", monospace', fontSize: '18px', color: '#f5a623',
        }).setOrigin(0.5).setDepth(5));
      }

      if (this.clerk) {
        objs.push(this.add.text(W / 2, 318, `Playing as ${this.clerk.name} · ${this.clerk.title}`, {
          fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#557799',
        }).setOrigin(0.5).setDepth(5));
      }

      if (this.activeEvent) {
        objs.push(this.add.text(W / 2, 350, `EVENT: ${this.activeEvent.name}`, {
          fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#ffaa22',
        }).setOrigin(0.5).setDepth(5));
        objs.push(this.add.text(W / 2, 370, this.activeEvent.banner, {
          fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#998877',
          wordWrap: { width: 380 }, align: 'center',
        }).setOrigin(0.5, 0).setDepth(5));
      }
    }

    const btnY = firstTime ? 432 : (this.activeEvent ? 430 : 392);
    const btn = this.makeBtn(W / 2, btnY, 'OPEN FOR\nBUSINESS', 0x003087, '#f5a623', () => {
      if (firstTime) this.saveBool(LS_TUTORIAL);
      objs.forEach(o => o.destroy());
      btn.destroy();
      (this.sound as any).context?.resume?.();
      this.sfx.startMusic();
      this.sfx.chime();
      this.startTimer();
      this.state = State.Idle;
      this.time.delayedCall(500, () => this.spawnCustomer());
      this.time.delayedCall(2000, () => this.scheduleBrowserSpawn());
    });
    btn.setDepth(5);
  }

  // ── Background ────────────────────────────────────────────────────────────
  private drawBackground(): void {
    const g = this.add.graphics();

    // Adult section
    g.fillStyle(0x180808);
    g.fillRect(0, ADULT_TOP, W, ADULT_BOT - ADULT_TOP);
    g.fillStyle(0x200c0c, 0.7);
    for (let gx = 8; gx < W - 8; gx += 36) g.fillRect(gx, ADULT_TOP, 1, ADULT_BOT - ADULT_TOP);
    for (let gy = ADULT_TOP; gy < ADULT_BOT; gy += 28) g.fillRect(0, gy, W, 1);
    g.fillStyle(0x2a0808);
    g.fillRect(0, ADULT_TOP, W, 8);
    g.fillRect(0, ADULT_TOP, 8, ADULT_BOT - ADULT_TOP);
    g.fillRect(W - 8, ADULT_TOP, 8, ADULT_BOT - ADULT_TOP);
    this.drawShelf(g, 8, ADULT_TOP + 10, W - 16, 20,
      [0xff69b4, 0xff1493, 0xc71585, 0xdc143c, 0xff69b4, 0xff1493, 0xc71585, 0xdc143c], true);
    this.drawShelf(g, 50, ADULT_TOP + 44, W - 100, 20,
      [0xc71585, 0xff69b4, 0xff1493, 0xdc143c, 0xc71585, 0xff69b4, 0xff1493, 0xdc143c], true);

    // Dividing wall + bead curtain
    g.fillStyle(0x2e1a0a);
    g.fillRect(0, ADULT_BOT, W, WALL_BOT - ADULT_BOT);
    const doorX = 188, doorW = 104;
    for (let bx = doorX; bx < doorX + doorW; bx += 9) {
      g.fillStyle(bx % 18 < 9 ? 0x880000 : 0x550000);
      g.fillRect(bx, ADULT_BOT, 8, WALL_BOT - ADULT_BOT);
    }

    // Main floor carpet
    g.fillStyle(0x1c3828);
    g.fillRect(0, WALL_BOT, W, STORE_BOT - WALL_BOT);
    g.fillStyle(0x162e20, 0.7);
    for (let gx = 8; gx < W - 8; gx += 36) g.fillRect(gx, WALL_BOT, 1, COUNTER_Y - WALL_BOT);
    for (let gy = WALL_BOT; gy < COUNTER_Y; gy += 28) g.fillRect(8, gy, W - 16, 1);
    g.fillStyle(0x141e14);
    g.fillRect(0, COUNTER_Y - 26, W, 26 + STORE_BOT - COUNTER_Y);

    // Right side wall
    g.fillStyle(0x2e1a0a);
    g.fillRect(W - 8, WALL_BOT, 8, COUNTER_Y - WALL_BOT);

    // Left wall with door gap
    g.fillStyle(0x2e1a0a);
    g.fillRect(0, WALL_BOT, 8, DOOR_TOP - WALL_BOT);
    g.fillStyle(0x7a5230);
    g.fillRect(0, DOOR_TOP - 3, 10, 4);
    g.fillRect(0, DOOR_BOT, 10, 4);
    g.fillStyle(0x0a1520);
    g.fillRect(0, DOOR_TOP, 5, DOOR_BOT - DOOR_TOP);
    g.fillStyle(0x1e4a6e, 0.5);
    g.fillRect(0, DOOR_TOP + 2, 2, DOOR_BOT - DOOR_TOP - 4);
    g.fillStyle(0x241e0e);
    g.fillRect(9, DOOR_TOP + 10, 20, 22);
    g.fillStyle(0x342e1c);
    g.fillRect(11, DOOR_TOP + 13, 16, 2);
    g.fillRect(11, DOOR_TOP + 18, 16, 2);
    g.fillRect(11, DOOR_TOP + 23, 16, 2);

    // Wall shelves
    this.drawShelf(g, 8, WALL_BOT + 8, 28, COUNTER_Y - WALL_BOT - 16,
      [0x1e90ff, 0xff4500, 0x32cd32, 0xffd700, 0x9400d3, 0xff8c00, 0x00ced1, 0xff69b4], false);
    this.drawShelf(g, W - 36, WALL_BOT + 8, 28, COUNTER_Y - WALL_BOT - 16,
      [0x00ced1, 0xff69b4, 0xffd700, 0x1e90ff, 0x32cd32, 0x9400d3, 0xff4500, 0xff8c00], false);

    // Center shelf rows
    this.drawShelf(g, 64, 218, W - 128, 24,
      [0xff4500, 0xcc2200, 0xff6633, 0xdd3311, 0xff5500, 0xffd700, 0xffcc00, 0xffe033, 0xffbb00, 0xffdd22], true);
    this.drawShelf(g, 64, 272, W - 128, 24,
      [0x1e90ff, 0x0077dd, 0x2299ff, 0x1188ee, 0x1e80ee, 0x9400d3, 0x7700bb, 0xaa11dd, 0x8800cc, 0x9900d3], true);
    this.drawShelf(g, 64, 326, W - 128, 24,
      [0x32cd32, 0x229922, 0x3dd33d, 0x22aa22, 0x32cc32, 0xff8c00, 0x00ced1, 0xffd700, 0xff69b4, 0xff4500], true);

    // Counter
    g.fillStyle(0x9b7a28);
    g.fillRect(96, COUNTER_Y, W - 112, COUNTER_H);
    g.fillStyle(0xc49a38);
    g.fillRect(96, COUNTER_Y, W - 112, 3);
    g.fillStyle(0x4a2e10);
    g.fillRect(96, COUNTER_Y + COUNTER_H, W - 112, 5);
    g.fillStyle(0x1a1a1a);
    g.fillRoundedRect(W - 106, COUNTER_Y + 5, 76, COUNTER_H - 8, 3);
    g.fillStyle(0x00aa44);
    g.fillRect(W - 98, COUNTER_Y + 10, 46, 7);
    g.fillStyle(0x00ff66, 0.12);
    g.fillRect(W - 100, COUNTER_Y + 9, 50, 9);

    // Logo bar
    g.fillStyle(0x003087);
    g.fillRect(0, 0, W, 64);
    g.fillStyle(0xf5a623);
    g.fillRect(0, 60, W, 8);

    this.add.text(W / 2, 26, 'ON REWIND', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '40px', color: '#f5a623', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, 54, 'VIDEO', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '13px', color: '#ffffff', letterSpacing: 10,
    }).setOrigin(0.5);
    this.add.text(W / 2, ADULT_TOP + 3, '★  ADULTS ONLY  ★', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '12px', color: '#ff69b4', stroke: '#180808', strokeThickness: 2,
    }).setOrigin(0.5, 0);

    const lStyle = { fontFamily: '"Courier New", monospace', fontSize: '8px', color: '#88aa88' };
    this.add.text(42, 207, 'ACTION / COMEDY', lStyle);
    this.add.text(42, 261, 'DRAMA / SCI-FI',  lStyle);
    this.add.text(42, 315, 'HORROR / MISC',   lStyle);

    this.add.text(W / 2, H - 22, 'Be Kind, Rewind', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#556677', fontStyle: 'italic',
    }).setOrigin(0.5);

    this.drawRewindMachine();
  }

  private drawRewindMachine(): void {
    this.rewindMachGfx = this.add.graphics().setDepth(3);
    const { x, y } = REWIND_POS;
    const g = this.rewindMachGfx;
    g.fillStyle(0x1a1a2e);
    g.fillRoundedRect(x - 20, y - 12, 40, 24, 4);
    g.fillStyle(0x222244);
    g.fillRoundedRect(x - 18, y - 10, 36, 10, 3);
    g.fillStyle(0x00aa66);
    g.fillRect(x - 14, y - 8, 24, 6);
    g.fillStyle(0x00ff99, 0.15);
    g.fillRect(x - 16, y - 9, 28, 8);
    g.fillStyle(0x333366);
    g.fillCircle(x + 12, y + 6, 5);
    g.fillStyle(0x555588);
    g.fillCircle(x + 12, y + 6, 3);
    g.setInteractive(new Phaser.Geom.Rectangle(x - 22, y - 14, 44, 28), Phaser.Geom.Rectangle.Contains);
    g.on('pointerover', () => { g.setAlpha(0.75); this.game.canvas.style.cursor = 'pointer'; });
    g.on('pointerout',  () => { g.setAlpha(1);    this.game.canvas.style.cursor = 'default'; });
    g.on('pointerdown', (ptr: Phaser.Input.Pointer) => { ptr.event.stopPropagation(); this.tryRewind(); });

    this.add.text(x, y - 20, 'REWIND', {
      fontFamily: '"Courier New", monospace', fontSize: '8px', color: '#445566',
    }).setOrigin(0.5).setDepth(3);

    this.returnPileText = this.add.text(x, y + 18, '', {
      fontFamily: '"Courier New", monospace', fontSize: '10px', color: '#ff6644',
    }).setOrigin(0.5).setDepth(3);
  }

  private drawShelf(
    g: Phaser.GameObjects.Graphics,
    x: number, y: number, width: number, height: number,
    colors: number[], horizontal: boolean,
  ): void {
    g.fillStyle(0x4a3015);
    g.fillRect(x, y, width, height);
    g.fillStyle(0x2a1808);
    if (horizontal) {
      g.fillRect(x, y, width, 3);
      g.fillRect(x, y + height - 2, width, 2);
    } else {
      g.fillRect(x, y, 3, height);
      g.fillRect(x + width - 2, y, 2, height);
    }
    let ci = 0;
    if (horizontal) {
      let bx = x + 2;
      while (bx + 9 <= x + width - 2) {
        g.fillStyle(colors[ci % colors.length]);
        g.fillRect(bx, y + 3, 9, height - 5);
        bx += 10; ci++;
      }
    } else {
      let by = y + 2;
      while (by + 9 <= y + height - 2) {
        g.fillStyle(colors[ci % colors.length]);
        g.fillRect(x + 3, by, width - 5, 9);
        by += 10; ci++;
      }
    }
  }

  // ── Player ────────────────────────────────────────────────────────────────
  private createPlayerSprite(): void {
    this.playerGfx = this.add.graphics().setDepth(8);
    this.playerLabel = this.add.text(0, 0, 'YOU', {
      fontFamily: '"Courier New", monospace', fontSize: '9px',
      color: '#88ccff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(8);
    this.redrawPlayer();
  }

  private redrawPlayer(): void {
    const { x, y } = this.player;
    const g = this.playerGfx;
    g.clear();
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(x + 2, y + 6, 28, 12);
    g.fillStyle(0x2255bb);
    g.fillCircle(x, y, 13);
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(x - 4, y - 4, 5);
    g.fillStyle(0xf5cba7);
    g.fillCircle(x, y - 5, 8);
    g.fillStyle(0x333333);
    g.fillCircle(x - 3, y - 6, 1.5);
    g.fillCircle(x + 3, y - 6, 1.5);
    this.playerLabel.setPosition(x, y + 17);
  }

  private movePlayer(tx: number, ty: number, onDone?: () => void): void {
    tx = Phaser.Math.Clamp(tx, 14, W - 14);
    ty = Phaser.Math.Clamp(ty, WALL_BOT + 8, STORE_BOT - 8);
    if (this.playerTween) { this.playerTween.stop(); this.playerTween = null; }
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, tx, ty);
    this.playerTween = this.tweens.add({
      targets: this.player, x: tx, y: ty,
      duration: dist * 2.6, ease: 'Power2.easeOut',
      onUpdate:   () => this.redrawPlayer(),
      onComplete: () => { this.playerTween = null; onDone?.(); },
    });
  }

  private setupInput(): void {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.panelObjs.length > 0 || this.genreObjs.length > 0) return;
      if (this.rewinding) return;
      if (ptr.y >= STORE_BOT || ptr.y < WALL_BOT + 4) return;
      // Don't move if tapping on a browser customer, rewind machine, or waiting counter customer
      const nearBrowser = this.browsers.some(b =>
        b.state !== BrowserState.Leaving &&
        Phaser.Math.Distance.Between(ptr.x, ptr.y, b.container.x, b.container.y) < 26,
      );
      const nearRewind = Phaser.Math.Distance.Between(ptr.x, ptr.y, REWIND_POS.x, REWIND_POS.y) < 26;
      const nearCounter = this.waitingForInteraction &&
        Phaser.Math.Distance.Between(ptr.x, ptr.y, this.CUSTOMER_X, this.CUSTOMER_Y) < 30;
      if (!nearBrowser && !nearRewind && !nearCounter) this.movePlayer(ptr.x, ptr.y);
    });
  }

  private tryRewind(): void {
    if (this.rewinding || this.state === State.Over) return;
    if (this.returnPile === 0) {
      this.floatText('No returns', REWIND_POS.x, REWIND_POS.y - 28, '#667788');
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, REWIND_POS.x, REWIND_POS.y + 36);
    if (dist > INTERACT_DIST) {
      this.movePlayer(REWIND_POS.x, REWIND_POS.y + 36, () => this.tryRewind());
      return;
    }
    this.rewinding = true;
    this.updateCounterBubble();
    this.sfx.rewind();
    const startTime = this.time.now;
    const pg = this.add.graphics().setDepth(10);
    const updateBar = () => {
      if (!this.rewinding) { pg.destroy(); return; }
      const frac = Math.min((this.time.now - startTime) / (REWIND_SECS * 1000), 1);
      pg.clear();
      pg.fillStyle(0x222222); pg.fillRect(REWIND_POS.x - 22, REWIND_POS.y - 30, 44, 7);
      pg.fillStyle(0x00ff99); pg.fillRect(REWIND_POS.x - 21, REWIND_POS.y - 29, Math.floor(42 * frac), 5);
    };
    const ticker = this.time.addEvent({ delay: 32, repeat: Math.ceil(REWIND_SECS * 1000 / 32), callback: updateBar });
    this.time.delayedCall(REWIND_SECS * 1000, () => {
      ticker.remove(); pg.destroy();
      this.returnPile = 0;
      this.returnPileText.setText('');
      this.rewinding = false;
      this.updateCounterBubble();
      this.floatText('Done!', REWIND_POS.x, REWIND_POS.y - 36, '#00ff99');
    });
  }

  // ── Browser customers ──────────────────────────────────────────────────────
  private trySpawnBrowser(): void {
    if (this.browsers.filter(b => b.state !== BrowserState.Leaving).length >= MAX_BROWSERS) return;
    if (this.shelfSlotsOcc.size >= SHELF_SLOTS.length) return;

    let slot = -1;
    for (let i = 0; i < SHELF_SLOTS.length; i++) {
      if (!this.shelfSlotsOcc.has(i)) { slot = i; break; }
    }
    if (slot === -1) return;

    const pool = [...CUSTOMERS].filter(c =>
      (!c.behaviorType || c.behaviorType === 'browser') &&
      !this.browsers.some(b => b.data.name === c.name),
    );
    if (pool.length === 0) return;

    const data = pool[Math.floor(Math.random() * pool.length)];
    const gfx  = this.add.graphics();
    this.drawBrowserGfx(gfx, data.color);
    const nameLabel = this.add.text(0, 18, data.name, {
      fontFamily: 'Arial, sans-serif', fontSize: '11px',
      color: '#cccccc', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0);

    const container = this.add.container(DOOR_POS.x, DOOR_POS.y, [gfx, nameLabel])
      .setDepth(7).setSize(30, 46).setInteractive({ useHandCursor: true });

    const browser: BrowserCustomer = {
      data, state: BrowserState.Arriving, container, gfx, nameLabel,
      bubble: null, bubbleTween: null, shelfSlot: slot,
    };
    this.browsers.push(browser);
    this.shelfSlotsOcc.add(slot);

    container.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      ptr.event.stopPropagation();
      this.tryInteractBrowser(browser);
    });

    const dest = SHELF_SLOTS[slot];
    const dist = Phaser.Math.Distance.Between(DOOR_POS.x, DOOR_POS.y, dest.x, dest.y);
    this.tweens.add({
      targets: container, x: dest.x, y: dest.y,
      duration: dist * 2.8, ease: 'Power2.easeOut',
      onComplete: () => {
        browser.state = BrowserState.AtShelf;
        this.createBrowserBubble(browser);
      },
    });
  }

  private drawBrowserGfx(g: Phaser.GameObjects.Graphics, color: number): void {
    g.clear();
    g.fillStyle(0x000000, 0.2); g.fillEllipse(2, 6, 28, 12);
    g.fillStyle(color);         g.fillCircle(0, 0, 13);
    g.fillStyle(0xffffff, 0.15); g.fillCircle(-3, -3, 5);
    g.fillStyle(0xf5cba7);      g.fillCircle(0, -5, 8);
    g.fillStyle(0x222222);
    g.fillCircle(-3, -6, 1.5); g.fillCircle(3, -6, 1.5);
  }

  private createBrowserBubble(b: BrowserCustomer): void {
    const bg = this.add.graphics();
    bg.fillStyle(0xffffff, 0.92);
    bg.fillRoundedRect(-16, -34, 32, 24, 5);
    bg.fillTriangle(-5, -10, 5, -10, 0, -2);
    const txt = this.add.text(0, -22, '?', {
      fontFamily: 'Impact, sans-serif', fontSize: '16px', color: '#222222',
    }).setOrigin(0.5);
    const bubble = this.add.container(0, -18, [bg, txt]);
    b.container.add(bubble);
    b.bubble = bubble;
    b.bubbleTween = this.tweens.add({
      targets: bubble, y: -22, duration: 550,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  }

  private destroyBrowserBubble(b: BrowserCustomer): void {
    b.bubbleTween?.stop(); b.bubbleTween = null;
    b.bubble?.destroy(); b.bubble = null;
  }

  // ── Counter customer interaction bubble ───────────────────────────────────
  private createCounterBubble(): void {
    const isLate = this.isLateFeeVisit;
    const symbol   = isLate ? '$' : '?';
    const bgColor  = isLate ? 0xaa2200 : 0xffffff;
    const txtColor = isLate ? '#ffaa88' : '#222222';

    const bg = this.add.graphics();
    bg.fillStyle(bgColor, 0.92);
    bg.fillRoundedRect(-16, -34, 32, 24, 5);
    bg.fillTriangle(-5, -10, 5, -10, 0, -2);

    const txt = this.add.text(0, -22, symbol, {
      fontFamily: 'Impact, sans-serif', fontSize: '16px', color: txtColor,
    }).setOrigin(0.5);

    this.customerBubbleText = txt;
    const bubble = this.add.container(this.CUSTOMER_X, this.CUSTOMER_Y - 18, [bg, txt]).setDepth(9);
    this.customerBubble = bubble;
    this.customerBubbleTween = this.tweens.add({
      targets: bubble, y: this.CUSTOMER_Y - 22, duration: 550,
      ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    this.customerZone = this.add.zone(this.CUSTOMER_X, 424, 40, 40)
      .setDepth(9)
      .setInteractive({ useHandCursor: true });
    this.customerZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      ptr.event.stopPropagation();
      this.tryInteractCounter();
    });
    this.customerZone.on('pointerover', () => { this.game.canvas.style.cursor = 'pointer'; });
    this.customerZone.on('pointerout',  () => { this.game.canvas.style.cursor = 'default'; });
  }

  private destroyCounterInteraction(): void {
    this.customerBubbleTween?.stop(); this.customerBubbleTween = null;
    this.customerBubble?.destroy();   this.customerBubble = null;
    this.customerBubbleText = null;
    this.customerZone?.destroy();     this.customerZone = null;
    this.waitingForInteraction = false;
    this.game.canvas.style.cursor = 'default';
  }

  private updateCounterBubble(): void {
    if (!this.customerBubbleText || this.isLateFeeVisit) return;
    if (this.rewinding) {
      this.customerBubbleText.setText('!');
      this.customerBubbleText.setColor('#ffcc00');
    } else {
      this.customerBubbleText.setText('?');
      this.customerBubbleText.setColor('#222222');
    }
  }

  private tryInteractCounter(): void {
    if (!this.waitingForInteraction) return;
    if (this.state !== State.Waiting) return;
    if (this.rewinding) {
      this.floatText('Busy!', this.CUSTOMER_X, 385, '#ffcc00');
      return;
    }
    if (this.genreObjs.length > 0 || this.panelObjs.length > 0 || this.lateFeeObjs.length > 0) return;

    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.CUSTOMER_X, this.CUSTOMER_Y);
    if (dist > INTERACT_DIST) {
      this.movePlayer(this.CUSTOMER_X, PLAYER_HOME.y, () => {
        if (this.waitingForInteraction) this.tryInteractCounter();
      });
      return;
    }

    this.destroyCounterInteraction();

    if (this.isLateFeeVisit) {
      this.showLateFeeCard();
    } else {
      this.showCard(true);
      this.showGenreButtons();
    }
  }

  private tryInteractBrowser(b: BrowserCustomer): void {
    if (b.state !== BrowserState.AtShelf) return;
    if (this.helpingBrowser !== null) return;
    if (this.genreObjs.length > 0 || this.panelObjs.length > 0) return;
    if (this.state === State.Selecting) return;

    // Walk toward browser if too far
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.container.x, b.container.y);
    if (dist > INTERACT_DIST) {
      this.movePlayer(b.container.x, b.container.y, () => {
        if (b.state === BrowserState.AtShelf) this.tryInteractBrowser(b);
      });
      return;
    }

    b.state = BrowserState.BeingHelped;
    this.helpingBrowser = b;
    this.destroyBrowserBubble(b);

    // Pause any active patience meter while helping browser
    this.stopPatienceMeter(false);

    this.showCard(true);
    this.showGenreButtons();
    this.state = State.Selecting;
  }

  private departBrowserCustomer(b: BrowserCustomer): void {
    this.destroyBrowserBubble(b);
    b.state = BrowserState.Leaving;
    if (b.shelfSlot >= 0) { this.shelfSlotsOcc.delete(b.shelfSlot); b.shelfSlot = -1; }
    const dist = Phaser.Math.Distance.Between(b.container.x, b.container.y, DOOR_POS.x, DOOR_POS.y);
    this.tweens.add({
      targets: b.container, x: DOOR_POS.x, y: DOOR_POS.y,
      duration: dist * 2.4, ease: 'Power2.easeIn',
      onComplete: () => {
        b.container.destroy();
        this.browsers = this.browsers.filter(x => x !== b);
      },
    });
  }

  // ── Interaction customer (direct counter vs. browser) ──────────────────────
  private get interactionCust(): CustomerData {
    return this.helpingBrowser?.data ?? this.currentCustomer;
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  private createHUD(): void {
    const g = this.add.graphics();
    g.fillStyle(0x001020);
    g.fillRect(0, 68, W, 46);

    this.scoreText = this.add.text(14, 77, '$0.00', {
      fontFamily: '"Courier New", monospace', fontSize: '17px', color: '#00ff88',
    });
    this.timeText = this.add.text(W / 2, 77, `${Math.floor(this.timeLeft / 60)}:${String(this.timeLeft % 60).padStart(2, '0')}`, {
      fontFamily: '"Courier New", monospace', fontSize: '17px', color: '#ffcc00',
    }).setOrigin(0.5, 0);
    this.streakText = this.add.text(W - 14, 77, '', {
      fontFamily: '"Courier New", monospace', fontSize: '15px', color: '#ff6600',
    }).setOrigin(1, 0);
    this.stockText = this.add.text(W - 14, 96, '', {
      fontFamily: '"Courier New", monospace', fontSize: '10px', color: '#446655',
    }).setOrigin(1, 0);

    // Shift / rep / specials strip below the main HUD
    const stripG = this.add.graphics();
    stripG.fillStyle(0x000a14);
    stripG.fillRect(0, 114, W, 22);

    this.repText = this.add.text(14, 117, '', {
      fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#445566',
    });
    this.specialsText = this.add.text(W / 2, 117, '', {
      fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#aa8822',
    }).setOrigin(0.5, 0);
    this.eventText = this.add.text(W - 14, 117, '', {
      fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#aa6600',
    }).setOrigin(1, 0);
  }

  private updateStockText(): void {
    const n = availableCount(MOVIES, this.checkedOut);
    this.stockText.setText(`${n} in stock`);
  }

  private updateRepText(): void {
    this.repText.setText(`${getRepTier(this.reputation)} · Shift ${this.shiftNumber}`);
  }

  private updateSpecialsText(): void {
    if (this.dailySpecials.length === 0) return;
    const titles = this.dailySpecials.map(t => t.split(':')[0].split(',')[0].trim()).join(' · ');
    this.specialsText.setText(`★ ${titles}`);
  }

  private updateEventText(): void {
    if (this.activeEvent) {
      this.eventText.setText(this.activeEvent.name);
    } else {
      this.eventText.setText('');
    }
  }

  // ── Customer layer ────────────────────────────────────────────────────────
  private createCustomerLayer(): void {
    this.customerGfx = this.add.graphics();
    this.patienceMeterGfx = this.add.graphics();
    this.customerNameLabel = this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '12px',
      color: '#aaaaaa', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0);
  }

  private drawCustomer(x: number): void {
    this.customerGfx.clear();
    if (!this.currentCustomer) return;
    const { color } = this.currentCustomer;
    const cy = this.CUSTOMER_Y;
    this.customerGfx.fillStyle(0x000000, 0.25);
    this.customerGfx.fillEllipse(x + 2, cy + 4, 30, 14);
    this.customerGfx.fillStyle(color);
    this.customerGfx.fillCircle(x, cy, 13);
    this.customerGfx.fillStyle(0xffffff, 0.15);
    this.customerGfx.fillCircle(x - 3, cy - 3, 5);
    this.customerGfx.fillStyle(0xf5cba7);
    this.customerGfx.fillCircle(x, cy - 5, 8);
    this.customerGfx.fillStyle(0x222222);
    this.customerGfx.fillCircle(x - 3, cy - 6, 1.5);
    this.customerGfx.fillCircle(x + 3, cy - 6, 1.5);
    this.customerNameLabel.setPosition(x, cy + 18).setText(this.currentCustomer.name);
  }

  // ── Patience meter ────────────────────────────────────────────────────────
  private startPatienceMeter(totalMs: number): void {
    this.patienceTotal = totalMs;
    this.patienceLeft  = totalMs;
    this.stopPatienceMeter();

    this.patienceTimer = this.time.addEvent({
      delay: 100,
      repeat: Math.ceil(totalMs / 100) - 1,
      callback: () => {
        this.patienceLeft = Math.max(0, this.patienceLeft - 100);
        this.drawPatienceMeter();
        if (this.patienceLeft <= 0) this.onPatienceExpired();
      },
    });
  }

  private stopPatienceMeter(clearGfx = true): void {
    if (this.patienceTimer) {
      this.patienceTimer.remove(false);
      this.patienceTimer = null;
    }
    if (clearGfx) this.patienceMeterGfx.clear();
  }

  private resumePatienceMeter(): void {
    if (this.patienceLeft <= 0 || this.state !== State.Waiting) return;
    this.stopPatienceMeter(false);
    this.patienceTimer = this.time.addEvent({
      delay: 100,
      repeat: Math.ceil(this.patienceLeft / 100) - 1,
      callback: () => {
        this.patienceLeft = Math.max(0, this.patienceLeft - 100);
        this.drawPatienceMeter();
        if (this.patienceLeft <= 0) this.onPatienceExpired();
      },
    });
  }

  private drawPatienceMeter(): void {
    this.patienceMeterGfx.clear();
    if (this.patienceTotal <= 0) return;

    const ratio = this.patienceLeft / this.patienceTotal;
    const barW  = 60;
    const barH  = 5;
    const bx    = this.CUSTOMER_X - barW / 2;
    const by    = 400;

    // Background
    this.patienceMeterGfx.fillStyle(0x222222);
    this.patienceMeterGfx.fillRect(bx, by, barW, barH);

    // Fill — green → yellow → red
    const color = ratio > 0.5 ? 0x44cc44 : ratio > 0.25 ? 0xddaa00 : 0xcc2222;
    this.patienceMeterGfx.fillStyle(color);
    this.patienceMeterGfx.fillRect(bx, by, Math.round(barW * ratio), barH);
  }

  private onPatienceExpired(): void {
    if (this.state !== State.Waiting && this.state !== State.Selecting) return;
    if (this.helpingBrowser !== null) return; // patience paused during browser help
    this.stopPatienceMeter();
    this.destroyCounterInteraction();
    this.hideGenreButtons();
    this.hideMoviePanel();
    this.hideLateFeeButtons();
    this.showCard(false);
    this.streak = 0;
    this.streakText.setText('');
    this.shiftStats.misses++;
    this.sfx.buzz();
    this.floatText('Left!', this.CUSTOMER_X, 385, '#ff7700');
    this.departCustomer();

    // Reputation penalty
    this.reputation = addRep(this.reputation, REP_MISS);
    this.updateRepText();
  }

  // ── Request card ──────────────────────────────────────────────────────────
  private createRequestCard(): void {
    this.cardGfx = this.add.graphics();

    this.cardName = this.add.text(W / 2, 474, '', {
      fontFamily: '"Courier New", monospace', fontSize: '12px',
      color: '#888888', letterSpacing: 3,
    }).setOrigin(0.5, 0).setVisible(false);

    this.cardDialogue = this.add.text(W / 2, 494, '', {
      fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#111111',
      wordWrap: { width: 390 }, align: 'center', lineSpacing: 5,
    }).setOrigin(0.5, 0).setVisible(false);

    this.cardGenre = this.add.text(W / 2, 548, '', {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#556677',
    }).setOrigin(0.5, 0).setVisible(false);
  }

  private showCard(visible: boolean): void {
    this.cardGfx.clear();
    [this.cardName, this.cardDialogue, this.cardGenre].forEach(t => t.setVisible(visible));
    if (!visible) return;

    const cust = this.interactionCust;
    const g = this.cardGfx;
    g.fillStyle(0xfafaf5);
    g.fillRoundedRect(16, 464, W - 32, 104, 12);
    g.lineStyle(2, 0xddddcc, 1);
    g.strokeRoundedRect(16, 464, W - 32, 104, 12);
    g.fillStyle(cust.color);
    g.fillRoundedRect(16, 464, W - 32, 6, { tl: 12, tr: 12, bl: 0, br: 0 });

    this.cardName.setText(cust.name.toUpperCase()).setVisible(true);
    this.cardDialogue.setText(`"${cust.dialogue}"`).setVisible(true);

    const showGenre = this.ownedUpgrades.has('genre_guide');
    if (showGenre) {
      this.cardGenre.setText(`Genre: ${cust.genreHint}`).setVisible(true);
    }
  }

  // ── Genre buttons ─────────────────────────────────────────────────────────
  private showGenreButtons(): void {
    this.genreObjs = [];

    GENRE_ROWS.forEach((row, rowIdx) => {
      const cy = rowIdx === 0 ? 584 : 628;
      row.forEach((genre, col) => {
        const btn = this.makeGenreBtn(GENRE_BTN_XS[col], cy, genre, () => {
          this.hideGenreButtons();
          this.showCard(false);
          this.state = State.Selecting;
          this.showMoviePanel(genre);
        });
        this.genreObjs.push(btn);
      });
    });

    // New Releases — wide centred button
    const nrGfx = this.add.graphics();
    const drawNR = (hover: boolean) => {
      nrGfx.clear();
      nrGfx.fillStyle(hover ? 0x3a2a55 : 0x2a1a40);
      nrGfx.fillRoundedRect(-100, -18, 200, 36, 7);
      nrGfx.lineStyle(1, hover ? 0xaa88ee : 0x8866cc, 1);
      nrGfx.strokeRoundedRect(-100, -18, 200, 36, 7);
    };
    drawNR(false);
    const nrTxt = this.add.text(0, 0, '★  NEW RELEASES  ★', {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#cc99ff', align: 'center',
    }).setOrigin(0.5);
    const nrBtn = this.add.container(W / 2, 672, [nrGfx, nrTxt])
      .setSize(200, 36).setInteractive({ useHandCursor: true });
    nrBtn.on('pointerover', () => { drawNR(true);  nrTxt.setColor('#eeddff'); });
    nrBtn.on('pointerout',  () => { drawNR(false); nrTxt.setColor('#cc99ff'); });
    nrBtn.on('pointerdown', () => { this.hideGenreButtons(); this.showCard(false); this.state = State.Selecting; this.showMoviePanel('New Releases'); });
    this.genreObjs.push(nrBtn);

    const miss = this.makeBtn(W / 2, 744, "CAN'T\nFIND IT", 0x5a0000, '#ffffff',
      () => this.onMiss());
    this.genreObjs.push(miss);

    this.genreObjs.forEach(o => {
      (o as Phaser.GameObjects.Components.Alpha).setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 160 });
    });
  }

  private hideGenreButtons(): void {
    this.genreObjs.forEach(o => o.destroy());
    this.genreObjs = [];
  }

  private makeGenreBtn(
    cx: number, cy: number, label: string, fn: () => void,
  ): Phaser.GameObjects.Container {
    const BW = 82, BH = 36;
    const gfx = this.add.graphics();
    const drawBg = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x2a4468 : 0x192840);
      gfx.fillRoundedRect(-BW / 2, -BH / 2, BW, BH, 6);
      gfx.lineStyle(1, hover ? 0x4a7aaa : 0x2c4468, 1);
      gfx.strokeRoundedRect(-BW / 2, -BH / 2, BW, BH, 6);
    };
    drawBg(false);

    const txt = this.add.text(0, 0, label, {
      fontFamily: '"Courier New", monospace',
      fontSize: '11px', color: '#8caccc', align: 'center',
    }).setOrigin(0.5);

    const btn = this.add.container(cx, cy, [gfx, txt])
      .setSize(BW, BH).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => { drawBg(true);  txt.setColor('#d0e8ff'); });
    btn.on('pointerout',  () => { drawBg(false); txt.setColor('#8caccc'); });
    btn.on('pointerdown', fn);
    return btn;
  }

  // ── Movie panel ───────────────────────────────────────────────────────────
  private showMoviePanel(genre: string): void {
    this.panelObjs = [];
    const cust = this.interactionCust;

    const genreMovies = (genre === 'New Releases'
      ? MOVIES.filter(m => m.year >= NEW_RELEASES_MIN_YEAR)
      : MOVIES.filter(m => m.genre === genre)
    ).sort((a, b) => a.title.localeCompare(b.title));

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0d1a10);
    panelBg.fillRect(0, 460, W, H - 460);
    panelBg.fillStyle(0x081208);
    panelBg.fillRect(0, 460, W, 44);
    this.panelObjs.push(panelBg);

    const backTxt = this.add.text(18, 482, '← BACK', {
      fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#778899',
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });
    backTxt.on('pointerover', () => backTxt.setColor('#aabbcc'));
    backTxt.on('pointerout',  () => backTxt.setColor('#778899'));
    backTxt.on('pointerdown', () => {
      this.hideMoviePanel();
      this.showCard(true);
      this.showGenreButtons();
      // Stay in Selecting for browser help; revert to Waiting for direct customer
      if (this.helpingBrowser === null) this.state = State.Waiting;
    });
    this.panelObjs.push(backTxt);

    const headerColor = genre === 'New Releases' ? '#cc99ff' : '#c8ddf0';
    this.panelObjs.push(this.add.text(W / 2, 482, `${genre.toUpperCase()} SECTION`, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '16px', color: headerColor,
    }).setOrigin(0.5, 0.5));

    this.panelObjs.push(this.add.text(W / 2, 512, `for ${cust.name}`, {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#557766',
    }).setOrigin(0.5, 0.5));

    const div = this.add.graphics();
    div.fillStyle(0x224422);
    div.fillRect(16, 524, W - 32, 1);
    this.panelObjs.push(div);

    const ITEM_H  = 30;
    const LIST_Y0 = 532;

    if (genreMovies.length === 0) {
      this.panelObjs.push(this.add.text(W / 2, LIST_Y0 + 40, 'No titles in this section.', {
        fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#556655',
      }).setOrigin(0.5, 0));
    } else {
      genreMovies.forEach((movie, i) => {
        const iy = LIST_Y0 + i * ITEM_H;
        const isOut     = this.checkedOut.has(movie.title);
        const isSpecial = this.dailySpecials.includes(movie.title);

        const rowBg = this.add.graphics();
        rowBg.fillStyle(i % 2 === 0 ? 0x111a12 : 0x141e15);
        rowBg.fillRect(0, iy - ITEM_H / 2 + 1, W, ITEM_H - 1);
        this.panelObjs.push(rowBg);

        const titleColor = isOut ? '#3a4a3a' : (isSpecial ? '#ffd700' : '#c8d8c0');
        const yearColor  = isOut ? '#2e3e2e' : '#667766';

        const titleT = this.add.text(22, iy, `${isSpecial ? '★ ' : ''}${movie.title}`, {
          fontFamily: '"Courier New", monospace', fontSize: '13px', color: titleColor,
        }).setOrigin(0, 0.5);

        const yearStr = isOut ? 'OUT' : `${movie.year}`;
        const yearT = this.add.text(W - 18, iy, yearStr, {
          fontFamily: '"Courier New", monospace',
          fontSize: '11px', color: isOut ? '#3a2a2a' : yearColor,
        }).setOrigin(1, 0.5);

        this.panelObjs.push(titleT, yearT);

        if (!isOut) {
          const zone = this.add.zone(W / 2, iy, W, ITEM_H).setInteractive({ useHandCursor: true });
          zone.on('pointerover', () => {
            titleT.setColor('#ffffff');
            yearT.setColor('#aabbaa');
            rowBg.clear();
            rowBg.fillStyle(0x1e3a20);
            rowBg.fillRect(0, iy - ITEM_H / 2 + 1, W, ITEM_H - 1);
          });
          zone.on('pointerout', () => {
            titleT.setColor(titleColor);
            yearT.setColor(yearColor);
            rowBg.clear();
            rowBg.fillStyle(i % 2 === 0 ? 0x111a12 : 0x141e15);
            rowBg.fillRect(0, iy - ITEM_H / 2 + 1, W, ITEM_H - 1);
          });
          zone.on('pointerdown', () => this.onMovieSelected(movie));
          this.panelObjs.push(zone);
        }
      });
    }

    const listBottom = LIST_Y0 + genreMovies.length * ITEM_H;
    const missY = Math.max(listBottom + 28, 790);
    this.panelObjs.push(this.makeBtn(W / 2, missY, "CAN'T\nFIND IT", 0x5a0000, '#ffffff',
      () => this.onMiss()));

    this.panelObjs.forEach(o => {
      (o as Phaser.GameObjects.Components.Alpha).setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 160 });
    });
  }

  private hideMoviePanel(): void {
    this.panelObjs.forEach(o => o.destroy());
    this.panelObjs = [];
  }

  // ── Late fee UI ───────────────────────────────────────────────────────────
  private showLateFeeCard(): void {
    this.lateFeeObjs = [];

    const g = this.add.graphics();
    g.fillStyle(0x1a0a0a);
    g.fillRoundedRect(16, 464, W - 32, 116, 12);
    g.lineStyle(2, 0x882222, 1);
    g.strokeRoundedRect(16, 464, W - 32, 116, 12);
    g.fillStyle(0xcc2222);
    g.fillRoundedRect(16, 464, W - 32, 6, { tl: 12, tr: 12, bl: 0, br: 0 });
    this.lateFeeObjs.push(g);

    this.lateFeeObjs.push(this.add.text(W / 2, 476, `${this.currentCustomer.name.toUpperCase()} — RETURNING`, {
      fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#cc6666', letterSpacing: 2,
    }).setOrigin(0.5, 0));

    const shortTitle = this.lateFeeTitle.length > 28 ? this.lateFeeTitle.slice(0, 25) + '…' : this.lateFeeTitle;
    this.lateFeeObjs.push(this.add.text(W / 2, 498, `"Returning: ${shortTitle}"`, {
      fontFamily: 'Arial, sans-serif', fontSize: '14px', color: '#cccccc',
      wordWrap: { width: 390 }, align: 'center',
    }).setOrigin(0.5, 0));

    this.lateFeeObjs.push(this.add.text(W / 2, 540, `Late fee: $${LATE_FEE_AMOUNT.toFixed(2)}`, {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#aa4444',
    }).setOrigin(0.5, 0));

    // COLLECT button
    const collectBtn = this.makeSmallBtn(W / 2 - 72, 600, `COLLECT $${LATE_FEE_AMOUNT.toFixed(2)}`, 0x003a00, '#44ff44',
      () => this.onLateFee(true));
    // WAIVE button
    const waiveBtn = this.makeSmallBtn(W / 2 + 72, 600, 'WAIVE\n+REP', 0x1a1a3a, '#6688ff',
      () => this.onLateFee(false));

    this.lateFeeObjs.push(collectBtn, waiveBtn);

    this.lateFeeObjs.forEach(o => {
      (o as Phaser.GameObjects.Components.Alpha).setAlpha(0);
      this.tweens.add({ targets: o, alpha: 1, duration: 160 });
    });
  }

  private hideLateFeeButtons(): void {
    this.lateFeeObjs.forEach(o => o.destroy());
    this.lateFeeObjs = [];
  }

  private onLateFee(collect: boolean): void {
    if (this.state !== State.Waiting) return;
    this.state = State.Leaving;
    this.stopPatienceMeter();
    this.hideLateFeeButtons();

    const fee = calcLateFee(collect);
    const repDelta = collect ? REP_COLLECT : REP_WAIVE_FEE;

    if (collect) {
      this.score += fee;
      this.scoreText.setText(`$${this.score.toFixed(2)}`);
      this.shiftStats.lateFeesCollected++;
      this.totalFeesCollected++;
      saveTotalFeesCollected(this.totalFeesCollected);
      this.sfx.ding();
      this.floatText(`+$${fee.toFixed(2)}`, this.CUSTOMER_X, 385, '#00ff88');
    } else {
      this.sfx.chime();
      this.floatText('+REP', this.CUSTOMER_X, 385, '#6688ff');
    }

    this.reputation = addRep(this.reputation, repDelta);
    this.updateRepText();
    this.triggerAchievementCheck();
    this.departCustomer();
  }

  // ── Movie selected ────────────────────────────────────────────────────────
  private finishMovieInteraction(isBrowserHelp: boolean): void {
    if (isBrowserHelp) {
      const b = this.helpingBrowser!;
      this.helpingBrowser = null;
      this.departBrowserCustomer(b);
      this.state = State.Waiting;
      this.resumePatienceMeter();
    } else {
      this.state = State.Leaving;
      this.stopPatienceMeter();
      this.departCustomer();
    }
  }

  private onMovieSelected(movie: Movie): void {
    if (this.state !== State.Selecting) return;

    const isBrowserHelp = this.helpingBrowser !== null;
    const cust = this.interactionCust;
    const floatX = isBrowserHelp ? this.helpingBrowser!.container.x : this.CUSTOMER_X;
    const floatY = isBrowserHelp ? this.helpingBrowser!.container.y - 40 : 385;

    this.hideMoviePanel();
    this.showCard(false);

    // Genre correctness check (primary, alt, new-release)
    const primaryMatch = cust.wantsNewRelease
      ? movie.year >= NEW_RELEASES_MIN_YEAR
      : isGenreMatch(movie.genre, cust.genreHint);
    const altMatch = !primaryMatch && !!cust.altGenreHint &&
      isGenreMatch(movie.genre, cust.altGenreHint);
    const genreCorrect = primaryMatch || altMatch;

    if (!genreCorrect) {
      this.streak = 0;
      this.streakText.setText('');
      this.shiftStats.misses++;
      this.sfx.buzz();
      this.floatText('Wrong section!', floatX, floatY, '#ff5555');
      this.reputation = addRep(this.reputation, REP_MISS);
      this.updateRepText();
      this.finishMovieInteraction(isBrowserHelp);
      return;
    }

    if (altMatch) {
      // Partial success — base fee only, no streak, no bonus
      this.streak = 0;
      this.streakText.setText('');
      const earned = BASE_RENTAL_FEE;
      this.score += earned;
      this.scoreText.setText(`$${this.score.toFixed(2)}`);
      this.checkedOut.add(movie.title);
      this.returnPile++;
      this.returnPileText.setText(`↩ ${this.returnPile}`);
      this.updateStockText();
      this.sfx.ding();
      this.shiftStats.rentals++;
      this.shiftStats.genresServed.add(movie.genre);
      const rx = RX_ALT[Math.floor(Math.random() * RX_ALT.length)];
      this.floatText(rx, floatX, floatY, '#ffaa44');
      this.floatText(`+$${earned.toFixed(2)}`, floatX, floatY - 26, '#88ff88');
      this.finishMovieInteraction(isBrowserHelp);
      return;
    }

    // Full success
    this.streak++;
    this.peakStreak = Math.max(this.peakStreak, this.streak);
    const exactMatch = cust.wantedTitle === movie.title;
    let earned = calcEarnings(exactMatch, this.streak);
    earned = applyClerkBonus(earned, this.clerk, exactMatch);
    earned = applyEventBonus(earned, this.activeEvent);

    const specialBonus = calcDailySpecialBonus(movie.title, this.dailySpecials);
    if (specialBonus > 0) {
      earned = parseFloat((earned + specialBonus).toFixed(2));
      this.shiftStats.specialRentals++;
    }

    this.score += earned;
    this.scoreText.setText(`$${this.score.toFixed(2)}`);
    this.streakText.setText(this.streak >= 3 ? `${this.streak}× STREAK!` : '');
    this.checkedOut.add(movie.title);
    this.returnPile++;
    this.returnPileText.setText(`↩ ${this.returnPile}`);
    this.updateStockText();
    this.sfx.ding();

    this.shiftStats.rentals++;
    this.shiftStats.genresServed.add(movie.genre);
    this.shiftStats.customersServed.add(cust.name);
    this.shiftStats.peakStreak = this.peakStreak;

    const visits = (this.customerVisits[cust.name] ?? 0) + 1;
    this.customerVisits[cust.name] = visits;
    saveCustomerVisits(this.customerVisits);

    this.reputation = addRep(this.reputation, REP_SERVE);
    this.updateRepText();

    // Reaction dialogue
    const rxPool = exactMatch ? RX_EXACT : RX_MATCH;
    this.floatText(rxPool[Math.floor(Math.random() * rxPool.length)], floatX, floatY, '#ffffff');
    const label = exactMatch ? `+$${earned.toFixed(2)} ★`
      : specialBonus > 0 ? `+$${earned.toFixed(2)} ✦`
      : `+$${earned.toFixed(2)}`;
    this.floatText(label, floatX, floatY - 26, '#00ff88');

    this.triggerAchievementCheck();
    this.finishMovieInteraction(isBrowserHelp);
  }

  // ── Miss ──────────────────────────────────────────────────────────────────
  private onMiss(): void {
    if (this.state !== State.Waiting && this.state !== State.Selecting) return;
    this.hideGenreButtons();
    this.hideMoviePanel();
    this.showCard(false);
    this.streak = 0;
    this.streakText.setText('');
    this.shiftStats.misses++;
    this.sfx.buzz();
    this.reputation = addRep(this.reputation, REP_MISS);
    this.updateRepText();

    if (this.helpingBrowser !== null) {
      const floatX = this.helpingBrowser.container.x;
      const floatY = this.helpingBrowser.container.y - 40;
      this.floatText('Sorry...', floatX, floatY, '#ff5555');
      const b = this.helpingBrowser;
      this.helpingBrowser = null;
      this.departBrowserCustomer(b);
      this.state = State.Waiting;
      this.resumePatienceMeter();
    } else {
      this.state = State.Leaving;
      this.stopPatienceMeter();
      this.floatText('Sorry...', this.CUSTOMER_X, 385, '#ff5555');
      this.departCustomer();
    }
  }

  // ── Achievement checks ────────────────────────────────────────────────────
  private triggerAchievementCheck(): void {
    // Check regular_hero separately (cross-session data)
    const isRegularHero = !this.earnedAchievements.has('regular_hero') &&
      Object.values(this.customerVisits).some(v => v >= 3);
    const newIds = checkAchievements(this.shiftStats, this.earnedAchievements);
    if (isRegularHero) newIds.push('regular_hero');

    newIds.forEach((id, i) => {
      this.earnedAchievements.add(id);
      this.time.delayedCall(i * 1400, () => this.showAchievementToast(id));
    });

    if (newIds.length > 0) saveEarnedAchievements(this.earnedAchievements);
  }

  private showAchievementToast(id: string): void {
    const name = getAchievementName(id);
    const toast = this.add.container(W / 2, 148).setDepth(30);
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1400, 0.92);
    bg.fillRoundedRect(-120, -18, 240, 36, 8);
    bg.lineStyle(1, 0xf5a623, 1);
    bg.strokeRoundedRect(-120, -18, 240, 36, 8);
    const txt = this.add.text(0, 0, `★ ${name}`, {
      fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#f5a623',
    }).setOrigin(0.5);
    toast.add([bg, txt]);
    toast.setAlpha(0);
    this.tweens.add({
      targets: toast, alpha: 1, y: 140, duration: 300,
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({ targets: toast, alpha: 0, duration: 400,
            onComplete: () => toast.destroy() });
        });
      },
    });
  }

  // ── Timer ─────────────────────────────────────────────────────────────────
  private startTimer(): void {
    this.updateEventText();
    const totalTicks = this.timeLeft;
    this.time.addEvent({
      delay: 1000,
      repeat: totalTicks - 1,
      callback: () => {
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        const m = Math.floor(this.timeLeft / 60);
        const s = this.timeLeft % 60;
        this.timeText.setText(`${m}:${s.toString().padStart(2, '0')}`);
        if (this.timeLeft === 30) this.timeText.setColor('#ff4444');
        if (this.timeLeft === 0) this.endShift();
      },
    });
  }

  // ── Customer lifecycle ────────────────────────────────────────────────────
  private spawnCustomer(): void {
    if (this.state === State.Over || this.timeLeft <= 0) return;

    if (!this.customerQueue.length) {
      this.customerQueue = Phaser.Utils.Array.Shuffle([...CUSTOMERS, ...CUSTOMERS]);
    }

    // Decide if this is a late-fee return visit (20% chance, need something checked out)
    const returnable = [...this.checkedOut];
    this.isLateFeeVisit = returnable.length > 0 && Math.random() < 0.20;
    if (this.isLateFeeVisit) {
      this.lateFeeTitle = returnable[Math.floor(Math.random() * returnable.length)];
    }

    this.currentCustomer = this.customerQueue.pop()!;
    this.customerPos.x   = -80;
    this.state           = State.Arriving;
    this.sfx.chime();

    const speedUpg   = this.ownedUpgrades.has('speed') ? 200 : 0;
    const clerkSpeed = this.clerk?.bonus.type === 'speed' ? this.clerk.bonus.reductionMs : 0;
    const arrivalMs  = Math.max(200, 550 - speedUpg - clerkSpeed);

    const isBrowser   = (this.currentCustomer.behaviorType ?? 'help-seeker') === 'browser';

    if (isBrowser) {
      // Browser: walk to shelf area first, linger, then approach counter
      this.tweens.add({
        targets: this.customerPos,
        x: this.SHELF_X,
        duration: arrivalMs,
        ease: 'Power2.easeOut',
        onUpdate: () => this.drawCustomer(this.customerPos.x),
        onComplete: () => {
          this.time.delayedCall(1200, () => {
            this.tweens.add({
              targets: this.customerPos,
              x: this.CUSTOMER_X,
              duration: arrivalMs * 0.7,
              ease: 'Power2.easeOut',
              onUpdate: () => this.drawCustomer(this.customerPos.x),
              onComplete: () => this.onCustomerArrived(),
            });
          });
        },
      });
    } else {
      this.tweens.add({
        targets: this.customerPos,
        x: this.CUSTOMER_X,
        duration: arrivalMs,
        ease: 'Power2.easeOut',
        onUpdate: () => this.drawCustomer(this.customerPos.x),
        onComplete: () => this.onCustomerArrived(),
      });
    }
  }

  private onCustomerArrived(): void {
    this.state = State.Waiting;

    // Compute patience for this customer
    const cfg       = getShiftConfig(this.shiftNumber);
    const custPat   = this.currentCustomer.patience ?? cfg.patienceMs;
    const clerkExtra = this.clerk?.bonus.type === 'patience' ? this.clerk.bonus.extraMs : 0;
    const repBonus  = repPatienceBonus(this.reputation);

    // patience_drain event: consumed on first customer
    let drainAmt = 0;
    if (this.activeEvent?.effect.type === 'patience_drain' && !this.eventConsumed) {
      drainAmt = this.activeEvent.effect.reductionMs;
      this.eventConsumed = true;
    }

    const patience = Math.max(5_000, custPat + clerkExtra + repBonus - drainAmt);

    this.waitingForInteraction = true;
    this.createCounterBubble();
    this.startPatienceMeter(patience);
  }

  private departCustomer(): void {
    this.destroyCounterInteraction();
    this.tweens.add({
      targets: this.customerPos,
      x: -80,
      duration: 460,
      ease: 'Power2.easeIn',
      onUpdate: () => this.drawCustomer(this.customerPos.x),
      onComplete: () => {
        this.customerGfx.clear();
        this.customerNameLabel.setText('');
        this.state = State.Idle;
        if (this.timeLeft > 0) {
          const cfg = getShiftConfig(this.shiftNumber);
          const eventFactor = this.activeEvent?.effect.type === 'spawn_boost'
            ? this.activeEvent.effect.factor : 1;
          let [min, max] = spawnDelay(this.timeLeft, cfg.spawnFactor * eventFactor);
          this.time.delayedCall(
            Phaser.Math.Between(min, max),
            () => this.spawnCustomer(),
          );
        }
      },
    });
  }

  // ── Browser spawn loop ────────────────────────────────────────────────────
  private scheduleBrowserSpawn(): void {
    if (this.state === State.Over || this.timeLeft <= 0) return;
    // Attempt to fill empty shelf slots roughly every 12-18s
    this.trySpawnBrowser();
    const delay = Phaser.Math.Between(12000, 18000);
    this.time.delayedCall(delay, () => this.scheduleBrowserSpawn());
  }

  // ── End shift ─────────────────────────────────────────────────────────────
  private endShift(): void {
    if (this.state === State.Over) return;
    this.state = State.Over;
    this.stopPatienceMeter();
    this.destroyCounterInteraction();

    this.hideGenreButtons();
    this.hideMoviePanel();
    this.hideLateFeeButtons();
    this.showCard(false);
    this.helpingBrowser = null;
    this.browsers.forEach(b => { this.destroyBrowserBubble(b); b.container.destroy(); });
    this.browsers = [];

    const isNewHigh   = this.score      > this.highScore;
    const isNewStreak = this.peakStreak > this.bestStreak;
    if (isNewHigh)   this.saveStat(LS_HIGH,   this.score);
    if (isNewStreak) this.saveStat(LS_STREAK, this.peakStreak);

    saveReputation(this.reputation);

    // Collect newly-unlocked achievement ids for BetweenShiftScene — snapshot BEFORE final check
    const prevEarned = new Set(this.earnedAchievements);
    this.shiftStats.peakStreak = this.peakStreak;
    this.triggerAchievementCheck();
    const newAchievementIds = [...this.earnedAchievements].filter(id => !prevEarned.has(id));

    this.sfx.rewind();
    this.time.delayedCall(600, () => this.sfx.stopMusic());

    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.82);
    overlay.fillRect(0, 0, W, H);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 500 });

    const title = this.add.text(W / 2, H / 2 - 160, 'SHIFT OVER!', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '54px', color: '#f5a623', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(21).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: H / 2 - 170, duration: 600, delay: 250 });

    this.time.delayedCall(700, () => {
      const lines = [
        `Earned:     $${this.score.toFixed(2)}`,
        isNewHigh ? '  ★ NEW BEST!' : `  Best:     $${this.highScore.toFixed(2)}`,
        '',
        `Top streak: ${this.peakStreak}×`,
        `Reputation: ${getRepTier(this.reputation)}`,
      ].join('\n');

      const summary = this.add.text(W / 2, H / 2 - 90, lines, {
        fontFamily: '"Courier New", monospace', fontSize: '19px',
        color: isNewHigh ? '#ffee88' : '#ffffff',
        align: 'center', lineSpacing: 10,
      }).setOrigin(0.5).setDepth(21).setAlpha(0);
      this.tweens.add({ targets: summary, alpha: 1, duration: 400 });

      // "Next Shift" → BetweenShiftScene; "New Game" → CharacterSelectScene
      const nextBtn = this.makeBtn(W / 2, H / 2 + 110, 'NEXT SHIFT', 0x003087, '#f5a623', () => {
        this.sfx.stopMusic();
        this.time.delayedCall(400, () => {
          this.scene.start('BetweenShiftScene', {
            shiftNumber:     this.shiftNumber,
            clerkId:         this.clerk?.id ?? 'alex',
            shiftEarnings:   this.score,
            peakStreak:      this.peakStreak,
            reputation:      this.reputation,
            newAchievementIds,
            stats: this.shiftStats,
          });
        });
      });
      nextBtn.setDepth(21).setAlpha(0);
      this.tweens.add({ targets: nextBtn, alpha: 1, duration: 400, delay: 200 });

      const newGameBtn = this.makeBtn(W / 2, H / 2 + 210, 'NEW GAME', 0x1a0000, '#ff6644', () => {
        this.sfx.stopMusic();
        this.time.delayedCall(400, () => this.scene.start('CharacterSelectScene'));
      });
      newGameBtn.setDepth(21).setAlpha(0);
      this.tweens.add({ targets: newGameBtn, alpha: 1, duration: 400, delay: 350 });
    });
  }

  // ── Generic buttons ───────────────────────────────────────────────────────
  private makeBtn(
    x: number, y: number, label: string, bg: number, fg: string, fn: () => void,
  ): Phaser.GameObjects.Container {
    const gfx = this.add.graphics();
    gfx.fillStyle(bg);
    gfx.fillRoundedRect(-84, -40, 168, 80, 12);
    gfx.lineStyle(3, 0xffffff, 0.2);
    gfx.strokeRoundedRect(-84, -40, 168, 80, 12);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '21px', color: fg, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5);
    const btn = this.add.container(x, y, [gfx, txt]).setSize(168, 80).setInteractive();
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.07, scaleY: 1.07, duration: 70 }));
    btn.on('pointerout',  () => this.tweens.add({ targets: btn, scaleX: 1.0,  scaleY: 1.0,  duration: 70 }));
    btn.on('pointerdown', fn);
    return btn;
  }

  private makeSmallBtn(
    x: number, y: number, label: string, bg: number, fg: string, fn: () => void,
  ): Phaser.GameObjects.Container {
    const gfx = this.add.graphics();
    gfx.fillStyle(bg);
    gfx.fillRoundedRect(-60, -28, 120, 56, 8);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(-60, -28, 120, 56, 8);
    const txt = this.add.text(0, 0, label, {
      fontFamily: '"Courier New", monospace', fontSize: '13px', color: fg,
      align: 'center', lineSpacing: 2,
    }).setOrigin(0.5);
    const btn = this.add.container(x, y, [gfx, txt]).setSize(120, 56).setInteractive();
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.07, scaleY: 1.07, duration: 70 }));
    btn.on('pointerout',  () => this.tweens.add({ targets: btn, scaleX: 1.0,  scaleY: 1.0,  duration: 70 }));
    btn.on('pointerdown', fn);
    return btn;
  }

  private floatText(msg: string, x: number, y: number, color: string): void {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Impact, sans-serif', fontSize: '28px',
      color, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t, y: y - 80, alpha: 0, duration: 1000,
      ease: 'Power2.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private blankStats(): ShiftStats {
    return {
      rentals: 0, misses: 0, peakStreak: 0,
      lateFeesCollected: 0, specialRentals: 0,
      genresServed: new Set(), customersServed: new Set(),
    };
  }

  private loadClerkId(): string {
    try { return localStorage.getItem(LS_CLERK) ?? 'alex'; }
    catch { return 'alex'; }
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  private loadStat(key: string): number {
    try { return parseFloat(localStorage.getItem(key) ?? '0') || 0; }
    catch { return 0; }
  }

  private saveStat(key: string, value: number): void {
    try { localStorage.setItem(key, value.toString()); }
    catch { /* storage unavailable */ }
  }

  private loadBool(key: string): boolean {
    try { return localStorage.getItem(key) === '1'; }
    catch { return false; }
  }

  private saveBool(key: string): void {
    try { localStorage.setItem(key, '1'); }
    catch { /* storage unavailable */ }
  }
}
