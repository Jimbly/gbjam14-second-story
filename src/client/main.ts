/* eslint n/global-require:off */
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage');
local_storage.setStoragePrefix('glovjs-playground'); // Before requiring anything else that might load from this

import { autoAtlas } from 'glov/client/autoatlas';
import { platformParameterGet } from 'glov/client/client_config';
import { applyCopy, effectsQueue, registerShader } from 'glov/client/effects';
import * as engine from 'glov/client/engine';
import { getFrameTimestamp } from 'glov/client/engine';
import { vec4ColorFromIntColor } from 'glov/client/font';
import { netInit } from 'glov/client/net';
import { spot, SPOT_DEFAULT_BUTTON } from 'glov/client/spot';
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
import {
  ACTION_EVENT,
  ACTION_STATE,
  actionBindKB,
  actionBindPad,
  actionCheckBinds,
  actionEdge,
  actionRegister,
} from './binds';

const { max, min, floor, random, sin } = Math;

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

  actionRegister('up', ACTION_STATE);
  actionRegister('left', ACTION_STATE);
  actionRegister('down', ACTION_STATE);
  actionRegister('right', ACTION_STATE);
  actionRegister('select', ACTION_EVENT);
  actionRegister('start', ACTION_EVENT);
  actionRegister('accept', ACTION_EVENT);
  actionRegister('cancel', ACTION_EVENT);
  actionBindKB('UP', 'up');
  actionBindKB('W', 'up');
  actionBindKB('I', 'up');
  actionBindKB('LEFT', 'left');
  actionBindKB('A', 'left');
  actionBindKB('J', 'left');
  actionBindKB('DOWN', 'down');
  actionBindKB('S', 'down');
  actionBindKB('K', 'down');
  actionBindKB('RIGHT', 'right');
  actionBindKB('D', 'right');
  actionBindKB('L', 'right');
  actionBindKB('Z', 'cancel');
  actionBindKB('X', 'accept');
  actionBindKB('C', 'cancel');
  actionBindKB('Q', 'select');
  actionBindKB('E', 'start');
  actionBindKB('SPACE', 'accept');
  actionBindKB('ESC', 'cancel');
  actionBindKB('BACKSPACE', 'cancel');
  actionBindKB('BRACKET_LEFT', 'select');
  actionBindKB('BRACKET_RIGHT', 'start');
  actionBindKB('SHIFT', 'select');
  actionBindKB('ENTER', 'start');

  actionBindPad('SELECT', 'accept');
  actionBindPad('CANCEL', 'cancel');
  actionBindPad('X', 'accept');
  actionBindPad('Y', 'cancel');
  actionBindPad('LEFT_BUMPER', 'accept');
  actionBindPad('RIGHT_BUMPER', 'accept');
  actionBindPad('LEFT_TRIGGER', 'cancel');
  actionBindPad('RIGHT_TRIGGER', 'cancel');
  actionBindPad('BACK', 'select');
  actionBindPad('START', 'start');
  actionBindPad('LEFT_STICK', 'accept');
  actionBindPad('RIGHT_STICK', 'accept');
  actionBindPad('UP', 'up');
  actionBindPad('DOWN', 'down');
  actionBindPad('LEFT', 'left');
  actionBindPad('RIGHT', 'right');
  actionBindPad('ANALOG_UP', 'up');
  actionBindPad('ANALOG_LEFT', 'left');
  actionBindPad('ANALOG_DOWN', 'down');
  actionBindPad('ANALOG_RIGHT', 'right');
  actionBindPad('LSTICK_UP', 'up');
  actionBindPad('LSTICK_LEFT', 'left');
  actionBindPad('LSTICK_DOWN', 'down');
  actionBindPad('LSTICK_RIGHT', 'right');
  actionBindPad('RSTICK_UP', 'up');
  actionBindPad('RSTICK_LEFT', 'left');
  actionBindPad('RSTICK_DOWN', 'down');
  actionBindPad('RSTICK_RIGHT', 'right');
}

const PICK_PAIRS: Record<number, number> = {
  1: 3,
  2: 4,
};
(function () {
  let keys = Object.keys(PICK_PAIRS);
  for (let ii = 0; ii < keys.length; ++ii) {
    let v = Number(keys[ii]);
    let other = PICK_PAIRS[v];
    PICK_PAIRS[other] = v;
  }
}());

function randInt(mx: number): number {
  return floor(random() * mx);
}

class PickState {
  picks = [1, 2];
  selected = 0;
  lock = [1, 2, 3, 4];
  progress = 0;
  time = 5;
}
let pick_state: PickState;
function stateLockPickInit(): void {
  pick_state = new PickState();
  pick_state.lock = [];
  for (let ii = 0; ii < 8; ++ii) {
    pick_state.lock.push(randInt(4) + 1);
  }
}
function drawLock(): void {
  let x = game_width - 28;
  let y = 20;
  let z = Z.UI;
  for (let ii = pick_state.lock.length - 1; ii >= 0; --ii) {
    let tumbler = pick_state.lock[ii];
    let leftumbler = pick_state.lock[ii - 1] || 3;
    let done = pick_state.progress > ii;
    let leftdone = pick_state.progress > (ii - 1);
    let vari = tumbler < 3 && leftumbler < 3 && done === leftdone ? 'b' : '';
    autoAtlas('gfx', `tumbler-${tumbler}${vari}`).draw({
      x, z,
      y: done ? y + 6 : y,
      w: 8, h: 8,
    });
    autoAtlas('gfx', `tumbler-${done ? 'down' : 'up'}`).draw({
      x, z,
      y: y + 8,
      w: 8, h: 8,
    });
    x -= 8;
  }
}
function usePick(idx: number): void {
  let { picks, lock, progress } = pick_state;
  let pick = picks[idx];
  if (pick === lock[progress]) {
    pick_state.progress++;
  } else {
    // chance to break lock
  }
}
function drawPicks(): void {
  let { picks } = pick_state;
  if (actionEdge('right')) {
    pick_state.selected = min(pick_state.selected + 1, picks.length - 1);
  }
  if (actionEdge('left')) {
    pick_state.selected = max(pick_state.selected - 1, 0);
  }

  let x = 20;
  let y = 70;
  let z = Z.UI;
  let w = 10;
  let h = 60;

  for (let ii = 0; ii < picks.length; ++ii) {
    let pick = picks[ii];
    let rect = {
      x, y, w, h,
    };
    let spot_ret = spot({
      def: SPOT_DEFAULT_BUTTON,
      button_long_press: true,
      ...rect,
    });
    if (spot_ret.focused) {
      pick_state.selected = ii;
    }
    let selected = ii === pick_state.selected;
    autoAtlas('gfx', `pick${pick}`).draw({
      x, z,
      y: selected ? y - 8 : y,
      w, h,
    });

    if (spot_ret.long_press || spot_ret.ret && spot_ret.button === 2 || selected && (
      actionEdge('cancel') || actionEdge('up') || actionEdge('down')
    )) {
      picks[ii] = PICK_PAIRS[pick];
    } else if (spot_ret.ret || selected && actionEdge('accept')) {
      usePick(ii);
    }

    x += w + 4;
  }
}
function stateLockPick(dt: number): void {
  drawLock();
  drawPicks();
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
  actionCheckBinds();

  if (1) {
    return stateLockPick(dt);
  }

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
    show_fps: false,
  })) {
    return;
  }
  // let font = engine.font;

  // Perfect sizes for pixely modes
  scaleSizes(13 / 32);
  setFontHeight(8);

  init();

  stateLockPickInit();
  engine.setState(statePlay);
}
