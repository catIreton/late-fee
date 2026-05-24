import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { BetweenShiftScene } from './scenes/BetweenShiftScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 854,
  backgroundColor: '#000000',
  scene: [BootScene, CharacterSelectScene, BetweenShiftScene, GameScene],
  parent: 'tv-screen',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 3,
  },
};

new Phaser.Game(config);
