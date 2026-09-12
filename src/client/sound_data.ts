import { playUISound, UISoundID } from 'glov/client/ui';

export const SOUND_DATA = {
  // online multiplayer sounds, ignore these
  user_join: 'user_join',
  user_leave: 'user_leave',
  msg_in: 'msg_in',
  msg_err: 'msg_err',
  msg_out_err: 'msg_out_err',
  msg_out: 'msg_out',

  // UI sounds
  button_click: 'button_click',
  button_click2: { file: 'button_click', volume: 0.125 }, // touch movement controls - just hear footsteps
  // menus/general/etc
  rollover: { file: 'rollover', volume: 0.25 },

  pickup: 'pickup',
  fail: 'fail',
  locked: 'locked',

  pick_miss: 'pick_miss',
  pick_hit: 'pick_hit',

} satisfies Partial<Record<string, UISoundID | string | string[] | UISoundID[]>>;

export type GameSoundID = keyof typeof SOUND_DATA;

export function validSoundID(test: string): test is GameSoundID {
  return Boolean((SOUND_DATA as Partial<Record<string, unknown>>)[test]);
}

export function playSound(sound_id: GameSoundID): void {
  playUISound(sound_id);
}
