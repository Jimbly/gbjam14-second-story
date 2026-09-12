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
  drawBox,
  print,
  scaleSizes,
  setFontHeight,
} from 'glov/client/ui';
import { Rec } from 'glov/common/types';
import { easeOut } from 'glov/common/util';
import { vec2, vec4 } from 'glov/common/vmath';
import {
  actionCheckBinds,
  actionEdge,
  bindsInit,
} from './binds';
import { blend } from './blend';

const { max, min, floor, PI, random, round, sin } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.REPALETTE = 99999;

// Virtual viewport for our game logic
const game_width = 160;
const game_height = 144;

const ORIGIN_CENTER = vec2(0.5, 0.5);
const PICK_W = 10;
const PICK_H = 60;

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

  bindsInit();
}

// if it doesn't match, does it at least fit-ish?
function pickFits(players: number, locks: number): boolean {
  if (locks === 3 || players === locks) {
    return true;
  }
  if (players === 1 && locks === 2) {
    return true;
  }
  return false;
}

const PICK_PAIRS: Record<number, number> = {
  1: 3,
  2: 4,

  23: 34,
  31: 24,
  14: 33,
  44: 32,
  41: 13,
  12: 21,
  42: 11,
  43: 22,
};
const COMPOUND_PICKS: number[] = [];
(function () {
  let keys = Object.keys(PICK_PAIRS);
  for (let ii = 0; ii < keys.length; ++ii) {
    let v = Number(keys[ii]);
    let other = PICK_PAIRS[v];
    PICK_PAIRS[other] = v;
    if (v > 4) {
      COMPOUND_PICKS.push(v);
    }
  }
}());

function randInt(mx: number): number {
  return floor(random() * mx);
}

type PickAnim = {
  pick: number;
  progress: number;
  failed: boolean;
  bothfit: boolean;
  t: number;
};
class PickState {
  picks = COMPOUND_PICKS.slice(0).concat([1,2]);
  is_flipped: boolean[] = [];
  selected = 0;
  lock = [1, 2, 3, 4];
  progress = 0;
  time = 5;
  anim: null | PickAnim = null;
}
let pick_state: PickState;
function stateLockPickInit(): void {
  pick_state = new PickState();
  pick_state.lock = [];
  for (let ii = 0; ii < 8; ++ii) {
    pick_state.lock.push(randInt(4) + 1);
  }
}
function drawLock(dt: number): void {
  let x = game_width - 28;
  let y = 20;
  let z = Z.UI;
  let { anim, lock } = pick_state;
  let depressed: Rec<number, number> = {};

  if (anim) {
    anim.t += dt;
    let p = anim.t / 1000;
    if (p > 1) {
      pick_state.anim = null;
    } else {
      let is_double = anim.pick > 4;
      let yanim = easeOut((p < 0.75 ? p / 0.75 : 1 - (p - 0.75) / 0.25), 2);
      const ANIM_H = 30;
      let yoffs = yanim * ANIM_H;
      let ydown = 12 - (ANIM_H - yoffs);
      let xoffs = 0;
      if (!anim.failed && p >= 0.75) {
        depressed[anim.progress] = 6;
        if (is_double) {
          depressed[anim.progress+1] = 6;
        }
      } else if (!anim.bothfit) {
        ydown = min(6, ydown);
        if (ydown === 6) {
          let vib = sin(anim.t * 0.03);
          xoffs = round(vib*vib);
        }
        if (is_double) {
          let pickb = anim.pick % 10;
          let picka = (anim.pick - pickb) / 10;
          if (pickFits(picka, lock[anim.progress])) {
            depressed[anim.progress] = max(0, ydown - 6);
          } else {
            depressed[anim.progress] = max(0, ydown);
          }
          if (pickFits(pickb, lock[anim.progress + 1])) {
            depressed[anim.progress+1] = max(0, ydown - 6);
          } else {
            depressed[anim.progress+1] = max(0, ydown);
          }
        } else {
          depressed[anim.progress] = max(0, ydown);
        }
      } else {
        depressed[anim.progress] = max(0, ydown - 6);
        if (is_double) {
          depressed[anim.progress+1] = max(0, ydown - 6);
        }
      }
      autoAtlas('gfx', `pick${anim.pick}`).withOrigin(ORIGIN_CENTER).draw({
        x: x - PICK_H/2 + (-pick_state.lock.length + anim.progress + (is_double ? 3 : 2)) * 8 + xoffs,
        y: y - PICK_W/2 + ydown,
        w: PICK_W,
        h: PICK_H,
        z: z + 1,
        rot: PI/2,
      });
    }
  }


  for (let ii = pick_state.lock.length - 1; ii >= 0; --ii) {
    let tumbler = pick_state.lock[ii];
    let leftumbler = pick_state.lock[ii - 1] || 3;
    let done = Boolean(pick_state.progress > ii && depressed[ii] !== 0 || depressed[ii]);
    let leftdone = Boolean(pick_state.progress > (ii - 1) && depressed[ii - 1] !== 0 || depressed[ii-1]);
    let vari = tumbler < 3 && leftumbler < 3 && (
      done === leftdone
    ) ? 'b' : '';

    let yy = y;
    if (depressed[ii] !== undefined) {
      yy += depressed[ii]!;
    } else if (done) {
      yy += 6;
    }
    let tumb_h = 8 - (yy - y);

    autoAtlas('gfx', `tumbler-${tumbler}${vari}`).draw({
      x, z,
      y: yy,
      w: 8, h: 8,
    });
    let spr = autoAtlas('gfx', `tumbler-${tumb_h === 2 ? 'down' : 'up'}`);
    drawBox({
      x, z,
      y: y + 8 + (8 - tumb_h),
      w: 8, h: tumb_h,
    }, spr);

    x -= 8;
  }
}

function usePick(idx: number): void {
  let { picks, lock, progress } = pick_state;
  let pick = picks[idx];
  let failed = false;
  let bothfit = true;
  if (pick <= 4) {
    if (pick === lock[progress]) {
      pick_state.progress++;
    } else {
      bothfit = pickFits(pick, lock[progress]);
      failed = true;
    }
  } else {
    let pickb = pick % 10;
    let picka = (pick - pickb) / 10;
    if (picka === lock[progress]) {
      if (pickb === lock[progress + 1]) {
        pick_state.progress+=2;
      } else if (progress === lock.length - 1) {
        pick_state.progress++;
      } else {
        failed = true;
      }
    } else {
      failed = true;
    }
    if (failed) {
      bothfit = pickFits(picka, lock[progress]) && pickFits(pickb, lock[progress + 1]);
    }
  }
  pick_state.anim = {
    t: 0,
    pick,
    progress,
    failed,
    bothfit,
  };
  if (failed && !bothfit) {
    // TODO: chance to break
  }
}
function drawPicks(): void {
  let { picks, is_flipped } = pick_state;
  if (actionEdge('right')) {
    pick_state.selected = min(pick_state.selected + 1, picks.length - 1);
  }
  if (actionEdge('left')) {
    pick_state.selected = max(pick_state.selected - 1, 0);
  }

  let x = floor((game_width - 10*10 - 4*9) / 2);
  let y = 70;
  let z = Z.UI;
  let w = PICK_W;
  let h = PICK_H;

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
    let yy = selected ? y - 8 : y;
    yy = round(blend(`pick${ii}y`, yy, 100));

    let rot = blend(`pick${ii}rot`, is_flipped[ii] ? PI : 0, 200);
    let gfx = `pick${pick}`;
    if (is_flipped[ii]) {
      if (rot < PI/2) {
        gfx = `pick${PICK_PAIRS[pick]}`;
      } else {
        rot += PI;
      }
    } else {
      if (rot > PI/2) {
        gfx = `pick${PICK_PAIRS[pick]}`;
        rot += PI;
      }
    }
    autoAtlas('gfx', gfx).withOrigin(ORIGIN_CENTER).draw({
      x: x + w/2, z: selected ? z + 1 : 1,
      y: yy + h /2,
      w, h,
      rot,
    });

    if (spot_ret.long_press || spot_ret.ret && spot_ret.button === 2 || selected && (
      actionEdge('cancel') || actionEdge('up') || actionEdge('down')
    )) {
      picks[ii] = PICK_PAIRS[pick];
      is_flipped[ii] = !is_flipped[ii];
    } else if (spot_ret.ret || selected && actionEdge('accept')) {
      usePick(ii);
    }

    x += w + 4;
  }
}
function stateLockPick(dt: number): void {
  drawLock(dt);
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
