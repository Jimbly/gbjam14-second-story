import { actionEdge } from 'glov/client/actions';
import { cmd_parse } from 'glov/client/cmds';
import { setState } from 'glov/client/engine';
import { ALIGN } from 'glov/client/font';
import { settingsGet, settingsRegister, settingsSet } from 'glov/client/settings';
import { spot, SPOT_DEFAULT_BUTTON, SPOT_NAV_DOWN, SPOT_NAV_UP, SpotCustomNav } from 'glov/client/spot';
import { uiGetFont } from 'glov/client/ui';
import { game_height, game_width } from './globals';
import {
  backToGame,
  getPaletteFont,
  queueTransitionPaletteCrunchUpDown,
  saveGame,
  stateStatus,
  topOfFrame
} from './main';
import { playSound } from './sound_data';
import { titleInit } from './title';

const { floor, min, round } = Math;

declare module 'glov/client/settings' {
  let palette: number;
  let touch_controls: number;
}

settingsRegister({
  palette: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0,1],
  },
  touch_controls: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0,1],
  },
});

let options_from: 'title' | 'game';
let selection = 0;

function stateOptionsMenu(dt: number): void {
  topOfFrame(false);
  let palette_font = getPaletteFont();

  let W = game_width;

  let num_buttons = options_from === 'title' ? 5 : 6;
  // if (actionEdge('up')) {
  //   selection = (selection - 1 + num_buttons) % num_buttons;
  //   playSound('rollover');
  // }
  // if (actionEdge('down')) {
  //   selection = (selection + 1) % num_buttons;
  //   playSound('rollover');
  // }

  let y = options_from === 'title' ? floor(game_height / 4) :
    game_height / 2;
  let font = uiGetFont();

  const BUTTON_H = 8;
  let button_w = BUTTON_H * 10 + 10;
  let button_x = floor((W - button_w) / 2);
  let button_h = BUTTON_H;
  let button_param = {
    x: button_x,
    w: button_w,
    h: button_h,
    align: ALIGN.HCENTER,
  };

  font.draw({
    ...button_param,
    y: y - 14,
    color: palette_font[1],
    text: '- OPTIONS -',
  });

  let selidx = 0;
  function indicator(): void {
    if (selection !== selidx) {
      return;
    }
    font.draw({
      ...button_param,
      align: ALIGN.HLEFT,
      y,
      color: palette_font[3],
      text: '▶',
    });
  }
  function click(): boolean {
    let rect = {
      x: 20, w: game_width - 40,
      y,
      h: button_h,
    };
    let custom_nav: SpotCustomNav | null = null;
    if (selidx === 0) {
      custom_nav = {
        [SPOT_NAV_UP]: `button${num_buttons - 1}`
      };
    } else if (selidx === num_buttons - 1) {
      custom_nav = {
        [SPOT_NAV_DOWN]: 'button0'
      };
    }
    let spot_ret = spot({
      ...rect,
      key: `button${selidx}`,
      auto_focus: selidx === 0,
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
    color: palette_font[selection === selidx ? 3 : 2],
    text: `SOUND: ${(settingsGet('volume_sound') * 10).toFixed(0)}`,
  });
  indicator();
  if (selection === selidx) {
    if (actionEdge('right')) {
      settingsSet('volume_sound', min(1, settingsGet('volume_sound') + 0.1));
      playSound('button_click');
    }
    if (actionEdge('left')) {
      settingsSet('volume_sound', min(1, settingsGet('volume_sound') - 0.1));
      playSound('button_click');
    }
  }
  if (click()) {
    settingsSet('volume_sound', (round(settingsGet('volume_sound') * 10 + 1) % 11) / 10);
    playSound('button_click');
  }
  ++selidx;
  y += button_h + 2;

  font.draw({
    ...button_param,
    y,
    color: palette_font[selection === selidx ? 3 : 2],
    text: `MUSIC: ${(settingsGet('volume_music') * 10).toFixed(0)}`,
  });
  indicator();
  if (selection === selidx) {
    if (actionEdge('right')) {
      settingsSet('volume_music', min(1, settingsGet('volume_music') + 0.1));
      playSound('button_click');
    }
    if (actionEdge('left')) {
      settingsSet('volume_music', min(1, settingsGet('volume_music') - 0.1));
      playSound('button_click');
    }
  }
  if (click()) {
    settingsSet('volume_music', (round(settingsGet('volume_music') * 10 + 1) % 11) / 10);
    playSound('button_click');
  }
  ++selidx;
  y += button_h + 2;

  font.draw({
    ...button_param,
    y,
    color: palette_font[selection === selidx ? 3 : 2],
    text: `PALETTE: ${settingsGet('palette') ? 'CLASSIC' : 'COLOR'}`,
  });
  indicator();
  if (selection === selidx && (actionEdge('accept') || actionEdge('left') || actionEdge('right')) || click()) {
    settingsSet('palette', 1 - settingsGet('palette'));
    playSound('button_click');
  }
  ++selidx;
  y += button_h + 2;

  font.draw({
    ...button_param,
    y,
    color: palette_font[selection === selidx ? 3 : 2],
    text: `TOUCH: ${settingsGet('touch_controls') ? 'ON' : 'AUTO'}`,
  });
  indicator();
  if (selection === selidx && (actionEdge('accept') || actionEdge('left') || actionEdge('right')) || click()) {
    settingsSet('touch_controls', 1 - settingsGet('touch_controls'));
    playSound('button_click');
  }
  ++selidx;
  y += button_h + 2;

  if (options_from === 'title') {
    font.draw({
      ...button_param,
      y,
      color: palette_font[selection === selidx ? 3 : 2],
      text: 'BACK',
    });
    indicator();
    if (actionEdge('cancel') || click()) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown();
      titleInit();
    }
    ++selidx;
    y += button_h + 2;
  } else {
    font.draw({
      ...button_param,
      y,
      color: palette_font[selection === selidx ? 3 : 2],
      text: 'SAVE AND EXIT',
    });
    indicator();
    if (click()) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown(500);
      saveGame();
      titleInit();
    }
    ++selidx;
    y += button_h + 2;

    font.draw({
      ...button_param,
      y,
      color: palette_font[selection === selidx ? 3 : 2],
      text: 'BACK TO GAME',
    });
    indicator();
    if (actionEdge('cancel') || click()) {
      playSound('button_click');
      queueTransitionPaletteCrunchUpDown();
      backToGame();
    }
    ++selidx;
    y += button_h + 2;
  }

  if (options_from === 'game') {
    stateStatus(dt);
  }
}

export function optionsMenu(from: 'title' | 'game'): void {
  options_from = from;
  selection = 0;
  setState(stateOptionsMenu);
}
