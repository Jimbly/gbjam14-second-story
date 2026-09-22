import { cmd_parse } from 'glov/client/cmds';
import { keyDownEdge, KEYS, keyUpEdge, PAD, padButtonDownEdge, padButtonUpEdge } from 'glov/client/input';

type BindMode = 'hold' | 'fire';
type KBBind = {
  key: number;
  cmd: string;
  mode: BindMode;
};
let kb_binds: KBBind[] = [];
type PadBind = {
  pad: number;
  cmd: string;
  mode: BindMode;
};
let pad_binds: PadBind[] = [];

export function bindKB(key: keyof typeof KEYS, cmd: string, mode: BindMode): void {
  kb_binds.push({
    key: KEYS[key],
    cmd,
    mode,
  });
}

export function bindPad(pad: keyof typeof PAD, cmd: string, mode: BindMode): void {
  pad_binds.push({
    pad: PAD[pad],
    cmd,
    mode,
  });
}

export function bindsCheck(): void {
  // TODO: allow overriding cmd_parse.handle with chatUI.cmdParse for binding to
  //   network actions and access level checks?
  // TODO: deal with same key bound to multiple things?
  for (let ii = 0; ii < kb_binds.length; ++ii) {
    let bind = kb_binds[ii];
    if (keyDownEdge(bind.key)) {
      if (bind.mode === 'hold') {
        cmd_parse.handle(undefined, `${bind.cmd} 1`);
      } else {
        cmd_parse.handle(undefined, bind.cmd);
      }
    }
    if (bind.mode === 'hold' && keyUpEdge(bind.key)) {
      cmd_parse.handle(undefined, `${bind.cmd} 0`);
    }
  }

  for (let ii = 0; ii < pad_binds.length; ++ii) {
    let bind = pad_binds[ii];
    if (padButtonDownEdge(bind.pad)) {
      if (bind.mode === 'hold') {
        cmd_parse.handle(undefined, `${bind.cmd} 1`);
      } else {
        cmd_parse.handle(undefined, bind.cmd);
      }
    }
    if (bind.mode === 'hold' && padButtonUpEdge(bind.pad)) {
      cmd_parse.handle(undefined, `${bind.cmd} 0`);
    }
  }
}
