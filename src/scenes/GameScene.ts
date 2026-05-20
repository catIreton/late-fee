import Phaser from 'phaser';
import { MOVIES } from '../data/movies';
import { CUSTOMERS } from '../data/customers';
import type { Movie, CustomerData } from '../types';

const W = 480;
const H = 854;

enum State { Idle, Arriving, Waiting, Leaving, Over }

export class GameScene extends Phaser.Scene {
  private state = State.Idle;
  private score = 0;
  private streak = 0;
  private timeLeft = 120;

  private scoreText!: Phaser.GameObjects.Text;
  private timeText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;

  private customerGfx!: Phaser.GameObjects.Graphics;
  private customerNameLabel!: Phaser.GameObjects.Text;

  private cardGfx!: Phaser.GameObjects.Graphics;
  private cardName!: Phaser.GameObjects.Text;
  private cardDialogue!: Phaser.GameObjects.Text;
  private cardMovie!: Phaser.GameObjects.Text;

  private rentBtn!: Phaser.GameObjects.Container;
  private missBtn!: Phaser.GameObjects.Container;

  private currentCustomer!: CustomerData;
  private currentMovie!: Movie;
  private customerQueue: CustomerData[] = [];
  private moviePool: Movie[] = [];

  private readonly customerPos = { x: -80 };
  private readonly CUSTOMER_X = 148;

  constructor() { super({ key: 'GameScene' }); }

  create() {
    this.score = 0;
    this.streak = 0;
    this.timeLeft = 120;
    this.state = State.Idle;
    this.customerQueue = Phaser.Utils.Array.Shuffle([...CUSTOMERS, ...CUSTOMERS]);
    this.moviePool = Phaser.Utils.Array.Shuffle([...MOVIES]);

    this.drawBackground();
    this.createHUD();
    this.createCustomerLayer();
    this.createRequestCard();
    this.createButtons();
    this.startTimer();

    this.time.delayedCall(700, () => this.spawnCustomer());
  }

  private drawBackground(): void {
    const g = this.add.graphics();

    // Base background
    g.fillStyle(0x0d1b2a);
    g.fillRect(0, 0, W, H);

    // Shelf wall
    g.fillStyle(0x152436);
    g.fillRect(0, 108, W, 280);

    // VHS boxes + shelf boards
    const boxColors = [
      0x1e90ff, 0xff4500, 0x32cd32, 0xff69b4,
      0xffd700, 0x9400d3, 0xff8c00, 0x00ced1,
    ];
    for (let row = 0; row < 3; row++) {
      const shelfY = 170 + row * 72;
      for (let col = 0; col < 13; col++) {
        const bx = 10 + col * 35;
        const by = shelfY - 52;
        const c = boxColors[(row * 13 + col) % boxColors.length];
        g.fillStyle(c);
        g.fillRect(bx, by, 28, 52);
        g.fillStyle(0xffffff, 0.1);
        g.fillRect(bx + 2, by + 4, 4, 44);
        g.fillStyle(0xffffff, 0.15);
        g.fillRect(bx + 3, by + 30, 22, 16);
      }
      g.fillStyle(0x3d2b1f);
      g.fillRect(0, shelfY, W, 12);
      g.fillStyle(0x5c3d1e);
      g.fillRect(0, shelfY, W, 3);
    }

    // Floor
    g.fillStyle(0x120e06);
    g.fillRect(0, 460, W, H - 460);

    // Counter
    g.fillStyle(0x7a5230);
    g.fillRect(0, 388, W, 4);
    g.fillStyle(0x5c3d1e);
    g.fillRect(0, 392, W, 52);
    g.fillStyle(0x3d2b1f);
    g.fillRect(0, 444, W, 28);

    // Register accent on counter
    g.fillStyle(0x222222);
    g.fillRoundedRect(W - 110, 396, 90, 40, 4);
    g.fillStyle(0x444444);
    g.fillRoundedRect(W - 106, 400, 82, 32, 3);
    g.fillStyle(0x00aa44);
    g.fillRect(W - 90, 408, 50, 10);

    // Logo bar
    g.fillStyle(0x003087);
    g.fillRect(0, 0, W, 64);
    g.fillStyle(0xf5a623);
    g.fillRect(0, 60, W, 8);

    this.add.text(W / 2, 26, 'ON REWIND', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '40px',
      color: '#f5a623',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.add.text(W / 2, 54, 'VIDEO', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '13px',
      color: '#ffffff',
      letterSpacing: 10,
    }).setOrigin(0.5);

    // Footer
    this.add.text(W / 2, H - 22, 'Be Kind, Rewind', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '13px',
      color: '#556677',
      fontStyle: 'italic',
    }).setOrigin(0.5);
  }

  private createHUD(): void {
    const g = this.add.graphics();
    g.fillStyle(0x001020);
    g.fillRect(0, 68, W, 40);

    this.scoreText = this.add.text(14, 80, '$0.00', {
      fontFamily: '"Courier New", monospace',
      fontSize: '17px',
      color: '#00ff88',
    });

    this.timeText = this.add.text(W / 2, 80, '2:00', {
      fontFamily: '"Courier New", monospace',
      fontSize: '17px',
      color: '#ffcc00',
    }).setOrigin(0.5, 0);

    this.streakText = this.add.text(W - 14, 80, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '15px',
      color: '#ff6600',
    }).setOrigin(1, 0);
  }

  private createCustomerLayer(): void {
    this.customerGfx = this.add.graphics();
    this.customerNameLabel = this.add.text(0, 0, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '12px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0);
  }

  private drawCustomer(x: number): void {
    const g = this.customerGfx;
    g.clear();
    if (!this.currentCustomer) return;

    const { color } = this.currentCustomer;
    const feetY = 432;

    // Shadow
    g.fillStyle(0x000000, 0.2);
    g.fillEllipse(x, feetY + 6, 54, 10);

    // Legs (lower body behind counter)
    g.fillStyle(this.darken(color, 40));
    g.fillRect(x - 14, feetY - 48, 12, 48);
    g.fillRect(x + 3, feetY - 48, 12, 48);

    // Body
    g.fillStyle(color);
    g.fillRoundedRect(x - 26, feetY - 120, 52, 74, 7);

    // Collar detail
    g.fillStyle(this.darken(color, 25));
    g.fillTriangle(x - 12, feetY - 120, x + 12, feetY - 120, x, feetY - 104);

    // Head
    g.fillStyle(0xf5cba7);
    g.fillCircle(x, feetY - 138, 22);

    // Hair
    g.fillStyle(this.darken(0xf5cba7, 70));
    g.fillCircle(x, feetY - 158, 22);
    g.fillRect(x - 22, feetY - 162, 44, 20);

    // Eyes
    g.fillStyle(0x222222);
    g.fillCircle(x - 8, feetY - 142, 3);
    g.fillCircle(x + 8, feetY - 142, 3);

    // Mouth
    g.fillStyle(0x9b5c3c);
    for (let i = -2; i <= 2; i++) {
      g.fillCircle(x + i * 3, feetY - 125 + Math.abs(i), 1.5);
    }

    this.customerNameLabel.setPosition(x, feetY + 10).setText(this.currentCustomer.name);
  }

  private createRequestCard(): void {
    this.cardGfx = this.add.graphics();

    this.cardName = this.add.text(W / 2, 474, '', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#888888',
      letterSpacing: 3,
    }).setOrigin(0.5, 0).setVisible(false);

    this.cardDialogue = this.add.text(W / 2, 496, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#111111',
      wordWrap: { width: 390 },
      align: 'center',
      lineSpacing: 5,
    }).setOrigin(0.5, 0).setVisible(false);

    this.cardMovie = this.add.text(W / 2, 580, '', {
      fontFamily: '"Arial Black", "Arial Bold", sans-serif',
      fontSize: '13px',
      color: '#003087',
    }).setOrigin(0.5, 0).setVisible(false);
  }

  private showCard(visible: boolean): void {
    this.cardGfx.clear();
    [this.cardName, this.cardDialogue, this.cardMovie].forEach(t => t.setVisible(visible));
    if (!visible) return;

    const g = this.cardGfx;
    g.fillStyle(0xfafaf5);
    g.fillRoundedRect(16, 464, W - 32, 156, 12);
    g.lineStyle(2, 0xddddcc, 1);
    g.strokeRoundedRect(16, 464, W - 32, 156, 12);
    g.fillStyle(this.currentCustomer.color);
    g.fillRoundedRect(16, 464, W - 32, 6, { tl: 12, tr: 12, bl: 0, br: 0 });

    this.cardName.setText(this.currentCustomer.name.toUpperCase()).setVisible(true);
    this.cardDialogue.setText(`"${this.currentCustomer.dialogue}"`).setVisible(true);
    this.cardMovie
      .setText(`Suggestion: ${this.currentMovie.title} (${this.currentMovie.year})`)
      .setVisible(true);
  }

  private createButtons(): void {
    this.rentBtn = this.makeBtn(
      W * 0.27, 692,
      'RENT IT\n$3.00', 0x003087, '#f5a623',
      () => this.onRent(),
    );
    this.missBtn = this.makeBtn(
      W * 0.73, 692,
      "CAN'T\nFIND IT", 0x7a0000, '#ffffff',
      () => this.onMiss(),
    );
    this.setButtons(false);
  }

  private makeBtn(
    x: number, y: number,
    label: string, bg: number, fg: string,
    fn: () => void,
  ): Phaser.GameObjects.Container {
    const gfx = this.add.graphics();
    gfx.fillStyle(bg);
    gfx.fillRoundedRect(-84, -40, 168, 80, 12);
    gfx.lineStyle(3, 0xffffff, 0.2);
    gfx.strokeRoundedRect(-84, -40, 168, 80, 12);

    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '21px',
      color: fg,
      align: 'center',
      lineSpacing: 3,
    }).setOrigin(0.5);

    const btn = this.add.container(x, y, [gfx, txt]).setSize(168, 80).setInteractive();
    btn.on('pointerover', () => this.tweens.add({ targets: btn, scaleX: 1.07, scaleY: 1.07, duration: 70 }));
    btn.on('pointerout', () => this.tweens.add({ targets: btn, scaleX: 1.0, scaleY: 1.0, duration: 70 }));
    btn.on('pointerdown', fn);
    return btn;
  }

  private setButtons(visible: boolean): void {
    this.rentBtn.setVisible(visible);
    this.missBtn.setVisible(visible);
  }

  private startTimer(): void {
    this.time.addEvent({
      delay: 1000,
      repeat: 119,
      callback: () => {
        this.timeLeft = Math.max(0, this.timeLeft - 1);
        const m = Math.floor(this.timeLeft / 60);
        const s = this.timeLeft % 60;
        this.timeText.setText(`${m}:${s.toString().padStart(2, '0')}`);
        if (this.timeLeft === 0) this.endShift();
      },
    });
  }

  private spawnCustomer(): void {
    if (this.state === State.Over || this.timeLeft <= 0) return;

    if (!this.customerQueue.length) {
      this.customerQueue = Phaser.Utils.Array.Shuffle([...CUSTOMERS, ...CUSTOMERS]);
    }
    if (!this.moviePool.length) {
      this.moviePool = Phaser.Utils.Array.Shuffle([...MOVIES]);
    }

    this.currentCustomer = this.customerQueue.pop()!;
    this.currentMovie = this.moviePool.pop()!;
    this.customerPos.x = -80;
    this.state = State.Arriving;

    this.tweens.add({
      targets: this.customerPos,
      x: this.CUSTOMER_X,
      duration: 550,
      ease: 'Power2.easeOut',
      onUpdate: () => this.drawCustomer(this.customerPos.x),
      onComplete: () => {
        this.state = State.Waiting;
        this.showCard(true);
        this.setButtons(true);
        [this.rentBtn, this.missBtn].forEach(b => {
          b.setAlpha(0);
          this.tweens.add({ targets: b, alpha: 1, duration: 180 });
        });
      },
    });
  }

  private onRent(): void {
    if (this.state !== State.Waiting) return;
    this.state = State.Leaving;
    this.streak++;
    const mult = this.streak >= 3 ? 1.5 : 1.0;
    const earned = 3 * mult;
    this.score += earned;
    this.scoreText.setText(`$${this.score.toFixed(2)}`);
    this.streakText.setText(this.streak >= 3 ? `${this.streak}x STREAK!` : '');
    this.floatText(`+$${earned.toFixed(2)}`, this.CUSTOMER_X, 340, '#00ff88');
    this.departCustomer();
  }

  private onMiss(): void {
    if (this.state !== State.Waiting) return;
    this.state = State.Leaving;
    this.streak = 0;
    this.streakText.setText('');
    this.floatText('Sorry...', this.CUSTOMER_X, 340, '#ff5555');
    this.departCustomer();
  }

  private departCustomer(): void {
    this.setButtons(false);
    this.showCard(false);

    this.tweens.add({
      targets: this.customerPos,
      x: W + 80,
      duration: 460,
      ease: 'Power2.easeIn',
      onUpdate: () => this.drawCustomer(this.customerPos.x),
      onComplete: () => {
        this.customerGfx.clear();
        this.customerNameLabel.setText('');
        this.state = State.Idle;
        if (this.timeLeft > 0) {
          this.time.delayedCall(
            Phaser.Math.Between(700, 1500),
            () => this.spawnCustomer(),
          );
        }
      },
    });
  }

  private floatText(msg: string, x: number, y: number, color: string): void {
    const t = this.add.text(x, y, msg, {
      fontFamily: 'Impact, sans-serif',
      fontSize: '28px',
      color,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: t,
      y: y - 80,
      alpha: 0,
      duration: 1000,
      ease: 'Power2.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private endShift(): void {
    if (this.state === State.Over) return;
    this.state = State.Over;
    this.setButtons(false);
    this.showCard(false);

    const overlay = this.add.graphics().setDepth(20);
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, W, H);
    overlay.setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 500 });

    const title = this.add.text(W / 2, H / 2 - 110, 'SHIFT OVER!', {
      fontFamily: 'Impact, "Arial Black", sans-serif',
      fontSize: '54px',
      color: '#f5a623',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(21).setAlpha(0);
    this.tweens.add({ targets: title, alpha: 1, y: H / 2 - 120, duration: 600, delay: 250 });

    this.time.delayedCall(650, () => {
      const summary = this.add.text(W / 2, H / 2 - 30, [
        `Earned: $${this.score.toFixed(2)}`,
        `Best streak: ${this.streak}x`,
      ].join('\n'), {
        fontFamily: '"Courier New", monospace',
        fontSize: '24px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 12,
      }).setOrigin(0.5).setDepth(21).setAlpha(0);
      this.tweens.add({ targets: summary, alpha: 1, duration: 400 });

      const again = this.makeBtn(W / 2, H / 2 + 130, 'PLAY AGAIN', 0x003087, '#f5a623', () => this.scene.restart());
      again.setDepth(21).setAlpha(0);
      this.tweens.add({ targets: again, alpha: 1, duration: 400, delay: 300 });
    });
  }

  private darken(color: number, amount: number): number {
    const clamp = (v: number) => Math.max(0, v - amount);
    return (clamp(color >> 16 & 0xff) << 16) | (clamp(color >> 8 & 0xff) << 8) | clamp(color & 0xff);
  }
}
