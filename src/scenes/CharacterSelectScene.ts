import Phaser from 'phaser';
import { CLERKS } from '../data/clerks';
import type { Clerk } from '../types';

const W = 480;
const H = 854;

const LS_CLERK = 'lateFee_clerkId';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'CharacterSelectScene' }); }

  create() {
    const bg = this.add.graphics();
    bg.fillStyle(0x000d1a);
    bg.fillRect(0, 0, W, H);

    // Header
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

    this.add.text(W / 2, 100, 'CHOOSE YOUR CLERK', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '28px', color: '#f5a623',
    }).setOrigin(0.5);

    this.add.text(W / 2, 134, 'Your passive bonus lasts the whole session', {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#667788',
    }).setOrigin(0.5);

    const savedId = this.loadSavedClerk();
    CLERKS.forEach((clerk, i) => this.drawClerkCard(clerk, i, savedId));

    this.add.text(W / 2, H - 24, 'Be Kind, Rewind', {
      fontFamily: 'Arial, sans-serif', fontSize: '13px', color: '#334455', fontStyle: 'italic',
    }).setOrigin(0.5);
  }

  private drawClerkCard(clerk: Clerk, index: number, savedId: string): void {
    const cardY = 190 + index * 200;
    const isDefault = clerk.id === savedId;

    const gfx = this.add.graphics();
    const drawCard = (hover: boolean) => {
      gfx.clear();
      gfx.fillStyle(hover ? 0x152a40 : 0x0d1e2e);
      gfx.fillRoundedRect(24, cardY, W - 48, 176, 12);
      gfx.lineStyle(2, hover ? clerk.color : (isDefault ? clerk.color : 0x22334a), 1);
      gfx.strokeRoundedRect(24, cardY, W - 48, 176, 12);
      gfx.fillStyle(clerk.color);
      gfx.fillRoundedRect(24, cardY, W - 48, 6, { tl: 12, tr: 12, bl: 0, br: 0 });
    };
    drawCard(isDefault);

    // Avatar circle
    const avGfx = this.add.graphics();
    avGfx.fillStyle(clerk.color);
    avGfx.fillCircle(72, cardY + 50, 22);
    avGfx.fillStyle(0xf5cba7);
    avGfx.fillCircle(72, cardY + 42, 14);
    avGfx.fillStyle(0x222222);
    avGfx.fillCircle(68, cardY + 40, 2);
    avGfx.fillCircle(76, cardY + 40, 2);

    this.add.text(112, cardY + 22, clerk.name, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '24px', color: '#ffffff',
    });
    this.add.text(112, cardY + 52, clerk.title, {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: `#${clerk.color.toString(16).padStart(6, '0')}`,
    });
    this.add.text(36, cardY + 88, clerk.description, {
      fontFamily: '"Courier New", monospace', fontSize: '13px', color: '#aabbcc',
      wordWrap: { width: W - 80 },
    });

    const selectBtn = this.add.container(W / 2, cardY + 148).setSize(W - 48, 176);
    selectBtn.setInteractive({ useHandCursor: true });
    selectBtn.on('pointerover', () => { drawCard(true); });
    selectBtn.on('pointerout',  () => { drawCard(false); });
    selectBtn.on('pointerdown', () => this.selectClerk(clerk));

    if (isDefault) {
      this.add.text(W - 40, cardY + 16, 'LAST USED', {
        fontFamily: '"Courier New", monospace', fontSize: '9px', color: '#f5a623',
      }).setOrigin(1, 0);
    }
  }

  private selectClerk(clerk: Clerk): void {
    this.saveClerk(clerk.id);
    this.scene.start('GameScene', { shiftNumber: 1, clerkId: clerk.id });
  }

  private loadSavedClerk(): string {
    try { return localStorage.getItem(LS_CLERK) ?? CLERKS[0].id; }
    catch { return CLERKS[0].id; }
  }

  private saveClerk(id: string): void {
    try { localStorage.setItem(LS_CLERK, id); }
    catch { /* storage unavailable */ }
  }
}
