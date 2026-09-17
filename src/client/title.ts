import { AnimationSequencer, animationSequencerCreate } from 'glov/client/animation';
import { DEBUG, setState } from 'glov/client/engine';
import { ALIGN, fontStyle } from 'glov/client/font';
import { eatAllInput, mouseDownAnywhere } from 'glov/client/input';
import { active as transitionActive } from 'glov/client/transition';
import { drawRect, uiGetFont, uiTextHeight } from 'glov/client/ui';
import { actionEdge } from './binds';
import { game_height, game_width } from './globals';
import {
  canLoad,
  getPalette,
  getPaletteFont,
  loadGame,
  newGameInit,
  queueTransitionDither,
  queueTransitionDitherUpDown,
  topOfFrame,
} from './main';
import { optionsMenu } from './options';
import { playSound } from './sound_data';

const { floor } = Math;

let title_anim: AnimationSequencer | null = null;
let title_alpha = {
  title: 0,
  sub: 0,
  button: 0,
};
let selection = 0;
let inited_once = false;
let title_frame = 0;
function stateTitleInit(): void {
  if (inited_once) {
    return;
  }
  inited_once = true;
  title_anim = animationSequencerCreate();
  let t = 0;

  t = title_anim.add(0, 300, (progress) => {
    title_alpha.title = progress;
  });
  t = title_anim.add(t + 300, 300, (progress) => {
    title_alpha.sub = progress;
  });
  title_anim.add(t + 500, 300, (progress) => {
    title_alpha.button = progress;
  });

  selection = canLoad() ? 2 : 0;
}

function stateTitle(dt: number): void {
  topOfFrame(true);
  let palette_font = getPaletteFont();
  let palette = getPalette();

  if (title_frame === 0) {
    drawRect(0, 0, game_width, game_height, 1, palette[1]);
    queueTransitionDither(350);
    ++title_frame;
    return;
  }
  if (title_frame === 1) {
    if (transitionActive()) {
      return;
    }
    title_frame = 2;
  }

  let font = uiGetFont();
  let text_height = uiTextHeight();

  let W = game_width;
  let H = game_height;

  if (title_anim && (mouseDownAnywhere() || actionEdge('accept'))) {
    title_anim.update(Infinity);
    title_anim = null;
  }
  if (title_anim) {
    if (!title_anim.update(dt)) {
      title_anim = null;
    } else {
      eatAllInput();
    }
  }

  let y = 30;

  const style_title = fontStyle(null, {
    color: palette_font[3],
    outline_color: palette_font[1],
    outline_width: 2.5,
  });

  font.draw({
    style: style_title,
    alpha: title_alpha.title,
    x: 0, y, w: W, align: ALIGN.HCENTER | ALIGN.HWRAP,
    size: text_height * 2,
    text: 'SECOND\n  STORY',
  });

  font.draw({
    color: palette_font[3],
    alpha: title_alpha.sub,
    x: 0,
    y: H - text_height * 2 - 3,
    w: W, align: ALIGN.HCENTER | ALIGN.HWRAP,
    text: 'By Jimb Esser\nfor Gameboy Jam 14',
  });

  const BUTTON_H = 8;
  if (title_alpha.button) {
    let button_w = BUTTON_H * 8 - 6;
    let button_x = floor((W - button_w) / 2);
    let button_h = BUTTON_H;
    let button_param = {
      x: button_x,
      w: button_w,
      h: button_h,
      align: ALIGN.HCENTER,
      alpha: title_alpha.button,
    };

    let num_buttons = canLoad() ? 3 : 2;
    if (actionEdge('up')) {
      selection = (selection - 1 + num_buttons) % num_buttons;
      playSound('rollover');
    }
    if (actionEdge('down')) {
      selection = (selection + 1) % num_buttons;
      playSound('rollover');
    }

    y = game_height / 2;

    font.draw({
      ...button_param,
      y,
      color: palette_font[canLoad() ? selection === 2 ? 3 : 2 : 1],
      text: 'CONTINUE',
    });
    if (selection === 2) {
      font.draw({
        ...button_param,
        align: ALIGN.HLEFT,
        y,
        color: palette_font[3],
        text: '▶',
      });
      if (actionEdge('accept')) {
        playSound('button_click');
        queueTransitionDitherUpDown(500);
        loadGame();
      }
    }
    y += button_h + 2;

    font.draw({
      ...button_param,
      color: palette_font[selection === 0 ? 3 : 2],
      y,
      text: 'NEW GAME',
    });
    if (selection === 0) {
      font.draw({
        ...button_param,
        align: ALIGN.HLEFT,
        y,
        color: palette_font[3],
        text: '▶',
      });
      if (actionEdge('accept')) {
        playSound('button_click');
        queueTransitionDitherUpDown(500);
        newGameInit();
      }
    }
    y += button_h + 2;

    font.draw({
      ...button_param,
      color: palette_font[selection === 1 ? 3 : 2],
      y,
      text: 'OPTIONS',
    });
    if (selection === 1) {
      font.draw({
        ...button_param,
        align: ALIGN.HLEFT,
        y,
        color: palette_font[3],
        text: '▶',
      });
      if (actionEdge('accept')) {
        playSound('button_click');
        queueTransitionDitherUpDown();
        optionsMenu('title');
      }
    }
    y += button_h + 2;
  }
}

export function titleInit(): void {
  stateTitleInit();
  setState(stateTitle);
}
