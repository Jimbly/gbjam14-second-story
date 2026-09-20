export const HERO = 'JARRETT';

/* eslint prefer-template:off, @stylistic/max-len:off, @typescript-eslint/no-unused-vars:off */
import assert from 'assert';
import { cmd_parse } from 'glov/client/cmds';
import { postRender } from 'glov/client/engine';
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
import { initCutsceneMap, playerFloater } from './heist';
import { GOAL_LIST, GoalID, playerState, saveGame, setScore, startHeist } from './main';
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

function dialogChain(speaker: string, lines: string[], next?: VoidFunc): void {
  let idx = 0;
  function nextLine(): void {
    if (idx === lines.length) {
      return next?.();
    }
    dialogLine(speaker, lines[idx++], nextLine);
    if (speaker === HERO) {
      speaker = INFORMANT;
    } else {
      speaker = HERO;
    }
  }
  nextLine();
}


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
                    dialogPush({
                      name: HERO,
                      text: 'Here kitties, I brought you some caviar! Who\'s a good kitty? You are, yes you are...',
                      buttons: [{
                        label: '',
                        cb: function () {
                          dialogLine(HERO, 'Okay, I can\'t be caught petting these adorable fuzzballs, on to the heist...', function () {
                            startHeist(4);
                          });
                        },
                      }],
                    });
                  } else {
                    if (goal === 'find2b') {
                      playerState().goal = 'buytreat';
                      setScore();
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
          if (goal === 'find3b' || goal === 'find3c' || goal === 'buygift' || goal === 'search3' || goal === 'search3b') {
            dialogPush({
              text: 'Am I ready to finish my revenge?',
              buttons: [{
                label: 'Rob Goldenhare Palace',
                cb: function () {
                  if (goal === 'search3') {
                    initCutsceneMap('ramirrors');
                  } else if (goal === 'search3b') {
                    startHeist(5);
                  } else {
                    if (goal === 'find3b') {
                      initCutsceneMap('ramirrors');
                    } else {
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
        hotactions: ['cancel'],
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
      label: 'ADVANCED LOCKPICK - [c=1]200[/c]G',
      cb: function () {
        if (player_state.money < 200) {
          dialog('cannotafford');
        } else if (player_state.num_picks === 10) {
          dialog('maxpicks');
        } else {
          player_state.money -= 200;
          player_state.num_picks++;
          dialog('shop');
        }
      }
    }];
    function pushExtra(thing: string, cost: number, pre_goal: GoalID): void {
      buttons.push({
        label: `${thing} - [c=1]${cost}[/c]G`,
        sound: player_state.money >= cost && player_state.goal === pre_goal ? 'victory' : undefined,
        cb: function () {
          if (player_state.money < cost) {
            dialog('cannotafford');
          } else if (player_state.goal !== pre_goal) {
            dialogPush({
              name: HERO,
              text: 'What would I need this for?' + (player_state.goal === 'outtahere' ? ' One for the road?' : ''),
              buttons: [{
                label: '',
                cb: 'shop',
              }],
            });
          } else {
            player_state.money -= cost;
            player_state.goal = GOAL_LIST[GOAL_LIST.indexOf(player_state.goal) + 1];
            setScore();
            playerFloater('[c=3]PURCHASED![/c]');
          }
        }
      });
    }
    pushExtra('CAVIAR', 2000, 'buytreat');
    pushExtra('DIAMOND TIARA', 5000, 'buygift');
    buttons.push({
      hotactions: ['cancel'],
      label: 'NOTHING RIGHT NOW',
    });
    dialogPush({
      text: `GOLD: [c=0]${player_state.money}[/c]\nLOCKPICKS: [c=0]${player_state.num_picks}[/c]/10\n\nWhat would you like to buy?`,
      buttons,
      instant: true,
    });
  },
  intro: function () {
    dialogLine(HERO, 'Ah, finally here. I\'ve had enough of The City, and the way of the Thief. This looks like a nice little town to retire in.');
  },
  mugged: function () {
    dialogLine(HERO,
      'What just happened? Someone robbed [c=0]me,[/c] of all people?! I swear they will regret that.',
      dialogLine.bind(null, HERO,
        'So much for honor among thieves. Well, at least I\'ve still got a couple [c=0]basic lockpicks[/c] in my boot.  I may be old, but I\'ll get some gold...',
      )
    );
  },
  informant: function () {
    let player_state = playerState();
    if (player_state.goal === 'mugged') {
      player_state.goal = 'informant1';
      setScore();
      dialogLine(HERO,
        'Hey, you see the mugging that happened here the other night?',
        dialogLine.bind(null, INFORMANT,
          'I might have, but I see better with a full coin purse...',
          dialogLine.bind(null, HERO,
            'How does the weight of your belt affect your eyesight?',
          )
        )
      );
    } else if (player_state.goal === 'informant1') {
      dialogLine(HERO,
        '400G ought to weigh down your belt just fine...',
        player_state.money < 400 ? dialogLine.bind(null, INFORMANT, 'It would... if you had that much.') :
        dialogChain.bind(null, INFORMANT, [
          'Thanks. That feels much better.',
          'So, did you see the mugging that happened here the other night?',
          'Yes, I did! That looked like it hurt.',
          'Certainly. Did you see who did it?',
          'Why yes, my eyesight has much improved recently.',
          'And what is the name of this foul perpetrator?',
          'Oh, that I could not tell you.',
          '...because your voice works better with a full coin purse?',
          'No, no, no. As you can see, my purse is presently tolerably full.',
          'Well, then, why can you not tell me?',
          'Ah, for the simplest of reasons: I do not know.',
          'But you said...',
          'Your confusion is made clear to me now. I saw who did it, but do not know his name.',
          'What do you know?',
          'That would take a long time to expound upon...',
          'What do you know ABOUT THE MUGGER?',
          'I\'ve seen a courier named Rodger Foulmouth delivering instructions to him in the past.',
          'Then perhaps I should pay this Foulmouth a visit, except...',
          'Except what?',
          'Except I do not know where he lives.',
          'Oh, but that is easy.',
          'I suspected as much, for one such as you.',
          'Foulmouth lives in the Slums.',
          'I\'ll pay him a visit. Thanks, you\'ve been very helpful.',
          'A full purse, as well as improving my eyesight, does seem to improve my disposition.',
          '...if a bit verbose.',
        ], function () {
          player_state.money -= 400;
          player_state.goal = 'search1';
          setScore();
        })
      );
    } else if (player_state.goal === 'search1') {
      signWithName(INFORMANT, 'Foulmouth lives in the Slums.');
    } else if (player_state.goal === 'find2a') {
      player_state.goal = 'find2b';
      setScore();
      dialogChain(HERO, [
        'I have learned the name of our elusive mugger!',
        'I confess I have been curious about that for some time. Though, not curious enough to leave my favorite spot right here and ask about it.',
        'His name is [c=0]Bignoes Strongfist[/c].',
        'Do you think his mother gave him that name?',
        'It seems unlikely.',
        'Well, thank you for enlightening me.',
        'You are most welcome, however, I was actually hoping you could enlighten me.',
        'I will endeavor to do so, but, I would need to know the subject first.',
        'Certainly! It is, of course, the esteemed Mr Strongfist, and, more specifically, where he might reside.',
        'Oh, I can help you there!',
        'And, will you?',
        'Certainly.',
        'When?',
        'Presently.',
        'By the Builder, I have been asking for nothing else for an hour!',
        'There\'s a [c=0]Strongfist Manor[/c] in the [c=0]Merchant Quarter[/c].',
        'That does seem a likely abode.',
        'Glad I could help!',
        'Thanks, here\'s 600G.',
        'Ah, no worries, my wallet\'s still tolerably full, any more would just weigh me down!',
        '...I\'m glad this guy does not charge by the word...',
      ]);
    } else if (player_state.goal === 'find2b') {
      signWithName(INFORMANT, 'Strongfist? He lives in the merchant quarter.');
    } else if (player_state.goal === 'buytreat') {
      signWithName(INFORMANT, 'Vicious guard animals? Check the shop, they might have something to help.');
    } else if (player_state.goal === 'search2') {
      signWithName(INFORMANT, 'Strongfist\'s guard cats will absolutely LOVE that.');
    } else if (player_state.goal === 'find3a') {
      player_state.goal = 'find3b';
      setScore();
      dialogChain(HERO, [
        'Greetings, my knowledgeable friend!',
        'I happy to be called at least one of those things.',
        'Do you know the name [c=0]Ramirrors Goldenhare[/c]?',
        'Well, I certainly do now!',
        'Only just now?',
        'In fact, I was aware of it even before it graced your lips. I just wanted you to feel the joy of telling me something new.',
        'Ah, rest assured, just telling you a name is not why I came here.',
        'Truly? I would not have guessed.',
        'Then perhaps guessing is not your strong suit.',
        'That is EXACTLY what the dealer, and my wife, have told me many times.',
        'You lost a lot at cards?',
        'A whole month\'s wages, which may have been the cause for the wife to become the ex-wife...',
        'I\'m sorry to hear that...',
        'Enough about me, you had another reason for dialoguing?',
        'Yes! I\'d nearly forgotten.',
        'Will you tell me the reason?',
        'Most certainly, why else would I be here?',
        '...and what is that reason?',
        'I\'m sorry, you must be rubbing off on me. I wish to know where Ramirrors Goldenhare lives.',
        'And I wish I had a pony.',
        '...I don\'t think I can get you a pony.',
        'That does seem unlikely. Well, if it\'s only information you seek, that I can give freely.',
        'Freely?',
        'Yes, as you can see, my pouch is still nearly bursting, as I have few demands upon my finances while I sit in this alley.',
        'So, will you give it to me?',
        'The alley?',
        'No, the information we were discussing an hour ago.',
        'Ah, Ramirrors Goldenhare\'s domicile? He has a summer palace on [c=0]Old Money Row[/c].',
        'Thanks, you have been most helpful.',
        'See you soon!',
        '...that does seem likely.',
      ]);
    } else if (player_state.goal === 'find3b') {
      signWithName(INFORMANT, 'Ramirrors Goldenhare? He has a summer palace on Old Money Row.');
    } else if (player_state.goal === 'find3c') {
      player_state.goal = 'buygift';
      setScore();
      dialogChain(HERO, [
        'What do you know of Ramirrors Palace private security?',
        'No friendly banter, but right into the questions?',
        'I\'m sorry, that was rude of me. I should have mentioned I got you a pony.',
        'That IS something you should have mentioned!',
        'Well, I should have mentioned it, if I had done so.',
        'So, you are saying you did NOT get me a pony?',
        'That is correct.',
        'Oh, phew! I was actually worried, because I do not have the means to support a lifestyle which includes ponies.',
        'You seem to still have a full purse?',
        'That\'s true, but I like that money where it is, if I were to spend it, my belt would feel too light.',
        'I see.',
        'Ponyless, but not penniless, that\'s what I always say!',
        'Always? Uh, so, about Ramirrors Palace\'s security?',
        'Oh, they\'re a tough bunch.',
        'And plentiful, it would seem. Do you think one might turn a blind eye if, say, someone wanted to tour the palace?',
        'Oh, a tour sounds delightful, I\'m sure there might be one that could be made sympathetic to that.',
        'Perhaps one that would appreciate a gift?',
        'Like a pony?',
        'No, I was thinking good old gold coins.',
        'Ah, I know just the one, Humphrey, we play cards all the time!',
        'A friend of yours? I warn you he may get in trouble.',
        'Most certainly not a friend, he\'s married to my ex-wife.',
        'And you play cards with him?',
        'Yes, because I know how much his losing money at cards upsets her!',
        'I see, and does he lose at cards?',
        'Yes, in fact, I hear he lost a whole month\'s wages to some low-life alley-dweller just the other night.',
        'That sounds like a problem for his marriage.',
        'Yes, but, an opportunity for you!',
        'I\'m not looking for a wife...',
        'That is good, as the guard most certainly is not looking to lose one.',
        'Ah, perhaps if Humphrey had the perfect gift to soothe his wife, we could all be happy.',
        'Well, not ALL of us.',
        'Yes, not Ramirrors, I would not want him to be happy.',
        'That\'s not who I meant... but, anyway, as luck would have it, I know just the perfect gift for the guard\'s wife.',
        'You do?',
        'Yes, for, you see, I am tolerably acquainted with her tastes.',
        'Excellent, and what would she appreciate?',
        'She has a... small horse, named Al Capony, which she adores more than life itself, and she desires a diamond-studded tiara for him.',
        'That sounds expensive.',
        'Not as expensive as you might think, and the shop over there carries just the thing!',
        'Well, isn\'t that fortuitous!',
        'It\'s almost like some all-knowing being put the gift in the shop for this very purpose...',
        'Well, thank you, you have been most helpful! Here\'s 1000G.',
        'Ah, no worries, wallet\'s still full! I really haven\'t left this spot to go spend anything in days.',
        '...except the card game, unless that was held right here...',
      ]);
    } else if (player_state.goal === 'buygift') {
      signWithName(INFORMANT, 'I was clear and tolerably concise: go check the SHOP for a gift for the guard\'s wife.');
    } else if (player_state.goal === 'search3') {
      signWithName(INFORMANT, 'Have fun storming the castle!');
    } else if (player_state.goal === 'outtahere') {
      signWithName(INFORMANT, 'Nice working with you, best of luck on your future endeavors!');
    }
  },
  special1: function () {
    dialogLine(HERO, 'A receipt for payment to deliver instructions to one [c=0]Bignoes Strongfist[/c] on the night of my mugging, he must be the mugger-for-hire!');
  },
  special2: function () {
    dialogLine(HERO, 'An order from his boss asking him to set up the hit!',
      dialogLine.bind(null, HERO, 'Hmm, Strongfist did the deed, but it appears he was paid by my old friend [c=0]Ramirrors[/c]...\n\n' +
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
      dialogPush({
        name: HERO,
        text: 'Okay, enough of this town, I guess to really retire I\'m going to have to start a goat farm in the country...',
        buttons: [{
          label: '',
          sound: 'bigvictory',
          cb: function () {
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
          },
        }],
      });
    } else {
      dialogLine(HERO, 'I can\'t leave now, I\'ve got unfinished business.');
    }
  },
  advancedpicks: function () {
    postRender(function () {
      dialogPush({
        name: 'HINT: ADVANCED LOCKPICKS',
        text: 'Advanced Lockpicks match 2 tumblers at a time.\n\nYou will get SIGNIFICANTLY larger bonuses for each advanced lockpick you successfully use.' +
          ' Try to use the ones you have when you can.',
        buttons: [{
          label: '',
          cb: function () {
            dialogPush({
              name: 'HINT: ADVANCED LOCKPICKS',
              text: 'This lock can be unlocked with ONLY your new advanced pick, but other chests will require a whole set to get the greatest rewards.',
              buttons: [{
                label: '',
              }],
            });
          }
        }],
      });
    });
  },
});
