/* eslint n/global-require:off */
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage');
local_storage.setStoragePrefix('glovjs-playground'); // Before requiring anything else that might load from this

import { platformParameterGet } from 'glov/client/client_config';
import { applyCopy, effectsQueue, registerShader } from 'glov/client/effects';
import * as engine from 'glov/client/engine';
import { getFrameTimestamp } from 'glov/client/engine';
import { vec4ColorFromIntColor } from 'glov/client/font';
import { netInit } from 'glov/client/net';
import { spriteSetGet } from 'glov/client/sprite_sets';
import {
  Sprite,
  spriteCreate,
} from 'glov/client/sprites';
import {
  print,
  scaleSizes,
  setFontHeight,
} from 'glov/client/ui';
import { vec4 } from 'glov/common/vmath';

const { sin } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.REPALETTE = 99999;

// Virtual viewport for our game logic
const game_width = 160;
const game_height = 144;

const palette_font = [
  0x081820ff,
  0x346856ff,
  0x88c070ff,
  0xe0f8d0ff,
];
const palette = palette_font.map((c) => {
  return vec4ColorFromIntColor(vec4(), c);
});


let sprite_test: Sprite;
function init(): void {
  registerShader('repalette', {
    fp: 'shaders/repalette.fp',
  });
  sprite_test = spriteCreate({
    name: 'test',
  });
}

function statePlay(dt: number): void {
  effectsQueue(Z.REPALETTE, function () {
    applyCopy({
      shader: 'repalette',
      params: {
        param: [1, 1],
        pal0: palette[0],
        pal1: palette[1],
        pal2: palette[2],
        pal3: palette[3],
      },
    });
  });


  print(null,10,10,1, 'Test!');
  sprite_test.draw({
    x: 20 + sin(getFrameTimestamp() * 0.005) * 20,
    y: 20,
    w: 10,
    h: 10,
  });
}

export function main(): void {
  if (platformParameterGet('reload_updates') && engine.DEBUG) {
    // Enable auto-reload, etc
    netInit({ engine });
  }

  const font_info_04b03x2 = require('./img/font/04b03_8x2.json');
  const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  const font_info_palanquin32 = require('./img/font/palanquin32.json');
  let pixely = 'strict';
  let font_def;
  let ui_sprites;
  let pixel_perfect = 1;
  if (pixely === 'strict') {
    font_def = { info: font_info_04b03x1, texture: 'font/04b03_8x1' };
    ui_sprites = spriteSetGet('pixely');
    pixel_perfect = 1;
  } else if (pixely && pixely !== 'off') {
    font_def = { info: font_info_04b03x2, texture: 'font/04b03_8x2' };
    ui_sprites = spriteSetGet('pixely');
  } else {
    font_def = { info: font_info_palanquin32, texture: 'font/palanquin32' };
  }

  if (!engine.startup({
    game_width,
    game_height,
    pixely,
    font: font_def,
    viewport_postprocess: false,
    antialias: false,
    ui_sprites,
    pixel_perfect,
  })) {
    return;
  }
  // let font = engine.font;

  // Perfect sizes for pixely modes
  scaleSizes(13 / 32);
  setFontHeight(8);

  init();

  engine.setState(statePlay);
}
