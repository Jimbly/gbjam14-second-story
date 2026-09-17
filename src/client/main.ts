/* eslint n/global-require:off */
// eslint-disable-next-line import/order
const local_storage = require('glov/client/local_storage');
local_storage.setStoragePrefix('gbj14'); // Before requiring anything else that might load from this

export const GOALS = {
  intro0: 'Enjoy peaceful retirement in a new town',
  intro1: 'Enjoy peaceful retirement in a new town',
  mugged: 'Find out who robbed me',
  informant1: 'Bribe informant',
  search1: 'Search the Foulmouth residence',
  find2a: 'Find Strongfist Manor',
  find2b: 'Search Strongfist Manor',
  buytreat: 'Deal with the cats',
  search2: 'Search Strongfist Manor',
  find3a: 'Find Ramirrors',
  find3b: 'Rob Goldenhare Palace',
  find3c: 'Learn about the private security',
  buygift: 'Deal with the shady guard',
  search3: 'Rob Goldenhare Palace',
  outtahere: 'Get Outta Town',
};
export type GoalID = keyof typeof GOALS;
export const GOAL_LIST = Object.keys(GOALS) as GoalID[];

import assert from 'assert';
import { autoAtlas } from 'glov/client/autoatlas';
import * as camera2d from 'glov/client/camera2d';
import { platformParameterGet } from 'glov/client/client_config';
import { applyCopy, effectsQueue, registerShader } from 'glov/client/effects';
import * as engine from 'glov/client/engine';
import { ALIGN, Font, fontCreate, fontStyleColored, vec4ColorFromIntColor } from 'glov/client/font';
import { inputPadMode, keyDownEdge, KEYS } from 'glov/client/input';
import { localStorageGet, localStorageGetJSON, localStorageSetJSON } from 'glov/client/local_storage';
import { markdownAuto } from 'glov/client/markdown';
import { markdownSetColorStyles } from 'glov/client/markdown_renderables';
import { netInit } from 'glov/client/net';
import { settingsGet } from 'glov/client/settings';
import { shaderCreate } from 'glov/client/shaders';
import { spot, SPOT_DEFAULT_BUTTON } from 'glov/client/spot';
import { spriteSetGet } from 'glov/client/sprite_sets';
import { Shader, Sprite, spriteCreate, spriteQueueRaw4, Texture } from 'glov/client/sprites';
import { textureBlack } from 'glov/client/textures';
import * as transition from 'glov/client/transition';
import {
  drawBox,
  scaleSizes,
  setFontHeight,
  setPanelPixelScale,
} from 'glov/client/ui';
import { Rec } from 'glov/common/types';
import { easeOut } from 'glov/common/util';
import { vec2, Vec4, vec4 } from 'glov/common/vmath';
import {
  actionCheckBinds,
  actionEdge,
  bindsInit,
} from './binds';
import { blend } from './blend';
import './dialog_data'; // side effects
import { dialogMoveLocked, dialogReset, dialogRun, dialogStartup } from './dialog_system';
import { DIALOG_VIEWPORT, FONT_HEIGHT, game_height, game_width } from './globals';
import {
  curMap,
  doHeistView,
  doTimer,
  doubleLockBonus,
  finishUnlocking,
  heistStarted,
  initTownMap,
  isJailbreak,
  stateHeist,
  stateHeistInit,
} from './heist';
import { optionsMenu } from './options';
import { playSound, SOUND_DATA } from './sound_data';
import { titleInit } from './title';
import { tickMusic } from './music';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { ceil, max, min, floor, PI, pow, random, round, sin } = Math;

window.Z = window.Z || {};
Z.BACKGROUND = 1;
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
function toVec4(c: number): Vec4 {
  return vec4ColorFromIntColor(vec4(), c);
}
const palette = palette_font.map(toVec4);
export function getPalette(): Vec4[] {
  return palette;
}
export function getPaletteFont(): number[] {
  return palette_font;
}

const PALETTE_DARK = palette;
const PALETTE_GB = [
  0x081820ff,
  0x346856ff,
  0x88c070ff,
  0xe0f8d0ff,
].map(toVec4);
let color_pal_idx_override = -1;
const COLOR_PALETTES = [
  PALETTE_DARK,
  [ // other game, blues - use for town - indoors
    0x071821ff,
    0x30455cff,
    0xde9b4fff,
    0xe0f8cfff,
  ].map(toVec4),
  [// moonlight GB - modified - use for town - outdoors
    0x0f052dff,
    0x203671ff,
    0x47758fff, // 0x36868fff,
    0x9ea67eff, // 0x5fc75dff,
  ].map(toVec4),
  [//crimson - use for special levels
    0x1b0326ff,
    0x7a1c4bff,
    0xba5044ff,
    0xeff9d6ff,
  ].map(toVec4),

  [// 2-bit demichrome - use before alert
    0x211e20ff,
    0x555568ff,
    0xa0a08bff,
    0xe9efecff,
  ].map(toVec4),

  // unused palettes

  [ // Memory - other game
    0x381701ff,
    0x936a4eff,
    0xe89f53ff,
    0xefebdfff,
  ].map(toVec4),
  [// hollow - too monochrome
    0x0f0f1bff,
    0x565a75ff,
    0xc6b7beff,
    0xfafbf6ff,
  ].map(toVec4),
  [// bluem0ld
    0x191b1aff,
    0x294257ff,
    0x579c9aff,
    0x99c9b3ff,
  ].map(toVec4),
  [ // other rhythm game - very similar to ours
    0x0c0c0dff,
    0x5e4262ff,
    0xb79578ff,
    0xfbf7f3ff,
  ].map(toVec4),
  [// rustic GB
    0x2c2137ff,
    0x764462ff,
    0xedb4a1ff,
    0xa96868ff,
  ].map(toVec4),
  [// velvet cherry GB
    0x2d162cff,
    0x412752ff,
    0x683a68ff,
    0x9775a6ff,
  ].map(toVec4),
  [// gold gb
    0x210b1bff,
    0x4d222cff,
    0x9d654cff,
    0xcfab51ff,
  ].map(toVec4),
];

const font_style0 = fontStyleColored(null, palette_font[0]);
const font_style1 = fontStyleColored(null, palette_font[1]);
const font_style2 = fontStyleColored(null, palette_font[2]);
const font_style3 = fontStyleColored(null, palette_font[3]);

let shader_dither_transition: Shader;
let sprite_dither: Sprite;
const dither_uvs = vec4(0, 0, game_width / 4, game_height / 4);

function init(): void {
  registerShader('repalette', {
    fp: 'shaders/repalette.fp',
  });

  shader_dither_transition = shaderCreate('shaders/dither_transition.fp');

  sprite_dither = spriteCreate({
    name: 'dither',
    wrap_s: gl.REPEAT,
    wrap_t: gl.REPEAT,
  });

  bindsInit();
}

let palette_lock = false;
function fadeDither(
  fade_time: number,
  updown: boolean,
  z: number,
  initial: Texture,
  ms_since_start: number,
  force_end: boolean
): string {
  let progress = min(ms_since_start / fade_time, 1);
  let color = vec4(1, 1, 1, 1);
  camera2d.setNormalized();

  if (updown) {
    if (progress < 0.5) {
      let alpha = (0.5 - progress) * 2;
      spriteQueueRaw4([textureBlack()],
        0, 0, 0, 1,
        1, 1, 1, 0,
        z,
        0, 1, 1, 0,
        color);
      spriteQueueRaw4([initial, sprite_dither.texs[0]],
        0, 0, 0, 1,
        1, 1, 1, 0,
        z + 0.1,
        0, 1, 1, 0,
        color, shader_dither_transition, {
          uv_scale: dither_uvs,
          dither_param: [alpha],
        });
    } else {
      palette_lock = false;
      let alpha = (1 - progress) * 2;
      spriteQueueRaw4([textureBlack(), sprite_dither.texs[0]],
        0, 0, 0, 1,
        1, 1, 1, 0,
        z + 0.1,
        0, 1, 1, 0,
        color, shader_dither_transition, {
          uv_scale: dither_uvs,
          dither_param: [alpha],
        });
    }
  } else {
    let alpha = 1 - progress;
    spriteQueueRaw4([initial, sprite_dither.texs[0]],
      0, 0, 0, 1,
      1, 1, 1, 0,
      z,
      0, 1, 1, 0,
      color, shader_dither_transition, {
        uv_scale: dither_uvs,
        dither_param: [alpha],
      });
  }

  if (force_end || progress === 1) {
    return transition.REMOVE;
  }
  return transition.CONTINUE;
}

const TRANSITION_TIME = 250;
export function queueTransitionDither(time?: number): void {
  if (engine.getFrameIndex() > 1) {
    transition.queue(Z.TRANSITION_FINAL, fadeDither.bind(null, time || TRANSITION_TIME, false));
  }
}

export function queueTransitionDitherUpDown(time?: number): void {
  if (engine.getFrameIndex() > 1) {
    palette_lock = true;
    transition.queue(Z.TRANSITION_FINAL, fadeDither.bind(null, time || TRANSITION_TIME, true));
  }
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

export function randInt(mx: number): number {
  return floor(random() * mx);
}

class PlayerState {
  money = 0;
  num_picks = 2;
  goal: GoalID = 'intro0';
  mode: 'status' | 'unlock' | 'heist' | 'town' = 'status';
  is_flipped: boolean[] = [];
  picks: number[] = [];
  heists: number[] = [];
}
let player_state = new PlayerState();

export function saveGame(): void {
  localStorageSetJSON<SavedGame>('savegame', {
    money: player_state.money,
    num_picks: player_state.num_picks,
    goal: player_state.goal,
    heists: player_state.heists,
  });
}

type PickAnim = {
  pick: number;
  progress: number;
  failed: boolean;
  bothfit: boolean;
  t: number;
  played_sound: boolean;
};
class PickState {
  selected = 0;
  lock = [1, 2, 3, 4];
  progress = 0;
  bonus = 0;
  last_bonus = 0;
  queued_use = -1;
  queued_exit = false;
  anim: null | PickAnim = null;
}
export type { PickState };
export function createPickState(num_tumblers: number): PickState {
  let pick_state = new PickState();
  pick_state.lock = [];
  for (let ii = 0; ii < num_tumblers; ++ii) {
    pick_state.lock.push(randInt(4) + 1);
  }
  return pick_state;
}
let pick_state: PickState;
function stateLockPickInit(num_tumblers: number, pick_state_in: PickState | null): PickState {
  pick_state = pick_state_in || createPickState(num_tumblers);
  pick_state.anim = null;
  pick_state.selected = 0;
  pick_state.queued_use = -1;
  pick_state.queued_exit = false;
  if (player_state.picks.length !== player_state.num_picks) {
    player_state.picks = [1, 2];
    for (let ii = 2; ii < player_state.num_picks; ++ii) {
      player_state.picks.unshift(COMPOUND_PICKS[ii - 2]);
    }
  }
  return pick_state;
}
function drawLock(dt: number): number {
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
      if (p > 0.75 && !anim.played_sound) {
        anim.played_sound = true;
        playSound(anim.failed ? 'pick_miss' : 'pick_hit');
      }
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

  return x1;
}

function usePick(idx: number): void {
  let { lock, progress } = pick_state;
  let { picks } = player_state;
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
      pick_state.bonus += only_one_target ? 5 : doubleLockBonus();
    }
  }
  pick_state.anim = {
    t: 0,
    pick,
    progress,
    failed,
    bothfit,
    played_sound: false,
  };
  if (failed && !bothfit) {
    // TODO: chance to break
  }
}
function drawPicks(): void {
  let { picks, is_flipped } = player_state;
  if (!dialogMoveLocked() && actionEdge('right')) {
    pick_state.selected = min(pick_state.selected + 1, picks.length - 1);
  }
  if (!dialogMoveLocked() && actionEdge('left')) {
    pick_state.selected = max(pick_state.selected - 1, 0);
  }

  let x = 15;
  let missing_picks = 10 - picks.length;
  let y = 67;
  let z = Z.UI;
  let w = PICK_W;
  let h = PICK_H;
  x += floor(missing_picks * (w + 4) / 2);

  let disabled = pick_state.progress === pick_state.lock.length || dialogMoveLocked();
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
      if (!pick_state.anim && pick_state.queued_use !== -1 && !pick_state.queued_exit) {
        usePick(pick_state.queued_use);
        pick_state.queued_use = -1;
      }
      if (spot_ret.long_press || spot_ret.ret && spot_ret.button === 2 || selected && (
        actionEdge('up') || actionEdge('down')
      )) {
        picks[ii] = PICK_PAIRS[pick];
        is_flipped[ii] = !is_flipped[ii];
      } else if (spot_ret.ret || selected && actionEdge('accept')) {
        if (pick_state.anim) {
          pick_state.queued_use = ii;
        } else {
          usePick(ii);
        }
      }
    }

    x += w + 4;
  }
}

function drawPickingHUD(dt: number): void {
  if (isJailbreak()) {
    return;
  }
  let x = 0;
  let y = 0;
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
    let selected = player_state.picks[pick_state.selected];
    if (selected > 4 && pick_state.progress < pick_state.lock.length - 1) {
      extra = `+${doubleLockBonus()}`;
    } else {
      extra = '+5';
    }
  } else {
    // done, show bonus even during animation
    bonus = pick_state.bonus;
  }
  let eff_bonus = blend('bonus', bonus);
  let max_bonus = floor(pick_state.lock.length / 2) * doubleLockBonus();
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

  dialogRun(
    dt,
    { ...DIALOG_VIEWPORT },
    false,
  );
}

function leavePicking(): void {
  if (pick_state.progress === pick_state.lock.length) {
    playSound('pickup');
  } else {
    playSound('fail');
  }
  finishUnlocking(pick_state.progress === pick_state.lock.length, pick_state.bonus, pick_state.progress);
  if (isJailbreak()) {
    player_state.mode = 'town';
  } else {
    player_state.mode = 'heist';
  }
}

function startTown(initial: boolean, jailbreak: boolean): void {
  initTownMap(initial, jailbreak);
  player_state.mode = 'town';
  dialogReset();
  // dialog('startheist');
}

let last_heist_index = 0;
export function leaveHeist(success: boolean, loot: number, new_goal: GoalID | null, jailbreak: boolean): void {
  if (success && !loot) {
    // no sound, had a UI action leading up to this
  } else if (success) {
    player_state.heists[last_heist_index] = (player_state.heists[last_heist_index] || 0) + 1;
    if (new_goal) {
      player_state.goal = new_goal;
    }
    playSound('pickup');
  } else {
    playSound('fail');
  }
  player_state.money += loot;
  startTown(false, jailbreak);
  saveGame();
}

function stateLockPick(dt: number): void {
  autoAtlas('gfx', inputPadMode() ? 'lockpick-bg' : 'lockpick-bg-kb').draw({
    x: 0, y: 0, w: game_width, h: game_height,
    z: Z.BACKGROUND,
  });
  drawPickingHUD(dt);
  let world_dt = dt * 0.5;
  if (player_state.mode === 'unlock') { // else, dialog caused us to exit
    doTimer(world_dt);
  }
  let lock_x1 = drawLock(dt);
  drawPicks();
  let heist_view = {
    x: lock_x1 + 2,
    y: 13,
    w: game_width - lock_x1 - 2,
    h: 36,
  };
  drawBox({
    ...heist_view,
    z: Z.BACKGROUND + 0.1,
  }, autoAtlas('gfx', 'box'));
  doHeistView(world_dt, heist_view);
  if (!dialogMoveLocked() && (
    !pick_state.anim && (pick_state.progress === pick_state.lock.length || pick_state.queued_exit) ||
    actionEdge('cancel')
  )) {
    if (pick_state.anim) {
      pick_state.queued_exit = true;
    } else {
      leavePicking();
    }
  }
}

let last_pal: Vec4[];
export function topOfFrame(is_title: boolean): void {
  if (engine.DEBUG) {
    if (keyDownEdge(KEYS.MINUS)) {
      color_pal_idx_override = ((color_pal_idx_override - 1) + COLOR_PALETTES.length) % COLOR_PALETTES.length;
    }
    if (keyDownEdge(KEYS.EQUALS)) {
      color_pal_idx_override = (color_pal_idx_override + 1) % COLOR_PALETTES.length;
    }
  }

  tickMusic('music');

  camera2d.setAspectFixed(game_width, game_height);
  let pal = last_pal && palette_lock ? last_pal :
    color_pal_idx_override !== -1 ? COLOR_PALETTES[color_pal_idx_override] :
    settingsGet('palette') ? PALETTE_GB :
    is_title ? PALETTE_DARK :
    player_state.mode === 'town' ? curMap() === 'town' ? COLOR_PALETTES[2] : COLOR_PALETTES[1] :
    last_heist_index >= 3 ? COLOR_PALETTES[3] :
    PALETTE_DARK;
    // heistStarted() || player_state.mode === 'unlock' ? PALETTE_DARK : COLOR_PALETTES[4];
  last_pal = pal;
  effectsQueue(Z.REPALETTE, function () {
    applyCopy({
      shader: 'repalette',
      params: {
        param: [1, 1],
        pal0: pal[0],
        pal1: pal[1],
        pal2: pal[2],
        pal3: pal[3],
      },
    });
  });
  actionCheckBinds();
}

export function startUnlocking(num_tumblers: number, pick_state_in: PickState | null): PickState {
  player_state.mode = 'unlock';
  return stateLockPickInit(num_tumblers, pick_state_in);
}

export function startHeist(index: number): void {
  queueTransitionDitherUpDown();
  dialogReset();
  player_state.mode = 'heist';
  last_heist_index = index;
  stateHeistInit(index);
}

export function stateStatus(dt: number): void {
  let x = 2;
  let y = 2;
  let w = game_width - x * 2;
  let text_height = FONT_HEIGHT;
  font.draw({
    style: font_style2,
    x, y, w,
    text: 'STATUS',
  });
  markdownAuto({
    font_style: font_style2,
    x, y, w,
    align: ALIGN.HRIGHT,
    text: `GOLD: [c=3]${player_state.money > 900000 ? 'ONE MILLION' : player_state.money}[/c]`,
  });
  y += text_height + 2;
  markdownAuto({
    font_style: font_style2,
    x, y, w,
    align: ALIGN.HRIGHT,
    text: `LOCKPICKS: [c=3]${player_state.num_picks}[/c]`,
  });
  y += text_height + 2;
  markdownAuto({
    font_style: font_style2,
    x, y, w,
    align: ALIGN.HWRAP | ALIGN.HRIGHT,
    text: `GOAL: [c=3]${GOALS[player_state.goal].toUpperCase()}[/c]`,
  });
  dialogRun(
    dt,
    {
      ...DIALOG_VIEWPORT,
    },
    false,
  );
}

function statePlay(dt: number): void {
  topOfFrame(false);
  if (player_state.mode === 'unlock') {
    return stateLockPick(dt);
  } else if (player_state.mode === 'heist') {
    return stateHeist(dt, false);
  } else if (player_state.mode === 'town') {
    return stateHeist(dt, true);
  } else if (player_state.mode === 'status') {
    return stateStatus(dt);
  }
}

type SavedGame = {
  money: number;
  num_picks: number;
  goal: GoalID;
  heists: number[];
  // mode: PlayerState['mode'];
};

export function backToGame(): void {
  engine.setState(statePlay);
}

export function newGameInit(): void {
  player_state = new PlayerState();
  dialogReset();
  engine.setState(statePlay);
  startTown(true, false);
}

export function playerState(): PlayerState {
  return player_state;
}

export function loadGame(): void {
  let data = localStorageGetJSON<SavedGame>('savegame');
  assert(data);
  player_state = new PlayerState();
  player_state.money = data.money;
  player_state.num_picks = data.num_picks;
  player_state.goal = data.goal;
  player_state.heists = data.heists || [];
  player_state.mode = 'town';
  dialogReset();
  engine.setState(statePlay);
  startTown(player_state.goal === 'intro0', false);
}

export function canLoad(): boolean {
  return Boolean(localStorageGet('savegame'));
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
    ui_sounds: SOUND_DATA,
  })) {
    return;
  }
  font = engine.font;
  font_tiny = fontCreate(font_info_04b03x1, 'font/04b03_8x1');

  // Perfect sizes for pixely modes
  scaleSizes(13 / 32);
  setFontHeight(9);
  setPanelPixelScale(1);

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

  // newGameInit();
  titleInit();
  if (engine.DEBUG) {
    if (0) {
      optionsMenu('title');
    }
    loadGame();

    engine.setState(statePlay);
    startHeist(6);
    // startTown(false, false);
    // startUnlocking(12, null);
    // dialog('informant');
  }
}
