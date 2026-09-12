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
import { WithRequired } from 'glov/common/types';
import {
  DialogParam,
  dialogPush,
  dialogRegister,
} from './dialog_system';
import { startHeist } from './main';

export function signWithName(name: string, message: string, transient_long?: boolean): void {
  dialogPush({
    name,
    text: message,
    transient: true,
    transient_long,
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
      text: 'CHOOSE A HEIST',
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
      }],
    });
  },
});
