import assert from 'assert';
import { keyDownEdge, KEYS, keyUpEdge, PAD, padButtonDownEdge, padButtonUpEdge } from 'glov/client/input';

const { max } = Math;

export type ActionKey = 'up' | 'left' | 'down' | 'right' |
  /*'select' | 'start' |*/ 'accept' | 'cancel';

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

export function actionTriggerEdge(action_key: ActionKey, is_down: boolean): void {
  let action = action_state[action_key];
  assert(action);
  if (is_down) {
    action.down_edge++;
    action.down++;
  } else {
    action.down = max(0, action.down - 1);
  }
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


export function bindsInit(): void {
  actionRegister('up', ACTION_STATE);
  actionRegister('left', ACTION_STATE);
  actionRegister('down', ACTION_STATE);
  actionRegister('right', ACTION_STATE);
  // actionRegister('select', ACTION_EVENT);
  // actionRegister('start', ACTION_EVENT);
  actionRegister('accept', ACTION_EVENT);
  actionRegister('cancel', ACTION_EVENT);
  actionBindKB('UP', 'up');
  actionBindKB('W', 'up');
  actionBindKB('LEFT', 'left');
  actionBindKB('A', 'left');
  actionBindKB('DOWN', 'down');
  actionBindKB('S', 'down');
  actionBindKB('RIGHT', 'right');
  actionBindKB('D', 'right');
  actionBindKB('Z', 'accept');
  actionBindKB('X', 'cancel');
  actionBindKB('C', 'accept');
  actionBindKB('J', 'accept');
  actionBindKB('K', 'cancel');
  actionBindKB('L', 'accept');
  actionBindKB('Q', 'cancel');
  actionBindKB('E', 'accept');
  actionBindKB('SPACE', 'accept');
  actionBindKB('ESC', 'cancel');
  actionBindKB('BACKSPACE', 'cancel');
  // actionBindKB('BRACKET_LEFT', 'select');
  // actionBindKB('BRACKET_RIGHT', 'start');
  // actionBindKB('SHIFT', 'select');
  // actionBindKB('BACKSLASH', 'cancel');
  actionBindKB('ENTER', 'accept');

  actionBindPad('SELECT', 'accept');
  actionBindPad('CANCEL', 'cancel');
  actionBindPad('X', 'accept');
  actionBindPad('Y', 'cancel');
  actionBindPad('LEFT_BUMPER', 'accept');
  actionBindPad('RIGHT_BUMPER', 'accept');
  actionBindPad('LEFT_TRIGGER', 'cancel');
  actionBindPad('RIGHT_TRIGGER', 'cancel');
  // actionBindPad('BACK', 'select');
  // actionBindPad('START', 'start');
  actionBindPad('BACK', 'cancel');
  actionBindPad('START', 'accept');
  actionBindPad('LEFT_STICK', 'accept');
  actionBindPad('RIGHT_STICK', 'accept');
  actionBindPad('UP', 'up');
  actionBindPad('DOWN', 'down');
  actionBindPad('LEFT', 'left');
  actionBindPad('RIGHT', 'right');
  actionBindPad('ANALOG_UP', 'up');
  actionBindPad('ANALOG_LEFT', 'left');
  actionBindPad('ANALOG_DOWN', 'down');
  actionBindPad('ANALOG_RIGHT', 'right');
  actionBindPad('LSTICK_UP', 'up');
  actionBindPad('LSTICK_LEFT', 'left');
  actionBindPad('LSTICK_DOWN', 'down');
  actionBindPad('LSTICK_RIGHT', 'right');
  actionBindPad('RSTICK_UP', 'up');
  actionBindPad('RSTICK_LEFT', 'left');
  actionBindPad('RSTICK_DOWN', 'down');
  actionBindPad('RSTICK_RIGHT', 'right');
}
