export const HERO = 'JARRETT';

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
import { plural } from 'glov/common/util';
import {
  dialog,
  DialogButton,
  DialogParam,
  dialogPush,
  dialogRegister,
} from './dialog_system';
import { playerFloater } from './heist';
import { GOAL_LIST, playerState, saveGame, startHeist } from './main';
import { titleInit } from './title';

const INFORMANT = 'ALLEY DWELLER';

export function signWithName(name: string, message: string, transient_long?: boolean): void {
  dialogPush({
    name,
    text: message,
    transient: true,
    transient_long,
  });
}

export function dialogLine(name: string, message: string, next?: VoidFunc): void {
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
  startheist: function (param: string) {
    let { goal, heists } = playerState();
    let h0 = heists[0] || 0;
    let h1 = heists[1] || 0;
    dialogPush({
      text: 'Where should I do some "second story work"?',
      buttons: [{
        label: 'SLUMS *',
        cb: function () {
          if (goal === 'search1') {
            dialogPush({
              text: 'Am I ready to start my revenge?',
              buttons: [{
                label: 'Search the Foulmouth resdience',
                cb: function () {
                  startHeist(3);
                },
              }, {
                label: 'Any place will do...',
                cb: function () {
                  startHeist(0);
                },
              }],
            });
          } else {
            startHeist(0);
          }
        }
      }, {
        label: 'MERCHANT QUARTER **',
        cb: function () {
          if (goal === 'find2b' || goal === 'buytreat' || goal === 'search2') {
            dialogPush({
              text: 'Am I ready to continue my revenge?',
              buttons: [{
                label: 'Search Strongfist Manor',
                cb: function () {
                  if (goal === 'search2') {
                    startHeist(4);
                  } else {
                    if (goal === 'find2b') {
                      playerState().goal = 'buytreat';
                    }
                    dialogPush({
                      name: HERO,
                      text: 'Hmm, the yard is positively crawling with guard cats. I don\'t think I can bring myself to walk past them without bringing them a treat.',
                      buttons: [{
                        label: 'MEOW.',
                        cb: function () {
                          // returns to town
                        }
                      }],
                    });
                  }
                },
              }, {
                label: 'Any place will do...',
                cb: function () {
                  startHeist(1);
                },
              }],
            });
          } else if (h0 < 2) {
            dialogLine(HERO, 'Hmm, I don\'t think I\'m quite ready for that yet, ' +
              `Maybe I should do ${2 - h0} more easier ${plural(2 - h0, 'heist')} and buy some more lockpicks before exploring here.`,
            function () {
              dialog('startheist');
            });
          } else {
            startHeist(1);
          }
        }
      }, {
        label: 'OLD MONEY ROW ***',
        cb: function () {
          if (goal === 'find3b' || goal === 'find3c' || goal === 'buygift' || goal === 'search3') {
            dialogPush({
              text: 'Am I ready to finish my revenge?',
              buttons: [{
                label: 'Rob Goldenhare Palace',
                cb: function () {
                  if (goal === 'search3') {
                    startHeist(5);
                  } else {
                    if (goal === 'find3b') {
                      playerState().goal = 'find3c';
                    }
                    dialogPush({
                      name: HERO,
                      text: 'Oh boy, that\'s too many guards, even for me. I\'ll have to find a safe way past them.',
                      buttons: [{
                        label: '',
                        cb: function () {
                          // returns to town
                        }
                      }],
                    });
                  }
                },
              }, {
                label: 'Any place will do...',
                cb: function () {
                  startHeist(2);
                },
              }],
            });
          } else if (h1 < 2) {
            dialogLine(HERO, 'Hmm, I don\'t think I\'m quite ready for that yet, ' +
              `Maybe I should do ${2 - h1} more easier ${plural(2 - h1, 'heist')} and buy some more lockpicks before exploring here.`,
            function () {
              dialog('startheist');
            });
          } else {
            startHeist(2);
          }
        }
      }, {
        label: 'Not yet...',
        cb: function () {
          // nothing
        }
      }],
    });
  },
  cannotafford: function () {
    dialogPush({
      text: 'Sorry, you cannot afford that.',
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
      text: 'You already have all the picks I make, sorry.',
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
          dialog('shop');
        }
      }
    }];
    let extra_label: string | null = null;
    let extra_cost = 0;
    if (player_state.goal === 'buytreat') {
      extra_label = 'CAVIAR';
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
            playerFloater('PURCHASED!');
          }
        }
      });
    }
    buttons.push({
      label: 'NOTHING RIGHT NOW',
    });
    dialogPush({
      text: `GOLD: [c=0]${player_state.money}[/c]\nLOCKPICKS: [c=0]${player_state.num_picks}[/c]/10\n\nWhat would you like to buy?`,
      buttons,
    });
  },
  mugged: function () {
    dialogLine(HERO,
      'What just happened? Someone robbed [c=0]me[/c], of all people?! I swear they will regret that.',
      dialogLine.bind(null, HERO,
        'Ah, I guess I\'m getting rusty in my old age. Well, at least I\'ve still got a couple [c=0]basic lockpicks[/c] in my boots.  I may be old, but I\'ll get some gold...',
      )
    );
  },
  informant: function () {
    let player_state = playerState();
    if (player_state.goal === 'mugged') {
      player_state.goal = 'informant1';
      dialogLine(HERO,
        'Hey, you see the mugging that happened here the other night?',
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
      signWithName(INFORMANT, 'Foulmouth lives in the Slums.');
    } else if (player_state.goal === 'find2a') {
      player_state.goal = 'find2b';
      dialogLine(INFORMANT, 'Strongfist? He lives in the merchant quarter.',
        dialogLine.bind(null, HERO, 'Thanks, here\'s 400G',
          dialogLine.bind(null, INFORMANT, 'Ah, no worries, my wallet\'s still full, this one\'s on the house!'
          )
        )
      );
    } else if (player_state.goal === 'find2b' || player_state.goal === 'search2') {
      signWithName(INFORMANT, 'Strongfist? He lives in the merchant quarter.');
    } else if (player_state.goal === 'buytreat') {
      signWithName(INFORMANT, 'Vicious guard animals? Check the shop, they might have something to help.');
    } else if (player_state.goal === 'find3a') {
      player_state.goal = 'find3b';
      dialogLine(INFORMANT, 'Ramirrors Goldenhare? He has a summer palace on the Old Money row.',
        dialogLine.bind(null, HERO, 'Thanks, here\'s 400G',
          dialogLine.bind(null, INFORMANT, 'Ah, no worries, I\'ve still got your last gift here.')
        )
      );
    } else if (player_state.goal === 'find3b') {
      signWithName(INFORMANT, 'Ramirrors Goldenhare? He has a summer palace on the Old Money row.');
    } else if (player_state.goal === 'find3c') {
      player_state.goal = 'buygift';
      dialogLine(INFORMANT, 'Ramirrors Palace private security? They\'re a tough bunch, but I hear one of them lost a month\'s wages and is in desperate need of a gift to sooth his wife...',
        dialogLine.bind(null, HERO, 'I bet I can find him the perftect gift! Thanks, here\'s 400G.',
          dialogLine.bind(null, INFORMANT, 'Ah, no worries, wallet\'s still full! I haven\'t left this spot to go spend anything in days.')
        )
      );
    } else if (player_state.goal === 'buygift') {
      signWithName(INFORMANT, 'I thought I was pretty clear: go check the SHOP for a gift for the guard\'s wife.');
    } else if (player_state.goal === 'search3') {
      signWithName(INFORMANT, 'Have fun storming the castle!');
    } else if (player_state.goal === 'outtahere') {
      signWithName(INFORMANT, 'Nice working with you, best of luck on your future endeavors!');
    }
  },
  special1: function () {
    dialogLine(HERO, 'A receipt for payment to deliver an order to [c=0]Bignoes Strongfist[/c] on the night of my mugging, this must be it!');
  },
  special2: function () {
    dialogLine(HERO, 'An order from his boss asking him to set up the hit!',
      dialogLine.bind(null, HERO, 'Hmm, Strongfist did the deed, but it appears he was paid by my old friend Ramirrors...\n\n' +
        'Now that I know who\'s behind this, I\'ll make sure to leave him penniless.')
    );
  },
  special3: function () {
    dialogLine(HERO, 'ONE MIIIIIIILION DOLLARS!',
      dialogLine.bind(null, HERO, 'That joke never gets old.')
    );
  },
  townexit: function () {
    let { goal } = playerState();
    if (goal === 'intro0' || goal === 'intro1') {
      dialogLine(HERO, 'What a peaceful looking town, this will be great for my retirement.  I should take a look around.');
    } else if (goal === 'outtahere') {
      saveGame();
      dialogLine(HERO, 'Okay, enough of this town, I guess to really retire I\'m going to have to start a goat farm in the country...',
        function () {
          dialogPush({
            text: 'CONGRATULATIONS! YOU WIN!\n\n' +
              'Thanks for playing!',
            buttons: [{
              label: 'EXIT TO MAIN MENU',
              cb: function () {
                titleInit();
              }
            }],
          });
        });
    } else {
      dialogLine(HERO, 'I can\'t leave now, I\'ve got unfinished business.');
    }
  },
  intro: function () {
    dialogLine(HERO, 'Ah, finally here. I\'ve had enough of The City, lucrative though it was. This looks like a nice little town to retire in.');
  },
});
