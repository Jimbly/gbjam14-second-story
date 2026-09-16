import { cmd_parse } from 'glov/client/cmds';
import { setState } from 'glov/client/engine';
import { ALIGN } from 'glov/client/font';
import { settingsGet, settingsRegister, settingsSet } from 'glov/client/settings';
import { uiGetFont } from 'glov/client/ui';
import { actionEdge } from './binds';
import { game_height, game_width } from './globals';
import { backToGame, getPaletteFont, saveGame, topOfFrame } from './main';
import { playSound } from './sound_data';
import { titleInit } from './title';

const { floor, min, round } = Math;

declare module 'glov/client/settings' {
  let palette: number;
}

settingsRegister({
  palette: {
    default_value: 0,
    type: cmd_parse.TYPE_INT,
    range: [0,1],
  },
});

let options_from: 'title' | 'game';
let selection = 0;

function stateOptionsMenu(dt: number): void {
  topOfFrame();
  let palette_font = getPaletteFont();

  let W = game_width;

  let num_buttons = options_from === 'title' ? 4 : 5;
  if (actionEdge('up')) {
    selection = (selection - 1 + num_buttons) % num_buttons;
    playSound('rollover');
  }
  if (actionEdge('down')) {
    selection = (selection + 1) % num_buttons;
    playSound('rollover');
  }

  let y = floor(game_height / 4);
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

  font.draw({
    ...button_param,
    y,
    color: palette_font[selection === selidx ? 3 : 2],
    text: `SOUND: ${(settingsGet('volume_sound') * 10).toFixed(0)}`,
  });
  indicator();
  if (selection === selidx) {
    if (actionEdge('accept')) {
      settingsSet('volume_sound', (round(settingsGet('volume_sound') * 10) % 10) / 10);
    }
    if (actionEdge('right')) {
      settingsSet('volume_sound', min(1, settingsGet('volume_sound') + 0.1));
    }
    if (actionEdge('left')) {
      settingsSet('volume_sound', min(1, settingsGet('volume_sound') - 0.1));
    }
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
    if (actionEdge('accept')) {
      settingsSet('volume_music', (round(settingsGet('volume_music') * 10) % 10) / 10);
    }
    if (actionEdge('right')) {
      settingsSet('volume_music', min(1, settingsGet('volume_music') + 0.1));
    }
    if (actionEdge('left')) {
      settingsSet('volume_music', min(1, settingsGet('volume_music') - 0.1));
    }
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
  if (selection === selidx) {
    if (actionEdge('accept')) {
      settingsSet('palette', 1 - settingsGet('palette'));
    }
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
    if (selection === selidx && actionEdge('accept') || actionEdge('cancel')) {
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
    if (selection === selidx) {
      if (actionEdge('accept')) {
        saveGame();
        titleInit();
      }
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
    if (selection === selidx && actionEdge('accept') || actionEdge('cancel')) {
      backToGame();
    }
    ++selidx;
    y += button_h + 2;
  }
}

export function optionsMenu(from: 'title' | 'game'): void {
  options_from = from;
  selection = 0;
  setState(stateOptionsMenu);
}
