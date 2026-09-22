import assert from 'assert';
import { cmd_parse } from 'glov/client/cmds';
import { KEYS, PAD } from 'glov/client/input';
import { CmdRespFunc } from 'glov/common/cmd_parse';
import { bindKB, bindPad } from './binds';

const { max } = Math;

export type ActionKey = 'up' | 'left' | 'down' | 'right' |
  /*'select' | 'start' |*/ 'accept' | 'cancel';

type ActionState = {
  down: number;
  down_edge: number;
};
let action_state = {} as Record<ActionKey, ActionState>;

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

function actionCmd(action_key: ActionKey, value: string, resp_func: CmdRespFunc): void {
  if (!value) {
    actionTriggerEdge(action_key, true);
    actionTriggerEdge(action_key, false);
  } else {
    if (Number(value)) {
      actionTriggerEdge(action_key, true);
    } else {
      actionTriggerEdge(action_key, false);
    }
  }
  resp_func();
}

export function actionRegister(action_key: ActionKey): void {
  assert(!action_state[action_key]);
  action_state[action_key] = {
    down: 0,
    down_edge: 0,
  };
  cmd_parse.register({
    cmd: action_key,
    help: `Bindable Action: ${action_key}`,
    func: actionCmd.bind(null, action_key),
  });
}

export function actionBindKB(key: keyof typeof KEYS, action_key: ActionKey): void {
  bindKB(key, action_key, 'hold');
}
export function actionBindPad(pad: keyof typeof PAD, action_key: ActionKey): void {
  bindPad(pad, action_key, 'hold');
}

export function actionTopOfFrame(): void {
  for (let key in action_state) {
    let action = action_state[key as ActionKey];
    action.down_edge = 0;
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
