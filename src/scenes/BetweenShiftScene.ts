import Phaser from 'phaser';
import { UPGRADES } from '../data/upgrades';
import { ACHIEVEMENTS } from '../data/achievements';
import { getRepTier } from '../utils/reputation';
import { loadUpgrades, saveUpgrades } from '../utils/upgrades';
import type { ShiftStats } from '../types';

const W = 480;
const H = 854;

const LS_TOTAL_SCORE = 'lateFee_totalScore';

export interface BetweenShiftData {
  shiftNumber: number;
  clerkId: string;
  shiftEarnings: number;
  peakStreak: number;
  reputation: number;
  newAchievementIds: string[];
  stats: ShiftStats;
}

export class BetweenShiftScene extends Phaser.Scene {
  private shiftData!: BetweenShiftData;
  private totalScore = 0;
  private ownedUpgrades: Set<string> = new Set();
  private upgradeObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'BetweenShiftScene' }); }

  init(data: BetweenShiftData) { this.shiftData = data; }

  private get upgradeHeaderY(): number {
    return this.shiftData.newAchievementIds.length > 0
      ? 320 + this.shiftData.newAchievementIds.length * 32
      : 308;
  }

  create() {
    this.totalScore    = this.loadTotalScore() + this.shiftData.shiftEarnings;
    this.ownedUpgrades = loadUpgrades();
    this.saveTotalScore(this.totalScore);

    const bg = this.add.graphics();
    bg.fillStyle(0x00080f);
    bg.fillRect(0, 0, W, H);

    const hdr = this.add.graphics();
    hdr.fillStyle(0x003087);
    hdr.fillRect(0, 0, W, 64);
    hdr.fillStyle(0xf5a623);
    hdr.fillRect(0, 60, W, 8);
    this.add.text(W / 2, 26, 'ON REWIND', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '40px', color: '#f5a623', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(W / 2, 54, 'VIDEO', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '13px', color: '#ffffff', letterSpacing: 10,
    }).setOrigin(0.5);

    this.add.text(W / 2, 92, `SHIFT ${this.shiftData.shiftNumber} COMPLETE`, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '26px', color: '#f5a623',
    }).setOrigin(0.5);

    // Shift summary
    const summaryLines = [
      `Shift earnings:  $${this.shiftData.shiftEarnings.toFixed(2)}`,
      `Career total:    $${this.totalScore.toFixed(2)}`,
      `Peak streak:     ${this.shiftData.peakStreak}×`,
      `Reputation:      ${getRepTier(this.shiftData.reputation)}  (${this.shiftData.reputation} pts)`,
    ];
    this.add.text(W / 2, 130, summaryLines.join('\n'), {
      fontFamily: '"Courier New", monospace', fontSize: '14px', color: '#ccddcc',
      lineSpacing: 8, align: 'left',
    }).setOrigin(0.5, 0);

    // Achievements
    if (this.shiftData.newAchievementIds.length > 0) {
      this.add.text(W / 2, 292, 'ACHIEVEMENTS UNLOCKED', {
        fontFamily: 'Impact, "Arial Black", sans-serif',
        fontSize: '15px', color: '#f5a623',
      }).setOrigin(0.5);
      this.shiftData.newAchievementIds.forEach((id, i) => {
        const ach = ACHIEVEMENTS.find(a => a.id === id);
        if (!ach) return;
        this.add.text(W / 2, 316 + i * 32, `★  ${ach.name} — ${ach.description}`, {
          fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#ffd700',
        }).setOrigin(0.5);
      });
    }

    // Upgrades section
    this.add.text(W / 2, this.upgradeHeaderY, 'EMPLOYEE UPGRADES', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '15px', color: '#8899aa',
    }).setOrigin(0.5);

    this.add.text(W / 2, this.upgradeHeaderY + 22, `Budget: $${this.totalScore.toFixed(2)}`, {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#556677',
    }).setOrigin(0.5);

    this.drawUpgrades(this.upgradeHeaderY + 48);

    // Next shift button
    const nextBtn = this.makeBtn(W / 2, H - 80, `START SHIFT ${this.shiftData.shiftNumber + 1}`, 0x003087, '#f5a623', () => {
      this.scene.start('GameScene', {
        shiftNumber: this.shiftData.shiftNumber + 1,
        clerkId: this.shiftData.clerkId,
        reputation: this.shiftData.reputation,
        totalScore: this.totalScore,
      });
    });
    nextBtn.setDepth(2);
  }

  private drawUpgrades(startY: number): void {
    this.upgradeObjs.forEach(o => o.destroy());
    this.upgradeObjs = [];

    UPGRADES.forEach((upg, i) => {
      const y = startY + i * 72;
      const owned = this.ownedUpgrades.has(upg.id);
      const canAfford = this.totalScore >= upg.cost;

      const gfx = this.add.graphics();
      gfx.fillStyle(owned ? 0x0a1f0a : (canAfford ? 0x0d1e2e : 0x12121a));
      gfx.fillRoundedRect(24, y, W - 48, 62, 8);
      gfx.lineStyle(1, owned ? 0x337733 : (canAfford ? 0x22334a : 0x1a1a2a), 1);
      gfx.strokeRoundedRect(24, y, W - 48, 62, 8);
      this.upgradeObjs.push(gfx);

      this.upgradeObjs.push(this.add.text(38, y + 10, upg.name, {
        fontFamily: '"Courier New", monospace', fontSize: '13px',
        color: owned ? '#44bb44' : (canAfford ? '#aabbcc' : '#445566'),
      }));
      this.upgradeObjs.push(this.add.text(38, y + 30, upg.description, {
        fontFamily: '"Courier New", monospace', fontSize: '11px', color: '#556677',
      }));

      const statusText = owned ? 'OWNED' : `$${upg.cost}`;
      const statusColor = owned ? '#44bb44' : (canAfford ? '#f5a623' : '#445566');
      this.upgradeObjs.push(this.add.text(W - 38, y + 22, statusText, {
        fontFamily: '"Courier New", monospace', fontSize: '14px', color: statusColor,
      }).setOrigin(1, 0.5));

      if (!owned && canAfford) {
        const zone = this.add.zone(W / 2, y + 31, W - 48, 62).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.buyUpgrade(upg.id, upg.cost));
        this.upgradeObjs.push(zone);
      }
    });
  }

  private buyUpgrade(id: string, cost: number): void {
    if (this.ownedUpgrades.has(id) || this.totalScore < cost) return;
    this.ownedUpgrades.add(id);
    this.totalScore -= cost;
    saveUpgrades(this.ownedUpgrades);
    this.saveTotalScore(this.totalScore);
    this.drawUpgrades(this.upgradeHeaderY + 48);
  }

  private makeBtn(
    x: number, y: number, label: string, bg: number, fg: string, fn: () => void,
  ): Phaser.GameObjects.Container {
    const gfx = this.add.graphics();
    gfx.fillStyle(bg);
    gfx.fillRoundedRect(-100, -28, 200, 56, 10);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(-100, -28, 200, 56, 10);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '19px', color: fg, align: 'center',
    }).setOrigin(0.5);
    const btn = this.add.container(x, y, [gfx, txt]).setSize(200, 56).setInteractive();
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.06, scaleY: 1.06, duration: 70 }));
    btn.on('pointerout',  () => this.tweens.add({ targets: btn, scaleX: 1.0,  scaleY: 1.0,  duration: 70 }));
    btn.on('pointerdown', fn);
    return btn;
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  private loadTotalScore(): number {
    try { return parseFloat(localStorage.getItem(LS_TOTAL_SCORE) ?? '0') || 0; }
    catch { return 0; }
  }

  private saveTotalScore(n: number): void {
    try { localStorage.setItem(LS_TOTAL_SCORE, n.toString()); }
    catch { /* storage unavailable */ }
  }
}
