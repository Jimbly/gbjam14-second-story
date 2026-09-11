import assert from 'assert';
import { keyDownEdge, KEYS, keyUpEdge, PAD, padButtonDownEdge, padButtonUpEdge } from 'glov/client/input';

const { max } = Math;

export type ActionKey = 'up' | 'left' | 'down' | 'right' |
  'select' | 'start' | 'accept' | 'cancel';

export const ACTION_STATE = 1;
export const ACTION_EVENT = 2;
export type ActionType = typeof ACTION_STATE | typeof ACTION_EVENT;

type ActionState = {
  down: number;
  down_edge: number;
  action_type: ActionType; // TODO: not used
};
let action_state = {} as Record<ActionKey, ActionState>;

export function actionRegister(action_key: ActionKey, action_type: ActionType): void {
  assert(!action_state[action_key]);
  action_state[action_key] = {
    down: 0,
    down_edge: 0,
    action_type,
  };
}

type KBBind = {
  key: number;
  action_key: ActionKey;
};
let kb_binds: KBBind[] = [];
export function actionBindKB(key: keyof typeof KEYS, action_key: ActionKey): void {
  kb_binds.push({
    key: KEYS[key],
    action_key,
  });
}

type PadBind = {
  pad: number;
  action_key: ActionKey;
};
let pad_binds: PadBind[] = [];
export function actionBindPad(pad: keyof typeof PAD, action_key: ActionKey): void {
  pad_binds.push({
    pad: PAD[pad],
    action_key,
  });
}

export function actionCheckBinds(): void {
  for (let key in action_state) {
    let action = action_state[key as ActionKey];
    action.down_edge = 0;
  }

  // TODO: deal with same key bound to multiple things?
  for (let ii = 0; ii < kb_binds.length; ++ii) {
    let bind = kb_binds[ii];
    let action = action_state[bind.action_key];
    if (keyDownEdge(bind.key)) {
      action.down_edge++;
      action.down++;
    }
    if (keyUpEdge(bind.key)) {
      action.down = max(0, action.down - 1);
    }
  }

  for (let ii = 0; ii < pad_binds.length; ++ii) {
    let bind = pad_binds[ii];
    let action = action_state[bind.action_key];
    if (padButtonDownEdge(bind.pad)) {
      action.down_edge++;
      action.down++;
    }
    if (padButtonUpEdge(bind.pad)) {
      action.down = max(0, action.down - 1);
    }
  }
}

export function actionEdge(action_key: ActionKey): number {
  let state = action_state[action_key];
  assert(state);
  let ret = state.down_edge;
  state.down_edge = 0;
  return ret;
}

export function actionDown(action_key: ActionKey): number {
  let state = action_state[action_key];
  assert(state);
  return state.down;
}
