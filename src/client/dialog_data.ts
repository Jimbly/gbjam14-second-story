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
import { VoidFunc, WithRequired } from 'glov/common/types';
import {
  dialog,
  DialogButton,
  DialogParam,
  dialogPush,
  dialogRegister,
} from './dialog_system';
import { GOAL_LIST, playerState, startHeist } from './main';

const HERO = 'JARRETT';
const INFORMANT = 'ALLEY DWELLER';

export function signWithName(name: string, message: string, transient_long?: boolean): void {
  dialogPush({
    name,
    text: message,
    transient: true,
    transient_long,
  });
}

function dialogLine(name: string, message: string, next?: VoidFunc): void {
  dialogPush({
    name,
    text: message,
    buttons: [{
      label: '',
      cb: next,
    }],
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
    if (player_state.goal === 'buytreat') {
      extra_label = 'DOG TREAT';
      extra_cost = 2000;
    }
    if (player_state.goal === 'buygift') {
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
            player_state.goal = GOAL_LIST[GOAL_LIST.indexOf(player_state.goal) + 1];
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
  mugged: function () {
    dialogLine(HERO,
      'What just happened? Someone robbed [c=0]me[/c], of all people?! I swear they will regret that.',
      dialogLine.bind(null, HERO,
        'Ah, I guess I\'m getting rusty in my old age. Well, at least I\'ve still got a couple basic lockpicks in my boots.  I may be old, but I\'ll get some gold...',
      )
    );
  },
  informant: function () {
    let player_state = playerState();
    if (player_state.goal === 'mugged') {
      player_state.goal = 'informant1';
      dialogLine(HERO,
        'Hey, you see the mugging that happened hear the other night?',
        dialogLine.bind(null, INFORMANT,
          'I might have, but I see better with a full wallet...',
          dialogLine.bind(null, HERO,
            'I\'m sure we can come to an understanding...',
          )
        )
      );
    } else if (player_state.goal === 'informant1') {
      dialogLine(HERO,
        '400G ought to fill your wallet fine...',
        player_state.money < 400 ? dialogLine.bind(null, INFORMANT, 'It would... if you had that much.') :
        dialogLine.bind(null, INFORMANT,
          'Thanks. I don\'t know the name of the mugger, but I\'ve seen a courier named Rodger Foulmouth delivering instructions to him in the past. Foulmouth lives in the Slums.',
          dialogLine.bind(null, HERO,
            'Thanks, I\'ll pay him a visit.',
            function () {
              player_state.money -= 400;
              player_state.goal = 'search1';
            }
          )
        )
      );
    } else if (player_state.goal === 'search1') {
      dialogLine(INFORMANT, 'Foulmouth lives in the Slums.');
    } else if (player_state.goal === 'find2a') {
      player_state.goal = 'find2b';
      dialogLine(INFORMANT, 'Informant: Strongfist? He lives in the merchant quarter.',
        dialogLine.bind(null, HERO, 'Thanks, here\'s 400G',
          dialogLine.bind(null, INFORMANT, 'Ah, no worries, my wallet\'s still full, this one\'s on the house!'
          )
        )
      );
    } else if (player_state.goal === 'find2b' || player_state.goal === 'search2') {
      dialogLine(INFORMANT, 'Informant: Strongfist? He lives in the merchant quarter.');
    } else if (player_state.goal === 'buytreat') {
      dialogLine(INFORMANT, 'Dogs? Check the shop, they might have something to help.');
    } else if (player_state.goal === 'find3a') {
      player_state.goal = 'find3b';
      dialogLine(INFORMANT, 'Ramirrors Goldenhare? He has a summer palace in the Old Money neighborhood.',
        dialogLine.bind(null, HERO, 'Thanks, here\'s 400G',
          dialogLine.bind(null, INFORMANT, 'Ah, no worries, I\'ve still got your last gift here.')
        )
      );
    } else if (player_state.goal === 'find3b') {
      dialogLine(INFORMANT, 'Ramirrors Goldenhare? He has a summer palace in the Old Money neighborhood.');
    } else if (player_state.goal === 'find3c') {
      player_state.goal = 'buygift';
      dialogLine(INFORMANT, 'Ramirrors Palace private security? They\'re a tough bunch, but I hear one of them lost his month\'s wages and is in desperate need of a gift to sooth his wife...',
        dialogLine.bind(null, HERO, 'I bet I can find him the perftect gift! Thanks, here\'s 400G.',
          dialogLine.bind(null, INFORMANT, 'Ah, no worries, wallet\'s still full! I haven\'t left this spot to go spend anything in days.')
        )
      );
    } else if (player_state.goal === 'buygift') {
      dialogLine(INFORMANT, 'I thought I was pretty clear: go check the SHOP for a gift for the guard\'s wife.');
    } else if (player_state.goal === 'search3') {
      dialogLine(INFORMANT, 'Have fun storming the castle!');
    } else if (player_state.goal === 'outtahere') {
      dialogLine(INFORMANT, 'Nice working with you, best of luck on your future endeavors!');
    }
  },
});
