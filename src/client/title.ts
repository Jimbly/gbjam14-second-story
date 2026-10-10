import { actionEdge } from 'glov/client/actions';
import { AnimationSequencer, animationSequencerCreate } from 'glov/client/animation';
import { autoAtlas } from 'glov/client/autoatlas';
import { DEBUG, setState } from 'glov/client/engine';
import { ALIGN, fontStyle, fontStyleColored } from 'glov/client/font';
import { eatAllInput, mouseDownAnywhere } from 'glov/client/input';
import { scoresDraw } from 'glov/client/score_ui';
import { spot, SPOT_DEFAULT_BUTTON, SPOT_NAV_DOWN, SPOT_NAV_UP, SpotCustomNav } from 'glov/client/spot';
import { active as transitionActive } from 'glov/client/transition';
import { buttonText, drawRect, uiGetFont, uiTextHeight } from 'glov/client/ui';
import { game_height, game_width } from './globals';
import {
  canLoad,
  getPalette,
  getPaletteFont,
  loadGame,
  newGameInit,
  queueTransitionDither,
  queueTransitionPaletteCrunchUpDown,
  Score,
  scoreSystem,
  topOfFrame,
} from './main';
import { optionsMenu } from './options';
import { playSound } from './sound_data';

const { floor } = Math;

const SCORE_COLUMNS = [
  // widths are just proportional, scaled relative to `width` passed in
  { name: '', width: 4, align: ALIGN.HFIT | ALIGN.HRIGHT | ALIGN.VCENTER },
  { name: 'Name', width: 16, align: ALIGN.HFIT | ALIGN.VCENTER },
  { name: 'Win', width: 5 },
  { name: 'Gold', width: 8 },
];

function myScoreToRow(row: unknown[], score: Score): void {
  row.push(score.goal === 15 ? '*' : `${(score.goal/15 * 100).toFixed(0)}%`,
    score.money > 9999 ? `${(score.money/1000).toFixed(0)}K` :
    `${score.money}`);
}

function stateScores(dt: number): void {
  topOfFrame(true);
  // let black = palette[PAL_BLACK];
  // gl.clearColor(black[0], black[1], black[2], 1);
  let palette_font = getPaletteFont();
  let palette = getPalette();
  const style_score = fontStyleColored(null, palette_font[2]);
  const style_me = fontStyleColored(null, palette_font[1]);
  const style_header = fontStyleColored(null, palette_font[2]);
  const style_title = fontStyle(null, {
    color: palette_font[0],
    outline_color: palette_font[3],
    outline_width: 2.5,
  });

  drawRect(0, 0, game_width, game_height, 1, palette[1]);

  let x = 0;
  let y = 2;
  const CHW = 8;
  const CHH = 9;
  let font = uiGetFont();

  font.draw({
    style: style_title,
    x: 0,
    y,
    w: game_width,
    text: 'HIGH SCORES',
    size: CHH,
    align: ALIGN.HCENTER,
  });
  y += CHH + 2;

  let w = game_width;
  let text_height = uiTextHeight();
  scoresDraw<Score>({
    score_system: scoreSystem(),
    allow_rename: true,
    x,
    width: w,
    y,
    height: game_height - y + 8,
    z: Z.UI,
    size: text_height,
    line_height: text_height + 1,
    level_index: 0,
    columns: SCORE_COLUMNS,
    scoreToRow: myScoreToRow,
    style_score,
    style_me,
    style_header,
    color_line: palette[3],
    color_me_background: palette[0],
    rename_button_size: 6,
    rename_button_offset: -2/text_height,
  });

  if (buttonText({
    x: 1,
    y: 1,
    w: CHW * 4,
    text: 'Back',
    hotaction: 'cancel',
  })) {
    queueTransitionPaletteCrunchUpDown();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    setState(stateTitle);
  }
}

let title_anim: AnimationSequencer | null = null;
let title_alpha = {
  jam: 0,
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

  title_anim.add(0, 400, (progress) => {
    title_alpha.jam = progress;
  });
  title_anim.add(200, 400, (progress) => {
    title_alpha.title = progress;
  });
  t = title_anim.add(400, 300, (progress) => {
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
    drawRect(0, 0, game_width, game_height, 1, palette[0]);
    queueTransitionDither(350);
    ++title_frame;
    return;
  }
  drawRect(0, 0, game_width, game_height, 1, palette[1]);
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

  if (title_anim && (mouseDownAnywhere() || actionEdge('accept') || DEBUG && false)) {
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

  autoAtlas('gfx', 'title').draw({
    x: (game_width - 128) / 2,
    y: -8,
    w: 128,
    h: 80,
    color: [1, 1, 1, title_alpha.title],
  });

  autoAtlas('gfx', 'gbjam').draw({
    x: game_width - 68 + 1,
    y: game_height - 54 + 1,
    w: 68,
    h: 54,
    color: [1, 1, 1, title_alpha.jam],
  });

  font.draw({
    color: palette_font[0],
    alpha: title_alpha.sub,
    x: 0,
    y: H - text_height * 3 - 3,
    w: W - 64,
    align: ALIGN.HCENTER | ALIGN.HWRAP,
    text: 'By Jimb Esser\nand Tetsuo\nfor Gameboy Jam 14',
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

    let num_buttons = canLoad() ? 4 : 3;

    y = game_height / 2 - 4;

    function click(selidx: number): boolean {
      let rect = {
        x: 20, w: game_width - 40,
        y,
        h: button_h,
      };
      let custom_nav: SpotCustomNav | null = null;
      if (selidx === 3 || selidx === 0 && num_buttons === 3) {
        custom_nav = {
          [SPOT_NAV_UP]: 'button2'
        };
      } else if (selidx === 2) {
        custom_nav = {
          [SPOT_NAV_DOWN]: num_buttons === 4 ? 'button3' : 'button0'
        };
      }

      let spot_ret = spot({
        ...rect,
        key: `button${selidx}`,
        auto_focus: num_buttons === 4 ? selidx === 3 : selidx === 0,
        def: SPOT_DEFAULT_BUTTON,
        custom_nav,
      });
      if (spot_ret.focused) {
        selection = selidx;
      } else if (selection === selidx) {
        selection = -1;
      }
      return Boolean(spot_ret.ret);
    }

    font.draw({
      ...button_param,
      y,
      color: palette_font[canLoad() ? selection === 3 ? 3 : 2 : 0],
      text: 'CONTINUE',
    });
    if (selection === 3) {
      font.draw({
        ...button_param,
        align: ALIGN.HLEFT,
        y,
        color: palette_font[3],
        text: '▶',
      });
    }
    if (click(3)) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown(500);
      loadGame();
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
    }
    if (click(0)) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown(500);
      newGameInit();
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
    }
    if (click(1)) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown(500);
      optionsMenu('title');
    }
    y += button_h + 2;

    font.draw({
      ...button_param,
      color: palette_font[selection === 2 ? 3 : 2],
      y,
      text: 'HI SCORES',
    });
    if (selection === 2) {
      font.draw({
        ...button_param,
        align: ALIGN.HLEFT,
        y,
        color: palette_font[3],
        text: '▶',
      });
    }
    if (click(2)) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown(500);
      setState(stateScores);
    }
    y += button_h + 2;
  }
}

export function titleInit(): void {
  stateTitleInit();
  setState(stateTitle);
}

export function hiScoresInit(): void {
  setState(stateScores);
}
