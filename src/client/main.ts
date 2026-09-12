/* eslint n/global-require:off */
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage');
local_storage.setStoragePrefix('glovjs-playground'); // Before requiring anything else that might load from this

import { autoAtlas } from 'glov/client/autoatlas';
import * as camera2d from 'glov/client/camera2d';
import { platformParameterGet } from 'glov/client/client_config';
import { applyCopy, effectsQueue, registerShader } from 'glov/client/effects';
import * as engine from 'glov/client/engine';
import { Font, fontCreate, fontStyleColored, vec4ColorFromIntColor } from 'glov/client/font';
import { markdownAuto } from 'glov/client/markdown';
import { markdownSetColorStyles } from 'glov/client/markdown_renderables';
import { netInit } from 'glov/client/net';
import { spot, SPOT_DEFAULT_BUTTON } from 'glov/client/spot';
import { spriteSetGet } from 'glov/client/sprite_sets';
import {
  drawBox,
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
import './dialog_data'; // side effects
import { dialog, dialogReset, dialogRun, dialogStartup } from './dialog_system';
import { game_height, game_width } from './globals';
import { finishUnlocking, stateHeist, stateHeistInit } from './heist';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { ceil, max, min, floor, PI, pow, random, round, sin } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
Z.SPRITES = 10;
Z.WALLS = 5;
Z.CHESTS = 5;
Z.DOORS = 9;
Z.HERO = 10;
Z.GUARD = 11;
Z.FLOATERS = 15;
Z.REPALETTE = 99999;


const ORIGIN_CENTER = vec2(0.5, 0.5);
const PICK_W = 10;
const PICK_H = 60;

let font: Font;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let font_tiny: Font;

// const palette_font = [
//   0x081820ff,
//   0x346856ff,
//   0x88c070ff,
//   0xe0f8d0ff,
// ];
const palette_font = [
  0x080408ff,
  0x682e5bff,
  0xd27032ff,
  0xfcea9cff,
];
const palette = palette_font.map((c) => {
  return vec4ColorFromIntColor(vec4(), c);
});

const font_style0 = fontStyleColored(null, palette_font[0]);
const font_style1 = fontStyleColored(null, palette_font[1]);
const font_style2 = fontStyleColored(null, palette_font[2]);
const font_style3 = fontStyleColored(null, palette_font[3]);


function init(): void {
  registerShader('repalette', {
    fp: 'shaders/repalette.fp',
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

class PlayerState {
  money = 0;
  mode: 'status' | 'unlock' | 'heist' = 'status';
}
let player_state = new PlayerState();

function newGameInit(): void {
  player_state = new PlayerState();
  player_state.mode = 'status';
  dialogReset();
  dialog('choose');
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
  bonus = 0;
  last_bonus = 0;
  anim: null | PickAnim = null;
}
let pick_state: PickState;
function stateLockPickInit(): void {
  pick_state = new PickState();
  pick_state.lock = [];
  for (let ii = 0; ii < 4; ++ii) {
    pick_state.lock.push(randInt(4) + 1);
  }
}
function drawLock(dt: number): void {
  let { anim, lock } = pick_state;
  let x0 = 17;
  let x1 = x0 + lock.length * 8 + 10;
  let x = x1 - 9;
  let y = 30;
  let z = Z.UI;
  let depressed: Rec<number, number> = {};

  autoAtlas('gfx', 'lock1').draw({
    x: 1,
    y: y - 8,
    w: 14,
    h: 26,
    z: Z.BACKGROUND + 1,
  });

  if (anim) {
    anim.t += dt;
    let p = anim.t / 1000;
    if (p > 1) {
      pick_state.anim = null;
    } else {
      let is_double = anim.pick > 4;
      let yanim = easeOut((p < 0.75 ? p / 0.75 : 1 - (p - 0.75) / 0.25), 2);
      const ANIM_H = 30;
      let xoffs = 0;
      let yoffs = yanim * ANIM_H;
      let ydown = 12 - (ANIM_H - yoffs);
      if (ydown < 0) {
        xoffs = ydown;
        ydown = 0;
      }
      if (!anim.failed && p >= 0.75) {
        depressed[anim.progress] = 6;
        if (is_double) {
          depressed[anim.progress+1] = 6;
        }
      } else if (!anim.bothfit) {
        ydown = min(6, ydown);
        if (ydown === 6) {
          let vib = sin(anim.t * 0.03);
          xoffs += round(vib*vib);
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
      let pick_spr = autoAtlas('gfx', `pick${anim.pick}`).withOrigin(ORIGIN_CENTER);
      let pick_rect = {
        x: x - PICK_H/2 + (-pick_state.lock.length + anim.progress + (is_double ? 3 : 2)) * 8 + xoffs,
        y: y - PICK_W/2 + ydown,
        w: PICK_W,
        h: PICK_H,
        z: z + 1,
        rot: PI/2,
      };
      pick_spr.draw(pick_rect);
      // draw shadow
      pick_spr.draw({
        ...pick_rect,
        x: pick_rect.x,
        y: pick_rect.y - 1,
        z: Z.BACKGROUND + 2,
        color: [0.7, 0.7, 0.7, 1],
      });
      pick_spr.draw({
        ...pick_rect,
        x: pick_rect.x,
        y: pick_rect.y + 1,
        z: Z.BACKGROUND + 2,
        color: [0.5, 0.5, 0.5, 1],
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

  drawBox({
    x: x0,
    y: y - 11,
    h: 30,
    w: x1 - x + 2,
    z: Z.BACKGROUND + 3,
  }, autoAtlas('gfx', 'box'));

}

function usePick(idx: number): void {
  let { picks, lock, progress } = pick_state;
  let pick = picks[idx];
  let failed = false;
  let bothfit = true;
  if (pick <= 4) {
    if (pick === lock[progress]) {
      pick_state.progress++;
      pick_state.bonus += 5;
    } else {
      bothfit = pickFits(pick, lock[progress]);
      failed = true;
      pick_state.bonus = max(0, pick_state.bonus - 10);
    }
  } else {
    let pickb = pick % 10;
    let picka = (pick - pickb) / 10;
    let only_one_target = progress === lock.length - 1;
    if (picka === lock[progress]) {
      if (pickb === lock[progress + 1]) {
        pick_state.progress+=2;
      } else if (only_one_target) {
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
    if (failed) {
      pick_state.bonus = max(0, pick_state.bonus - 10);
    } else {
      pick_state.bonus += only_one_target ? 5 : 20;
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

  let x = 15;
  let y = 67;
  let z = Z.UI;
  let w = PICK_W;
  let h = PICK_H;

  let disabled = pick_state.progress === pick_state.lock.length;
  for (let ii = 0; ii < picks.length; ++ii) {
    let pick = picks[ii];
    let rect = {
      x, y, w, h,
    };
    let spot_ret = spot({
      def: SPOT_DEFAULT_BUTTON,
      button_long_press: true,
      disabled,
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

    if (!disabled) {
      if (spot_ret.long_press || spot_ret.ret && spot_ret.button === 2 || selected && (
        actionEdge('cancel') || actionEdge('up') || actionEdge('down')
      )) {
        picks[ii] = PICK_PAIRS[pick];
        is_flipped[ii] = !is_flipped[ii];
      } else if (spot_ret.ret || selected && actionEdge('accept')) {
        usePick(ii);
      }
    }

    x += w + 4;
  }
}

function drawPickingHUD(): void {
  let x = 2;
  let y = 2;
  let h = 11;
  let w = 83;
  let z = Z.UI;
  drawBox({
    x, y, h, w,
    z: z - 1,
  }, autoAtlas('gfx', 'box'));

  let bonus = pick_state.anim ? pick_state.last_bonus : pick_state.bonus;
  pick_state.last_bonus = bonus;
  let extra = '';
  if (pick_state.progress !== pick_state.lock.length) {
    let selected = pick_state.picks[pick_state.selected];
    if (selected > 4 && pick_state.progress < pick_state.lock.length - 1) {
      extra = '+20';
    } else {
      extra = '+5';
    }
  } else {
    // done, show bonus even during animation
    bonus = pick_state.bonus;
  }
  let eff_bonus = blend('bonus', bonus);
  let max_bonus = ceil(pick_state.lock.length / 2) * 20;
  drawBox({
    x: x + 1,
    y: y + 1,
    h: h - 2,
    w: round((eff_bonus / max_bonus) * (w - 1)),
    z,
  }, autoAtlas('gfx', 'bar'));
  markdownAuto({
    font_style: font_style1,
    x: x + 2, y: y + 2, z: z + 1, w, h,
    text: `BONUS: $${round(eff_bonus)}[c=3]${extra}[/c]`,
  });
}

function leavePicking(): void {
  finishUnlocking(pick_state.progress === pick_state.lock.length, pick_state.bonus);
  player_state.mode = 'heist';
}

function stateLockPick(dt: number): void {
  autoAtlas('gfx', 'lockpick-bg').draw({
    x: 0, y: 0, w: game_width, h: game_height,
    z: Z.BACKGROUND,
  });
  drawLock(dt);
  drawPicks();
  drawPickingHUD();
  if (
    !pick_state.anim && pick_state.progress === pick_state.lock.length ||
    actionEdge('select')
  ) {
    leavePicking();
  }
}

function topOfFrame(): void {
  camera2d.setAspectFixed(game_width, game_height);
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
}

export function startUnlocking(): void {
  stateLockPickInit();
  player_state.mode = 'unlock';
}

export function startHeist(index: number): void {
  player_state.mode = 'heist';
  stateHeistInit(index);
}

function stateStatus(dt: number): void {
  dialogRun(
    dt,
    {
      x: 0,
      y: game_height / 2,
      w: game_width,
      h: game_height / 2,
      pad_lr: 3,
      pad_top: 3,
      pad_bottom: 3,
      pad_bottom_with_buttons: 3,
    },
    false,
  );
}

function statePlay(dt: number): void {
  topOfFrame();
  if (player_state.mode === 'unlock') {
    return stateLockPick(dt);
  } else if (player_state.mode === 'heist') {
    return stateHeist(dt);
  } else if (player_state.mode === 'status') {
    return stateStatus(dt);
  }
}

export function main(): void {
  if (platformParameterGet('reload_updates') && engine.DEBUG) {
    // Enable auto-reload, etc
    netInit({ engine });
  }

  const font_info_04b03x1 = require('./img/font/04b03_8x1.json');
  const font_info_gbj14 = require('./img/font/gbj14.json');
  let pixely = 'strict';
  let ui_sprites;
  let font_def = { info: font_info_gbj14, texture: 'font/gbj14' };
  ui_sprites = spriteSetGet('pixely');
  let pixel_perfect = 1;

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
  font = engine.font;
  font_tiny = fontCreate(font_info_04b03x1, 'font/04b03_8x1');

  // Perfect sizes for pixely modes
  scaleSizes(13 / 32);
  setFontHeight(8);

  init();

  markdownSetColorStyles([
    font_style0,
    font_style1,
    font_style2,
    font_style3,
  ]);

  dialogStartup({
    font,
    style_default: font_style1,
  });

  // preload
  autoAtlas('gfx', 'box');

  newGameInit();
  engine.setState(statePlay);
  //startUnlocking();
}
