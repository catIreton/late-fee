import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Asset loading goes here as art is added
  }

  create() {
    this.scene.start('GameScene');
  }
}
