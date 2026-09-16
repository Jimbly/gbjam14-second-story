/* eslint prefer-template:off, @stylistic/max-len:off, @typescript-eslint/no-unused-vars:off */
import assert from 'assert';
import { cmd_parse } from 'glov/client/cmds';
import { ALIGN } from 'glov/client/font';
import { inputTouchMode } from 'glov/client/input';
import {
  panel,
  PanelParam,
  uiGetFont,
  uiTextHeight,
} from 'glov/client/ui';
import { WithRequired } from 'glov/common/types';
import {
  dialog,
  DialogButton,
  DialogParam,
  dialogPush,
  dialogRegister,
} from './dialog_system';
import { playerState, startHeist } from './main';

export function signWithName(name: string, message: string, transient_long?: boolean): void {
  dialogPush({
    name,
    text: message,
    transient: true,
    transient_long,
  });
}

dialogRegister({
  nametest: function () {
    signWithName('Mr. Someone', 'Test of a sign with a name.', true);
  },
});

dialogRegister({
  choose: function (param: string) {
    dialogPush({
      text: 'WHERE SHOULD I DO SOME "SECOND STORY WORK"?',
      buttons: [{
        label: 'SLUMS',
        cb: function () {
          startHeist(0);
        }
      }, {
        label: 'MERCHANT QUARTER',
        cb: function () {
          startHeist(1);
        }
      }, {
        label: 'OLD MONEY',
        cb: function () {
          startHeist(2);
        }
      }, {
        label: 'NOT YET...',
        cb: function () {
          // nothing
        }
      }],
    });
  },
  cannotafford: function () {
    dialogPush({
      text: 'SORRY, YOU CANNOT AFFORD THAT.',
      buttons: [{
        label: 'OK',
        cb: function () {
          dialog('shop');
        }
      }],
    });
  },
  maxpicks: function () {
    dialogPush({
      text: 'YOU ALREADY HAVE ALL THE PICKS I MAKE, SORRY.',
      buttons: [{
        label: 'OK',
        cb: function () {
          dialog('shop');
        }
      }],
    });
  },
  shop: function (param: string) {
    let player_state = playerState();
    let buttons: DialogButton[] = [{
      label: 'ANOTHER LOCKPICK - [c=1]500[/c]G',
      cb: function () {
        if (player_state.money < 500) {
          dialog('cannotafford');
        } else if (player_state.num_picks === 10) {
          dialog('maxpicks');
        } else {
          player_state.money -= 500;
          player_state.num_picks++;
        }
      }
    }];
    let extra_label: string | null = null;
    let extra_cost = 0;
    if (player_state.goal === 2) {
      extra_label = 'DOG TREAT';
      extra_cost = 2000;
    }
    if (player_state.goal === 3) {
      extra_label = 'EXPENSIVE GIFT';
      extra_cost = 5000;
    }
    if (extra_label) {
      buttons.push({
        label: `${extra_label} - [c=1]${extra_cost}[/c]G`,
        cb: function () {
          if (player_state.money < extra_cost) {
            dialog('cannotafford');
          } else {
            player_state.money -= extra_cost;
            player_state.goal++;
          }
        }
      });
    }
    buttons.push({
      label: 'NOTHING RIGHT NOW',
    });
    dialogPush({
      text: `GOLD: ${player_state.money}\nLOCKPICKS: ${player_state.num_picks}/10\n\nWHAT WOULD YOU LIKE TO BUY?`,
      buttons,
    });
  },
});
