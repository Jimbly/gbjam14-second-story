GBJam14 - "Old Gold"
============================

Town flow
* into dialog and goal advancement
* Heist
  * 3 default locations
  * special location if known (or, * on a default if quest objective) - no loot chests, just 1 info chest; fixed seed
  * do not allow doing medium tier until you've done a 2 of the previous tier "Maybe I should do 2 easy jobs first"
  * guards spend too much time in main hallway on hard difficulty - bias away from that?
  * add 1/2/3 stars next to heist locations, and ! for quest
* New game
* Prison flow and escape?

Lockpicking
* Start with just 2 picks
* probably no breaking of picks, it just punishes people who are learning? maybe only in hard zone?


TODO
* exclamation stays above guards' heads; changes to ? and then fades
* new dialog borders
* intro: https://discord.com/channels/476958898004164610/1547927465555398749/1548011201156485231
  * and similar framing? scaled up res w/ different palette?
* disable mouse for jam submission - touch only
* if special loot - display "!" or chest icon next to loot bar once found
* menu selection should be plain text with icon to left instead of button-styled look
* different palette in town
* maybe footsteps should not use spatial, just hack volume to be useful? (vis radius + 3?)
* game logo on title

Stretch
* change most informant dialogs to signWithName (add position check logic)
* add custom namer renderer
* breaking and repairing lockpicks
* additional time upgrade?
* floors are actually black when neither you nor guard is nearby?
* pulsate guard's light (inner radius, especially)
* add pulsating lights


Remaining Story flow
GOAL: search1
  Trigger: unlock chest
    Jarrett: A receipt for payment to deliver an order to Bignoes Strongfist on the night of my mugging, this must be it!
  Lots of guards upon opening chest
GOAL: find2b
  Trigger: Attempt to visit, get turned away by dogs
GOAL: search2
  find note with name of boss, your old "friend" Ramirrors
  Trigger: unlock chest
    Jarrett: Hmm, Strongfist did the deed, but it appears he was paid by my old friend Ramirrors..
    Now that I know who's behind this, I'll make sure to leave him penniless.
GOAL: find3b
  turned away by too many guards
GOAL: search3
  get 1 million gold
GOAL: outtahere
  Trigger: leave through south gate
  Jarrett: Okay, enough of this town, I guess to really retire I'm going to have to start a goat farm in the country...
