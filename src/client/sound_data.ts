import { GlovSoundPlayOpts } from 'glov/client/sound';
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
  button_click: { file: 'button_click', volume: 0.5 },
  button_click2: { file: 'button_click', volume: 0.125 }, // touch movement controls - just hear footsteps
  // menus/general/etc
  rollover: { file: 'rollover', volume: 0.25 },

  pickup: 'pickup',
  thatsall: 'new/victory',
  fail: 'fail',
  failheist: 'new/failure',
  locked: 'locked',
  victory: 'new/victory', // quest complete
  bigvictory: 'new/amazing-success',
  mugged: 'new/doot',

  pick_miss: 'new/doot',
  pick_hit: 'new/2up',
  pick_hit_good: ['new/4up', 'new/3up'],
  unlock_success: 'new/great-success',

  footstep: { file: 'new/footstep', volume: 0.3 },
  alert: 'new/time-running-out',
  guard_arrived: 'guard_alert',
  guard_chase: 'guard_alert',
  guard_forget: 'guard_forget',
  guard_caught: 'new/doot',

} satisfies Partial<Record<string, UISoundID | string | string[] | UISoundID[]>>;

export type GameSoundID = keyof typeof SOUND_DATA;

export function validSoundID(test: string): test is GameSoundID {
  return Boolean((SOUND_DATA as Partial<Record<string, unknown>>)[test]);
}

export function playSound(sound_id: GameSoundID, volume_or_opts?: number | GlovSoundPlayOpts): void {
  playUISound(sound_id, volume_or_opts);
}
