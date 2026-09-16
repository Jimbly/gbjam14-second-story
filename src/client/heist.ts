import assert from 'assert';
import { autoAtlas } from 'glov/client/autoatlas';
import * as camera2d from 'glov/client/camera2d';
import { DEBUG } from 'glov/client/engine';
import { ALIGN } from 'glov/client/font';
import { keyDown, KEYS } from 'glov/client/input';
import { markdownAuto } from 'glov/client/markdown';
import { sound3DListener, soundPlay } from 'glov/client/sound';
import { BLEND_ADDITIVE, spriteClipPop, spriteClipPush } from 'glov/client/sprites';
import { drawBox, drawLine, UIBox, uiGetFont, uiTextHeight } from 'glov/client/ui';
import { randCreate } from 'glov/common/rand_alea';
import { DataObject, Rec } from 'glov/common/types';
import { clamp, easeOut, ridx, sign } from 'glov/common/util';
import {
  JSVec2,
  JSVec4,
  v2addScale,
  v2cross,
  v2dist,
  v2distSq,
  v2iAdd,
  v2iNormalize,
  v2iScale,
  v2same,
  v2sub,
  Vec4,
} from 'glov/common/vmath';
import { actionDown, actionEdge } from './binds';
import { blend } from './blend';
import { dialog, dialogMoveLocked, dialogPush, dialogRun } from './dialog_system';
import { DIALOG_VIEWPORT, game_height, game_width } from './globals';
import { getPalette, leaveHeist, PickState, randInt, startUnlocking } from './main';
import { playSound } from './sound_data';
import { optionsMenu } from './options';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { abs, asin, atan2, ceil, cos, floor, max, min, round, PI, pow, random, sin, sqrt } = Math;

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

let palette: Vec4[];

// Room size: ~8x6
// hallway width: 2
const HEISTS = [{
  guards_initial: 0,
  guards_total: 4,
  w: 50,
  h: 40,
  chests: DEBUG ? 0 : 2,
  chests_locked: DEBUG? 0 : 1,
  room_min_w: 3,
  room_min_h: 3,
  room_min_area: [9, 21], // [base + range] - do not subdivide if would be larger than this
  room_max_area: 10*8, // subdivide if smaller than this
  heist_time: 120000,
  alert_time: 30000,
  chest_value_simple: 100,
  chest_value_locked: 200,
}, {
  guards_initial: 0,
  guards_total: 4,
  w: 50,
  h: 40,
  chests: 10,
  chests_locked: 5,
  room_min_w: 3,
  room_min_h: 3,
  room_min_area: [9, 21], // [base + range] - do not subdivide if would be larger than this
  room_max_area: 10*8, // subdivide if smaller than this
  heist_time: 120000,
  alert_time: 30000,
  chest_value_simple: 100,
  chest_value_locked: 200,
}];
type HeistDef = typeof HEISTS[number];

const TOWNDEF: HeistDef = {
  guards_initial: 0,
  guards_total: 0,
  w: 1,
  h: 1,
  chests: 0,
  chests_locked: 0,
  room_min_w: 0,
  room_min_h: 0,
  room_min_area: [0, 0],
  room_max_area: 0,
  heist_time: 0,
  alert_time: 0,
  chest_value_simple: 0,
  chest_value_locked: 0,
};

type MapEvent = {
  pos: JSVec2;
  type: string;
};
type Chest = {
  pos: JSVec2;
  type: 'simple' | 'locked';
  value: number;
  progress: number;
  opened: boolean;
  pick_state: PickState | null;
};
type Guard = {
  pos: JSVec2;
  goal: JSVec2 | null;
  target: JSVec2 | null;
  pause: number;
  bit?: boolean;
  chasing?: boolean;
  dir: number;
};
type Cell = 'wall' | 'floor' | 'door' | 'unknown';
class Level {
  def: HeistDef;
  w: number;
  h: number;
  constructor(def: HeistDef) {
    this.def = def;
    this.w = def.w;
    this.h = def.h;
  }
  cells: Cell[][] = [];
  tiles: string[][] = [];
  debug(): string {
    let chars = this.cells.map((row) => {
      return row.map((cell) => {
        return cell === 'wall' ? '#' : cell === 'door' ? '+' : cell === 'floor' ? ' ' : '?' as string;
      });
    });
    for (let ii = 0; ii < this.chests.length; ++ii) {
      let chest = this.chests[ii];
      chars[chest.pos[1]][chest.pos[0]] = '$';
    }

    return chars.map((row) => row.join('')).join('\n');
  }
  entrance: JSVec2 = [0,0];
  events: MapEvent[] = [];
  chests: Chest[] = [];
  guards: Guard[] = [];
}

Z.BACKGROUND = 1;
Z.WALLS = 5;
Z.CHESTS = 5;
Z.DOORS = 9;
Z.LIGHT = 20;
Z.HERO = 30;
Z.GUARDS = 31;
Z.CEILING = 40;
Z.FLOATERS = 150;

const TILE_Z: Rec<string, number> = {
  'jail': Z.WALLS,
  'shop': Z.WALLS,
  'npc': Z.WALLS,
  'wall-h': Z.WALLS,
  'wall-v': Z.WALLS,
  'wall-corner': Z.WALLS,
  'door-v': Z.DOORS,
  'door-h': Z.DOORS,
  'floor-1': Z.BACKGROUND,
  'floor-2': Z.CEILING,
  'chest-opened': Z.CHESTS,
  'chest-aborted': Z.CHESTS,
  'guard-right': Z.HERO,
  'guard-left': Z.HERO,
};

function cellsToTiles(level: Level): void {
  let { cells, w, h } = level;
  let tiles: string[][] = [];
  for (let yy = 0; yy < h; ++yy) {
    let row: string[] = [];
    for (let xx = 0; xx < w; ++xx) {
      let cellabove = yy && cells[yy - 1][xx] || 'floor';
      let cellleft = cells[yy][xx - 1] || 'floor';
      let cell = cells[yy][xx];
      let cellright = cells[yy][xx + 1] || 'floor';
      let cellbelow = yy < h - 1 && cells[yy + 1][xx] || 'floor';
      let spr;
      if (cell === 'wall') {
        if (cellabove === 'floor' && cellbelow === 'floor') {
          spr = 'wall-h';
        } else if (cellleft === 'floor' && cellright === 'floor') {
          spr = 'wall-v';
        } else {
          spr = 'wall-corner';
        }
      } else if (cell === 'door') {
        if (cellleft === 'floor' && cellright === 'floor') {
          spr = 'door-v';
        } else {
          spr = 'door-h';
        }
      } else {
        spr = 'floor-1';
      }
      row.push(spr);
    }
    tiles.push(row);
  }
  level.tiles = tiles;
}

function tilesToCells(level: Level): void {
  let { tiles, w, h } = level;
  let cells: Cell[][] = [];
  for (let yy = 0; yy < h; ++yy) {
    let row: Cell[] = [];
    for (let xx = 0; xx < w; ++xx) {
      let tile = tiles[yy][xx];
      switch (tile) {
        case 'wall-h':
        case 'wall-v':
        case 'wall-corner':
        case 'jail':
        case 'shop':
          row.push('wall');
          break;
        case 'door-v':
        case 'door-h':
          row.push('door');
          break;
        case 'npc':
        case 'guard-left':
        case 'guard-right':
        case 'floor-1':
        case 'floor-2':
        case 'chest-opened':
        case 'chest-aborted':
        case 'none':
          row.push('floor');
          break;
        default:
          assert(false, tile);
      }
    }
    cells.push(row);
  }
  level.cells = cells;
}

type TiledLayer = {
  data: number[];
  width: number;
  height: number;
  x: number;
  y: number;
};
const TILED_TILESET: Rec<number, string> = {
  0: 'chest',
  1: 'chest-aborted',
  2: 'chest-opened',
  3: 'chest-special',
  4: 'door-h',
  5: 'door-open-h',
  6: 'door-open-v',
  7: 'door-v',
  8: 'floor-1',
  9: 'floor-2',
  10: 'wall-corner',
  11: 'wall-h',
  12: 'wall-v',
  13: 'npc',
  14: 'jail',
  15: 'shop',
  16: 'hero-up',
  17: 'guard-right',
  18: 'guard-left',
};
function levelFromJSON(json: DataObject): Level {
  let level = new Level(TOWNDEF);
  level.w = json.width as number;
  level.h = json.height as number;
  let layers = json.layers as TiledLayer[];
  assert(layers.length === 1);
  let layer = layers[0];
  assert(!layer.x);
  assert(!layer.y);
  assert(layer.width === level.w);
  assert(layer.height === level.h);
  level.tiles = [];
  for (let yy = 0, idx=0; yy < level.h; ++yy) {
    let row: string[] = [];
    level.tiles.push(row);
    for (let xx = 0; xx < level.w; ++xx, ++idx) {
      let tileidx = layer.data[idx];
      if (!tileidx) {
        row.push('none');
      } else {
        let tile = TILED_TILESET[tileidx - 1];
        assert(tile);
        row.push(tile);
      }
    }
  }
  tilesToCells(level);
  return level;
}

let level: Level;
function genLevel(def: HeistDef): void {
  let rand = randCreate(floor(random() * 1000000));
  level = new Level(def);
  let { w, h, cells } = level;
  for (let yy = 0; yy < h; ++yy) {
    let row: Cell[] = [];
    for (let xx = 0; xx < w; ++xx) {
      row.push('unknown');
    }
    cells.push(row);
  }

  function carve(x: number, y: number, roomw: number, roomh: number): void {
    let yy1 = y - 1;
    let yy2 = y + roomh;
    for (let xx = x - 1; xx <= x + roomw; ++xx) {
      if (cells[yy1][xx] === 'unknown') {
        cells[yy1][xx] = 'wall';
      }
      if (cells[yy2][xx] === 'unknown') {
        cells[yy2][xx] = 'wall';
      }
    }
    let xx1 = x - 1;
    let xx2 = x + roomw;
    for (let yy = y - 1; yy <= y + roomh; ++yy) {
      if (cells[yy][xx1] === 'unknown') {
        cells[yy][xx1] = 'wall';
      }
      if (cells[yy][xx2] === 'unknown') {
        cells[yy][xx2] = 'wall';
      }
    }
    for (let yy = y; yy < y + roomh; ++yy) {
      for (let xx = x; xx < x + roomw; ++xx) {
        cells[yy][xx] = 'floor';
      }
    }
  }
  let allow_edge = true;
  function door(x: number, y: number): void {
    assert(cells[y][x] === 'wall' || cells[y][x] === 'door');
    if (!allow_edge && (x === 0 || y === 0 || x === w - 1 || y === h -1)) {
      return;
    }
    if (!allow_edge) {
      let num_floor = 0;
      for (let ii = 0; ii < DX.length; ++ii) {
        let xx = x + DX[ii];
        let yy = y + DY[ii];
        if (cells[yy][xx] === 'floor') {
          ++num_floor;
        }
      }
      if (num_floor < 2) {
        // T-intersection, ignore
        return;
      }
    }
    cells[y][x] = 'door';
  }

  let hpath = floor(h * 0.35) + rand.range(floor(h * 0.3));
  level.entrance = [0, hpath];
  carve(1, hpath, w - 2, 2);
  let vpath = floor(w * 0.4) + rand.range(floor(w * 0.3));
  carve(vpath, 1, 2, h - 2);
  let exit: JSVec2 = [0,0];
  // eslint-disable-next-line default-case
  switch (rand.range(3)) {
    case 0:
      exit = [w - 1, hpath];
      break;
    case 1:
      exit = [vpath, 0];
      break;
    case 2:
      exit = [vpath, h - 1];
      break;
  }
  door(level.entrance[0], level.entrance[1]);
  door(exit[0], exit[1]);
  level.events.push({
    pos: level.entrance,
    type: 'exit',
  });
  level.events.push({
    pos: exit,
    type: 'exit',
  });
  allow_edge = false;

  function roundRandom(v: number): number {
    if (rand.range(2)) {
      return ceil(v);
    } else {
      return floor(v);
    }
  }

  let { room_min_w, room_min_h, room_max_area } = def;
  let room_min_area = def.room_min_area[0] + rand.range(def.room_min_area[1]);

  let rooms: JSVec4[] = [];
  function subdivide(x: number, y: number, roomw: number, roomh: number): void {
    let minw = max(room_min_w, ceil(room_min_area / roomh));
    let minh = max(room_min_h, ceil(room_min_area / roomw));
    let canv = minw + 1 + minw <= roomw; // draw a vertical line to split
    let canh = minh + 1 + minh <= roomh;
    if (
      !canv && !canh || // can't subdivide
      roomw * roomh <= room_max_area && rand.random() < 0.75
    ) {
      rooms.push([x, y, roomw, roomh]);
      return carve(x, y, roomw, roomh);
    }
    let do_v = canv && (!canh || rand.random() > 0.667);
    if (do_v) {
      let pmin = minw;
      let pmax = roomw - minw - 1;
      let pos = rand.range(pmax - pmin) + pmin;
      subdivide(x, y, pos, roomh);
      subdivide(x + pos + 1, y, roomw - pos - 1, roomh);
    } else {
      let pmin = minh;
      let pmax = roomh - minh - 1;
      let pos = rand.range(pmax - pmin) + pmin;
      subdivide(x, y, roomw, pos);
      subdivide(x, y + pos + 1, roomw, roomh - pos - 1);
    }
  }

  subdivide(1, 1, vpath - 2, hpath - 2);
  subdivide(vpath + 3, 1, w - (vpath + 3) - 1, hpath - 2);
  subdivide(1, hpath + 3, vpath - 2, h - (hpath + 3) - 1);
  subdivide(vpath + 3, hpath + 3, w - (vpath + 3) - 1, h - (hpath + 3) - 1);

  // add doors
  for (let ii = rooms.length - 1; ii >= 0; --ii) {
    let room = rooms[ii];
    // if hallway-like, add to each end
    if (room[2] * 3 < room[3]) {
      // vertical hallway
      door(room[0] + roundRandom((room[2] - 1)/2), room[1] - 1);
      door(room[0] + roundRandom((room[2] - 1)/2), room[1] + room[3]);
    }
    if (room[3] * 3 < room[2]) {
      // horizontal hallway
      door(room[0] - 1, room[1] + roundRandom((room[3] - 1)/2));
      door(room[0] + room[2], room[1] + roundRandom((room[3] - 1)/2));
    }
    // otherwise, if a largish room, random wall, middleish
    if (room[2] >= 5 && room[3] >= 5 && room[2] * room[3] > room_min_area + (room_max_area - room_min_area) * 0.5) {
      let edge = rand.range(4);
      if (edge < 2) {
        door(edge === 0 ? room[0] - 1 : room[0] + room[2],
          room[1] + 2 + rand.range(room[3] - 4));
      } else {
        door(room[0] + 2 + rand.range(room[2] - 4),
          edge === 2 ? room[1] - 1 : room[1] + room[3]);
      }
    } else {
      // otherwise, just a random door
      let edge = rand.range(4);
      if (edge < 2) {
        door(edge === 0 ? room[0] - 1 : room[0] + room[2],
          room[1] + rand.range(room[3]));
      } else {
        door(room[0] + rand.range(room[2]),
          edge === 2 ? room[1] - 1 : room[1] + room[3]);
      }
    }
  }
  let reachable: boolean[][] = [];
  for (let yy = 0; yy < h; ++yy) {
    let row = [];
    for (let xx = 0; xx < w; ++xx) {
      row.push(false);
    }
    reachable.push(row);
  }
  let neighbors: JSVec2[] = [];
  function floodfill(startx: number, starty: number): void {
    let todo = [startx, starty];
    function push(xx: number, yy: number): void {
      todo.push(xx, yy);
      reachable[yy][xx] = true;
    }
    push(startx, starty);
    let todoidx = 0;
    while (todoidx < todo.length) {
      let x = todo[todoidx++];
      let y = todo[todoidx++];
      for (let ii = 0; ii < DX.length; ++ii) {
        let xx = x + DX[ii];
        let yy = y + DY[ii];
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) {
          continue;
        }
        if (reachable[yy][xx]) {
          continue;
        }
        let cell = cells[yy][xx];
        if (cell === 'wall') {
          let x3 = x + DX[ii] * 2;
          let y3 = y + DY[ii] * 2;
          if (cells[y3] && cells[y3][x3] === 'floor' && !reachable[y3][x3]) {
            neighbors.push([x3, y3]);
          }
          continue;
        }
        push(xx, yy);
      }
    }
  }
  floodfill(level.entrance[0], level.entrance[1]);
  while (true) {
    // flood-fill reachability
    // pick a random unreachable neighbor and poke a hole
    let targetx = 0;
    let targety = 0;
    let hastarget = false;
    while (true) {
      if (!neighbors.length) {
        break;
      }
      let idx = rand.range(neighbors.length);
      [targetx, targety] = neighbors[idx];
      ridx(neighbors, idx);
      if (!reachable[targety][targetx]) {
        hastarget = true;
        break;
      }
    }
    if (!hastarget) {
      break;
    }
    // add a door
    let order = [0, 1, 2, 3];
    while (order.length) {
      let idx = rand.range(order.length);
      let dir = order[idx];
      ridx(order, idx);
      let x2 = targetx + DX[dir];
      let y2 = targety + DY[dir];
      let x3 = targetx + DX[dir] * 2;
      let y3 = targety + DY[dir] * 2;
      if (reachable[y3] && reachable[y3][x3]) {
        assert(cells[y2][x2] === 'wall');
        door(x2, y2);
        floodfill(x2, y2);
        break;
      }
    }
  }
  function countDoors(room: JSVec4): number {
    let r = 0;
    for (let yy = -1; yy <= room[3]; ++yy) {
      for (let xx = -1; xx <= room[2]; ++xx) {
        if (cells[room[1] + yy][room[0] + xx] === 'door') {
          r++;
        }
      }
    }
    return r;
  }
  // add chests
  let { chests } = level;
  // first to leaf rooms
  let did_chests: Rec<number, boolean> = {};
  let occupied: Rec<number, boolean> = {};
  let desired_chests = def.chests;
  let locked_chests = def.chests_locked;
  function addChest(roomid: number): void {
    let room = rooms[roomid];
    did_chests[roomid] = true;
    --desired_chests;
    while (true) {
      let x = room[0] + rand.range(room[2]);
      let y = room[1] + rand.range(room[3]);
      if (!countDoors([x, y, 1, 1])) {
        const type = locked_chests ? 'locked' : 'simple';
        if (locked_chests) {
          --locked_chests;
        }
        let value = type === 'simple' ? def.chest_value_simple : def.chest_value_locked;
        occupied[x + y * w] = true;
        chests.push({
          pos: [x, y],
          type,
          value,
          progress: 0,
          opened: false,
          pick_state: null,
        });
        break;
      }
    }
  }
  for (let ii = 0; ii < rooms.length && desired_chests; ++ii) {
    let room = rooms[ii];
    let numdoors = countDoors(room);
    if (numdoors === 1) {
      addChest(ii);
    }
  }
  // then just random rooms
  let retries = 0;
  while (desired_chests && retries < 100) {
    let roomid = rand.range(rooms.length);
    if (did_chests[roomid]) {
      ++retries;
      continue;
    }
    retries = 0;
    addChest(roomid);
  }

  // add guards to random rooms
  let { guards } = level;
  let desired_guards = def.guards_initial;
  let did_guards: Rec<number, boolean> = {};
  while (desired_guards && retries < 100) {
    let roomid = rand.range(rooms.length);
    if (did_guards[roomid]) {
      ++retries;
      continue;
    }
    retries = 0;
    --desired_guards;
    let room = rooms[roomid];
    while (retries < 100) {
      let x = room[0] + rand.range(room[2]);
      let y = room[1] + rand.range(room[3]);
      if (occupied[x + y * w]) {
        ++retries;
        continue;
      }
      occupied[x + y * w] = true;
      guards.push({
        pos: [x + 0.5, y + 0.5],
        goal: null,
        target: null,
        pause: 0,
        dir: 0,
      });
      break;
    }
  }

  if (DEBUG) {
    chests.push({
      pos: [level.entrance[0] + 3, level.entrance[1]],
      type: 'simple',
      value: 200,
      progress: 0,
      opened: false,
      pick_state: null,
    });
    chests.push({
      pos: [level.entrance[0] + 5, level.entrance[1]],
      type: 'simple',
      value: 200,
      progress: 0,
      opened: false,
      pick_state: null,
    });
  }

  cellsToTiles(level);
}


function lineCircleAdvCollide(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, radius: number): {
  ret: boolean;
  xout: number;
  yout: number;
  interx: number;
  intery: number;
} {
  let xout;
  let yout;
  let interx = 0;
  let intery = 0;
  let dx = x1 - x0;
  let dcx = x0 - cx;
  let dy = y1 - y0;
  let dcy = y0 - cy;
  let A = dx*dx + dy*dy;
  let B = 2 * (dx*dcx + dy*dcy);
  let C = dcx*dcx + dcy*dcy - radius*radius;
  let intersects = false;
  let distance_remaining = 0;
  // Solve quadratic formula
  let det = B*B - 4 * A*C;
  if (det >= -0.001) {
    // determine point(s) of intersection
    let t0;
    let t1;
    if (A >= -0.001 && A <= 0.001 || det < 0) {
      if (B === 0) {
        if (C === 0) {
          t0 = t1 = 0;
        } else {
          t0 = t1 = -1;
        }
      } else {
        t0 = t1 = -C / B;
      }
    } else {
      t0 = (-B + sqrt(det)) / (2 * A);
      t1 = (-B - sqrt(det)) / (2 * A);
    }
    if ((t0 < 0 || t0 > 1) && (t1 >= 0 && t1 <= 1)) {
      t0 = t1; // get the one which is in the range 0..1 (on the line segment
    } else if (t0 >= 0 && t0 <= 1 && t1 >= 0 && t1 <= 1 && t1 < t0) {
      t0 = t1; // get the first one
    }
    if (t0 >= 0 && t0 <= 1) {
      intersects = true;
      interx = x0 + (x1 - x0) * t0;
      intery = y0 + (y1 - y0) * t0;
      distance_remaining = (1.0 - t0) * v2dist([x0, y0], [x1, y1]);
    } else {
      // We started and ended inside of the collision area, maybe someone just
      // laid a bomb down here?
    }
  }
  if (intersects) {
    let x = interx - cx;
    let y = intery - cy;

    let dthetaSign = v2cross([x, y],
      [interx - x1, intery - y1]);
    dthetaSign = (dthetaSign > 0) ? 1 : -1;

    // Find current theta and advance
    let theta = asin(clamp(x / radius, -1, 1));
    if (theta > PI/2) {
      theta -= 2 * PI;
    }
    // theta in range of -pi/2 to pi/2
    if (y < 0) {
      // should be in range pi/2 to 3pi/2
      theta = PI - theta;
    }
    theta += dthetaSign * (distance_remaining / radius);
    let x2 = (radius * 1.01) * sin(theta);
    let y2 = (radius * 1.01) * cos(theta);
    xout = cx + x2;
    yout = cy + y2;

  } else {
    xout = x1;
    yout = y1;
  }
  return {
    ret: intersects,
    xout,
    yout,
    interx,
    intery,
  };
}

type Floater = {
  t: number;
  msg: string;
  pos: JSVec2;
};
class HeistState {
  pos: JSVec2 = [0, 0];
  dir = 1;
  speed = 1;
  loot = 0;
  floaters: Floater[] = [];
  unlocking = -1;
  was_on_event = false;
  was_on_chest = -1;
  time_max = 0;
  timer = 0;
  did_alert = false;
  caught = false;
  touched_first_chest = false;
  started = false;
  did_thats_all = false;
}

let heist_state: HeistState;

let cur_map: string;
function initMap(name: string, json: DataObject): void {
  cur_map = name;
  level = levelFromJSON(json);
  let { tiles } = level;
  for (let yy = 0; yy < level.h; ++yy) {
    for (let xx = 0; xx < level.w; ++xx) {
      let tile = tiles[yy][xx];
      if (tile === 'shop') {
        level.events.push({
          pos: [xx-1, yy + (name === 'town' ? -1 : 1)],
          type: 'shopenter',
        });
      } else if (tile === 'jail') {
        level.events.push({
          pos: [xx-1, yy + (name === 'town' ? -1 : 1)],
          type: 'jailenter',
        });
      } else if (tile === 'door-v') {
        if (xx === level.w - 1 && name === 'town') {
          level.events.push({
            pos: [xx, yy],
            type: 'startheist',
          });
        } else if (name === 'jail') {
          if (xx > 4) {
            level.events.push({
              pos: [xx+1, yy],
              type: 'jailenter',
            });
          }
        }
      }
    }
  }
}

function doEvent(event: MapEvent): void {
  switch (event.type) {
    case 'exit':
      if (!heist_state.loot) {
        dialogPush({
          text: 'ARE YOU SURE YOU WANT TO LEAVE?  YOU HAVE NOT FOUND ANYTHING YET.',
          buttons: [{
            label: 'NO, CONTINUE LOOTING',
          }, {
            label: 'YES, LEAVE',
            cb: function () {
              leaveHeist(true, heist_state.loot);
            }
          }],
        });
      } else {
        leaveHeist(true, heist_state.loot);
      }
      break;
    case 'shopenter':
      if (cur_map === 'town') {
        // eslint-disable-next-line n/global-require
        initMap('shop', require('./shop.json'));
      } else {
        // eslint-disable-next-line n/global-require
        initMap('town', require('./town.json'));
      }
      break;
    case 'jailenter':
      if (cur_map === 'town') {
        // eslint-disable-next-line n/global-require
        initMap('jail', require('./jail.json'));
      } else {
        // eslint-disable-next-line n/global-require
        initMap('town', require('./town.json'));
      }
      break;
    case 'startheist':
      dialog('choose');
      break;
    default:
      dialogPush({
        text: `UNKNOWN EVENT "${event.type}"`,
        buttons: [{ label: 'OK' }],
      });
  }
}

export function stateHeistInit(index: number): void {
  palette = getPalette();
  let def = HEISTS[index] || HEISTS[0];
  genLevel(def);
  console.log(level.debug());
  heist_state = new HeistState();
  heist_state.pos = [
    level.entrance[0] + 1.5,
    level.entrance[1] + 0.5,
  ];
  if (DEBUG && false) {
    heist_state.pos[0] += 4;
  }
  heist_state.timer = heist_state.time_max = def.heist_time;
}
function doMotion(dt: number, is_town: boolean): void {
  let { pos, caught } = heist_state;
  if (dialogMoveLocked() || caught) {
    return;
  }
  let { cells, chests } = level;
  let impulse: JSVec2 = [0, 0];
  if (dt) {
    if (actionDown('up')) {
      impulse[1]--;
    }
    if (actionDown('down')) {
      impulse[1]++;
    }
    if (actionDown('left')) {
      impulse[0]--;
    }
    if (actionDown('right')) {
      impulse[0]++;
    }
  }
  dt = min(dt, 1000/15); // below 15fps, just slow down
  v2iNormalize(impulse);
  // default speed : 1 pixel per 60fps frame
  let move_dist = dt * heist_state.speed * 1/14/(1000/60);
  v2iScale(impulse, move_dist);

  let startx = pos[0];
  let starty = pos[1];
  if (0) {
    // nocoll
    v2iAdd(pos, impulse);
  } else {
    // Logic from Splody:
    // Treat player as sphere
    // Do edge collisions first (push player back along movement vector)
    // need to check only edges adjacent to where we will end up
    // If we hit no edges, then check corners, and swing the player along an arc
    //  around the corner if they intersected it.
    // If we hit an edge, I don't think it's possible to hit a corner after being moved

    let fx2 = pos[0] + impulse[0];
    let fy2 = pos[1] + impulse[1];
    const player_radius = 0.49;

    function cellIsOpen(xx: number, yy: number): boolean {
      let cell = cells[yy] && cells[yy][xx];
      return cell === 'floor' || cell === 'door';
    }

    for (let do_edges_twice = 0; do_edges_twice < 2; do_edges_twice++) {
      let x2 = floor(fx2);
      let y2 = floor(fy2);
      let fdx = fx2 - pos[0];
      let fdy = fy2 - pos[1];
      // Edges
      if (1) {
        for (let edge = 0; edge < DX.length; edge++) {
          let dx = DX[edge];
          let dy = DY[edge];
          let fpartx2 = fx2 - x2;
          let fparty2 = fy2 - y2;
          if (dx === -1 && fpartx2 < player_radius ||
            dy === -1 && fparty2 < player_radius ||
            dx === 1 && fpartx2 > 1.0 - player_radius ||
            dy === 1 && fparty2 > 1.0 - player_radius
          ) {
            // Will collide with the given edge
            if (!cellIsOpen(x2 + dx, y2 + dy)) {
              // And there's something there!  Move position in offending direction out by
              //  the radius from the wall
              let newx = x2 + (dx + 1) / 2 - dx * player_radius;
              let newy = y2 + (dy + 1) / 2 - dy * player_radius;
              let saved_fx2 = fx2;
              let saved_fy2 = fy2;
              // From the world
              if (dx) {
                fx2 = newx;
              } else if (dy) {
                fy2 = newy;
              }

              // Squishy Movement
              let lost = v2dist([fx2, fy2], [saved_fx2, saved_fy2]);

              let open_adj = [[
                cellIsOpen(x2 - 1, y2 - 1),
                cellIsOpen(x2, y2 - 1),
                cellIsOpen(x2 + 1, y2 - 1),
              ], [
                cellIsOpen(x2 - 1, y2),
                cellIsOpen(x2, y2),
                cellIsOpen(x2 + 1, y2),
              ], [
                cellIsOpen(x2 - 1, y2 + 1),
                cellIsOpen(x2, y2 + 1),
                cellIsOpen(x2 + 1, y2 + 1),
              ]];
              // If pushing against a flat wall, and there's a corner around it, move
              // towards the open corner
              if (dx) {
                if (fparty2 <= 0.5 &&
                  open_adj[0][1 + dx] &&
                  open_adj[0][1]
                ) {
                  if (fdy <= 0) {
                    fy2 -= lost;
                  }
                } else if (fparty2 >= 0.25 &&
                  open_adj[2][1 + dx] &&
                  open_adj[2][1]
                ) {
                  if (fdy >= 0) {
                    fy2 += lost;
                  }
                } else if (fparty2 <= 0.75 &&
                  open_adj[0][1 + dx] &&
                  open_adj[0][1]
                ) {
                  if (fdy <= 0) {
                    fy2 -= lost;
                  }
                }
              } else if (dy) {
                if (fpartx2 <= 0.5 &&
                  open_adj[1 + dy][0] &&
                  open_adj[1][0]
                ) {
                  if (fdx <= 0) {
                    fx2 -= lost;
                  }
                } else if (fparty2 >= 0.25 &&
                  open_adj[1 + dy][2] &&
                  open_adj[1][2]
                ) {
                  if (fdx >= 0) {
                    fx2 += lost;
                  }
                } else if (fparty2 <= 0.75 &&
                  open_adj[1 + dy][0] &&
                  open_adj[1][0]
                ) {
                  if (fdx <= 0) {
                    fx2 -= lost;
                  }
                }
              }
            }
          }
        } // for (edges)
      }
      // Corners
      if (do_edges_twice === 0) {
        const adx = [0, 1, 1, 0];
        const ady = [0, 0, 1, 1];
        for (let diags = 0; diags < adx.length; diags++) {
          let dx = adx[diags];
          let dy = ady[diags];
          let cornerx = x2 + dx;
          let cornery = y2 + dy;
          let dist_to_corner = v2dist([fx2, fy2], [cornerx, cornery]);
          let dist_to_corner_from_start = v2dist(pos, [cornerx, cornery]);
          if (dist_to_corner < player_radius + 0.0001) {
            // Hits!
            let tilex = x2 + dx * 2 - 1;
            let tiley = y2 + dy * 2 - 1;
            if (!cellIsOpen(tilex, tiley)) {
              // And there's something in the way.
              // a) find line-circle intersection point
              // b) calc distance of line segment inside circle
              // c) set fx2, fy2 to a point on the circle moved that much distance
              //   along the arc from the intersection point
              let fx0 = pos[0];
              let fy0 = pos[1];
              if (dist_to_corner_from_start > player_radius - 0.001 &&
                dist_to_corner_from_start < player_radius + 0.0001
              ) {
                // We're starting inside the circle!
                // Push out a bit so this works
                let scale = (player_radius + 0.0001) / dist_to_corner_from_start;
                assert(scale >= 1.0 && scale < 1.5);
                fx0 = (fx0 - cornerx) * scale + cornerx;
                fy0 = (fy0 - cornery) * scale + cornery;
              }
              let ret = lineCircleAdvCollide(fx0, fy0, fx2, fy2, cornerx, cornery, player_radius);
              if (!ret.ret) {
                //console.log("");
              } else {
                let { xout, yout } = ret;
                fx2 = xout;
                fy2 = yout;
              }
            }
          }
        } // for(diags)
      }
    }
    pos[0] = fx2;
    pos[1] = fy2;
  }

  let dist = v2distSq([startx, starty], pos);
  if (dist > move_dist * move_dist) {
    let delta = v2sub([0, 0], pos, [startx, starty]);
    v2iNormalize(delta);
    v2addScale(pos, [startx, starty], delta, move_dist);
    dist = v2distSq([startx, starty], pos);
  }

  if (dist > 0.01*0.01) {
    heist_state.dir = impulse[0] > 0 ? 1 : impulse[0] < 0 ? 3 : impulse[1] > 0 ? 0 : 2;
  }

  // events on current cell
  let map_pos: JSVec2 = [pos[0] - 0.5, pos[1] - 0.5];
  let on_chest = -1;
  let unopened_chests = 0;
  for (let ii = 0; ii < chests.length; ++ii) {
    let chest = chests[ii];
    if (!chest.opened) {
      unopened_chests++;
      if (v2distSq(chest.pos, map_pos) < 0.9*0.9) {
        on_chest = ii;
      }
    }
  }
  if (on_chest !== -1 && heist_state.was_on_chest !== on_chest) {
    let chest = chests[on_chest];
    if (!heist_state.touched_first_chest) {
      heist_state.touched_first_chest = true;
      if (chest.type === 'simple') {
        for (let ii = 0; ii < chests.length; ++ii) {
          let other = chests[ii];
          if (other.type === 'locked') {
            // swap, force first chest to be locked!
            let t = chest.value;
            chest.value = other.value;
            other.value = t;
            chest.type = 'locked';
            other.type = 'simple';
            break;
          }
        }
      }
    }
    if (chest.type === 'locked') {
      playSound('locked');
      heist_state.unlocking = on_chest;
      heist_state.floaters.push({
        t: 0,
        pos: chest.pos,
        msg: '[c=1]LOCKED!',
      });
    } else {
      playSound('pickup');
      heist_state.started = true;
      chest.opened = true;
      heist_state.loot += chest.value;
      heist_state.floaters.push({
        t: 0,
        pos: chest.pos,
        msg: `[c=2]+$[c=3]${chest.value}`,
      });
    }
  }
  heist_state.was_on_chest = on_chest;

  if (!unopened_chests && !heist_state.did_thats_all && !is_town) {
    heist_state.did_thats_all = true;
    playSound('thatsall');
    heist_state.floaters.push({
      t: 0,
      pos: [pos[0] - 0.5, pos[1]],
      msg: '[c=3]THAT\'S EVERYTHING!',
    });
  }

  let { events } = level;
  let on_event = false;
  for (let ii = 0; ii < events.length; ++ii) {
    let event = events[ii];
    let on_it = v2distSq(map_pos, event.pos) < 0.5 * 0.5;
    if (on_it) {
      on_event = true;
    }
    if (on_it && !heist_state.was_on_event) {
      doEvent(event);
    }
  }
  heist_state.was_on_event = on_event;

  if (!heist_state.caught) {
    let { guards } = level;
    for (let ii = 0; ii < guards.length; ++ii) {
      let guard = guards[ii];
      if (v2distSq(guard.pos, pos) < 0.8*0.8) {
        playSound('guard_caught');
        heist_state.floaters.push({
          t: 0,
          pos: [guard.pos[0] - 0.5, guard.pos[1]],
          msg: '[c=1]GOT YA!',
        });
        heist_state.caught = true;
      }
    }
  }
}

function chooseRandomFloorSub(x0: number, y0: number): JSVec2 {
  let { w, h, cells } = level;
  let todo: JSVec2[] = [];
  let todo_idx = 0;
  let done: Rec<number, boolean> = {};
  function push(x: number, y: number): void {
    done[x + y*w] = true;
    todo.push([x, y]);
  }
  push(x0, y0);
  while (todo_idx < todo.length) {
    let [x, y] = todo[todo_idx++];
    for (let ii = 0; ii < DX.length; ++ii) {
      let x2 = x + DX[ii];
      let y2 = y + DY[ii];
      if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h || cells[y2][x2] !== 'floor' || done[x2 + y2*w]) {
        continue;
      }
      push(x2, y2);
    }
  }
  let idx = randInt(todo.length);
  return todo[idx];
}
function updateGuardDir(guard: Guard): void {
  assert(guard.target);
  let dx = guard.target[0] - guard.pos[0];
  let dy = guard.target[1] - guard.pos[1];
  guard.dir = abs(dy) > abs(dx) ? dy > 0 ? 0 : 2 : dx > 0 ? 1 : 3;
}
function chooseRandomFloor(guard: Guard, x0: number, y0: number): void {
  let { cells } = level;
  let options = [];
  for (let ii = 0; ii < DX.length; ++ii) {
    let xx = x0 + DX[ii];
    let yy = y0 + DY[ii];
    if (cells[yy]?.[xx] === 'floor') {
      options.push({
        target: [xx, yy] as JSVec2,
        goal: chooseRandomFloorSub(xx, yy),
      });
    }
  }
  let idx = randInt(options.length);
  let opt = options[idx];
  guard.target = [
    opt.target[0] + 0.5,
    opt.target[1] + 0.5,
  ];
  guard.goal = opt.goal;
  updateGuardDir(guard);
}
function chooseRandomDoor(guard: Guard, x0: number, y0: number): void {
  let { w, h, cells } = level;
  let todo: JSVec2[] = [];
  let todo_idx = 0;
  let done: Rec<number, boolean> = {};
  let options: JSVec2[] = [];
  function push(x: number, y: number): void {
    done[x + y*w] = true;
    todo.push([x, y]);
  }
  push(x0, y0);
  while (todo_idx < todo.length) {
    let [x, y] = todo[todo_idx++];
    for (let ii = 0; ii < DX.length; ++ii) {
      let x2 = x + DX[ii];
      let y2 = y + DY[ii];
      if (x2 < 0 || y2 < 0 || x2 >= w || y2 >= h || done[x2 + y2*w]) {
        continue;
      }
      let cell = cells[y2][x2];
      if (cell === 'floor') {
        push(x2, y2);
      } else if (cell === 'door') {
        options.push([x2, y2]);
      }
    }
  }
  let idx = randInt(options.length);
  guard.goal = options[idx];
}
function pickGoal(guard: Guard): void {
  let x = floor(guard.pos[0]);
  let y = floor(guard.pos[1]);
  let { cells } = level;
  let cell = cells[y][x];
  if (cell === 'door') {
    chooseRandomFloor(guard, x, y);
  } else {
    chooseRandomDoor(guard, x, y);
  }
}

function canSee(pos1: JSVec2, pos2: JSVec2): boolean {
  let { cells } = level;
  let [x0, y0] = pos1;
  x0 = floor(x0);
  y0 = floor(y0);
  let [x1, y1] = pos2;
  x1 = floor(x1);
  y1 = floor(y1);
  let dx = abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;

  while (true) {
    let cell = cells[y0][x0];
    if (cell === 'wall') {
      return false;
    }
    let e2 = 2 * error;
    if (e2 >= dy) {
      if (x0 === x1) {
        break;
      }
      error += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      if (y0 === y1) {
        break;
      }
      error += dx;
      y0 += sy;
    }
  }
  return true;
}

const SOUND_SPATIAL_SCALE = 5;
function doGuards(dt: number): void {
  let { pos: player_pos } = heist_state;

  sound3DListener({
    pos: [player_pos[0] * SOUND_SPATIAL_SCALE, player_pos[1] * SOUND_SPATIAL_SCALE, 0],
    forward: [0, 0, 1],
    up: [0, -1, 0],
  });

  let { guards, cells } = level;
  // default speed : 1 pixel per 60fps frame
  let move_dist = dt * 1/14/(1000/60);
  let closest_footstep: JSVec2 | null = null;
  for (let ii = 0; ii < guards.length; ++ii) {
    let guard = guards[ii];
    if (!guard.target) {
      let was_chasing = guard.chasing;
      let guard_radius = guard.chasing ? 2.75 : 2.5;
      guard.chasing = false;
      if (v2distSq(guard.pos, player_pos) < guard_radius * guard_radius) {
        // potentially in range, do we have line of sight?
        if (canSee(guard.pos, player_pos)) {
          guard.chasing = true;
          guard.goal = [floor(player_pos[0]), floor(player_pos[1])];
          heist_state.started = true;
        }
      }
      if (guard.chasing !== was_chasing) {
        playSound(guard.chasing ? 'guard_chase' : 'guard_forget');
      }
    }
    if (!guard.goal) {
      pickGoal(guard);
    }
    assert(guard.goal);
    if (!guard.target) {
      let iposx = floor(guard.pos[0]);
      let iposy = floor(guard.pos[1]);
      let dx = guard.goal[0] + 0.5 - guard.pos[0];
      if (abs(dx) < 0.5) {
        dx = 0;
      }
      dx = sign(dx);
      let dx0 = dx;
      let dy = guard.goal[1] + 0.5 - guard.pos[1];
      if (abs(dy) < 0.5) {
        dy = 0;
      }
      dy = sign(dy);
      let xcell = cells[iposy][iposx + dx];
      if (xcell !== 'floor' && xcell !== 'door' ||
        !guard.chasing && xcell === 'door' && !v2same(guard.goal, [iposx+dx, iposy])
      ) {
        dx = 0;
      }
      let ycell = cells[iposy + dy]?.[iposx];
      if (ycell !== 'floor' && ycell !== 'door' ||
        !guard.chasing && ycell === 'door' && !v2same(guard.goal, [iposx, iposy+dy])
      ) {
        dy = 0;
      }
      if (!dx && !dy) {
        // wall must be blocking, move perpendicular
        guard.bit = !guard.bit;
        if (dx0) {
          dy = guard.bit ? 1 : -1;
        } else {
          dx = guard.bit ? 1 : -1;
        }
        assert(cells[iposy+dy][iposx+dx] === 'floor');
      }
      assert(dx || dy);
      if (dx && dy) {
        if (randInt(2)) {
          dx = 0;
        } else {
          dy = 0;
        }
      }
      guard.target = [
        iposx + dx + 0.5,
        iposy + dy + 0.5,
      ];
      updateGuardDir(guard);
      if (!closest_footstep || v2distSq(guard.pos, player_pos) < v2distSq(closest_footstep, player_pos)) {
        closest_footstep = guard.pos;
      }
    }
    if (guard.pause) {
      guard.pause = max(0, guard.pause - dt);
    } else {
      guard.pos[0] += sign(guard.target[0] - guard.pos[0]) * move_dist;
      guard.pos[1] += sign(guard.target[1] - guard.pos[1]) * move_dist;
      let match = 0;
      if (abs(guard.target[0] - guard.pos[0]) <= move_dist) {
        guard.pos[0] = guard.target[0];
        ++match;
      }
      if (abs(guard.target[1] - guard.pos[1]) <= move_dist) {
        guard.pos[1] = guard.target[1];
        ++match;
      }
      if (match === 2) {
        guard.target = null;
        guard.pause = guard.chasing ? 33 : 200;
        if (abs(guard.goal[0] + 0.5 - guard.pos[0]) + abs(guard.goal[1] + 0.5 - guard.pos[1]) <= 0.1) {
          guard.goal = null;
        }
      }
    }
  }

  if (closest_footstep) {
    soundPlay('footstep', {
      pos: [
        closest_footstep[0] * SOUND_SPATIAL_SCALE,
        closest_footstep[1] * SOUND_SPATIAL_SCALE,
        SOUND_SPATIAL_SCALE
      ],
    });
  }
}

function drawHeistHUD(dt: number, is_town: boolean): void {
  let x = 0;
  let y = 0;
  let h = 11;
  let w = 66;
  let z = Z.UI;
  if (is_town) {
    // show money?
  } else {
    drawBox({
      x, y, h, w,
      z: z - 1,
    }, autoAtlas('gfx', 'box'));
    let { loot } = heist_state;
    let eff_bonus = blend('loot', loot);
    markdownAuto({
      x: x + 2, y: y + 2, z: z + 1, w, h,
      text: `[c=2]LOOT: [c=3]$${round(eff_bonus)}[/c][/c]`,
    });
  }

  dialogRun(
    dt,
    { ...DIALOG_VIEWPORT },
    false,
  );
}

export function finishUnlocking(success: boolean, bonus: number, partial_progress: number): void {
  heist_state.floaters.length = 0;
  let chest = level.chests[heist_state.unlocking];
  if (success) {
    chest.opened = true;
    heist_state.started = true;
    heist_state.loot += chest.value + bonus;
    heist_state.floaters.push({
      t: 0,
      pos: chest.pos,
      msg: `[c=2]+$[c=3]${chest.value + bonus}`,
    });
  } else {
    chest.progress = partial_progress;
    heist_state.floaters.push({
      t: 0,
      pos: chest.pos,
      msg: '[c=1]ABORTED!',
    });
  }
  heist_state.unlocking = -1;
}

export function doTimer(dt: number): void {
  let x = 0;
  let y = 0;
  let h = 11;
  let w = game_width / 2 - 4;
  let z = Z.UI;

  if (!dialogMoveLocked() && heist_state.started) {
    heist_state.timer -= dt;
  }

  let { timer, time_max, did_alert } = heist_state;

  x = game_width - w;
  drawBox({
    x, y, h, w,
    z: z - 1,
  }, autoAtlas('gfx', 'box'));
  // fill in corner so it doesn't flicker
  drawLine(game_width - 1, y, game_width, y, z-1, 1, 1, palette[1]);

  let c = 1;
  if (did_alert) {
    if (timer % 500 < 125) {
      c += 2;
    }
  }
  markdownAuto({
    x: x + 2, y: y + 2, z: z + 1, w: w - 3, h,
    align: ALIGN.HRIGHT,
    text: `[c=${c}]TIME LEFT[/c]`,
  });
  drawBox({
    x: x + 1,
    y: y + 1,
    h: h - 2,
    w: round((timer / time_max) * (w - 1)),
    z,
  }, autoAtlas('gfx', 'bar'));

  let { guards, def, entrance } = level;
  if (guards.length < def.guards_total) {
    let time_per_guard = (time_max - def.alert_time) / (def.guards_total - def.guards_initial);
    let expected_guards = def.guards_initial + floor((time_max - timer) / time_per_guard);
    if (guards.length < expected_guards) {
      // spawn a guard
      playSound('guard_arrived');
      guards.push({
        pos: [entrance[0] + 0.5, entrance[1] + 0.5],
        target: null,
        goal: null,
        pause: 0,
        dir: 1,
      });
      heist_state.floaters.push({
        t: 0,
        pos: [
          heist_state.pos[0] - 0.5,
          heist_state.pos[1],
        ],
        msg: '[c=2]NEW GUARD!',
      });
    }
    if (guards.length < def.guards_total) {
      let guard_spawn_timer = (timer - def.alert_time) % time_per_guard;
      drawLine(x, y + h, x + w, y + h, z, 1, 1, palette[0]);
      drawLine(x, y + h, x + w * (1 - guard_spawn_timer/time_per_guard), y + h, z + 1, 1, 1, palette[3]);
    }
  }


  if (dialogMoveLocked()) {
    return;
  }
  if (heist_state.timer <= level.def.alert_time && !heist_state.did_alert) {
    heist_state.did_alert = true;
    playSound('alert');
  }
  if (heist_state.timer <= 0) {
    heist_state.timer = 0;
    dialogPush({
      text: 'OH NO! OUTTA TIME, THIS PLACE IS SURROUNDED.\n\n' +
        '[c=0]I GUESS I GOTTA DROP EVERYTHING AND GET OUT OF HERE...[/c]',
      buttons: [{
        label: 'AT LEAST I WASN\'T CAUGHT...',
        cb: function () {
          leaveHeist(false, 0);
        }
      }],
    });
  }
}

const TILESIZE = 14;

function doHeistViewSub(rect: UIBox): void {
  let { pos } = heist_state;

  let hx = round(pos[0] * TILESIZE);
  let hy = round(pos[1] * TILESIZE);
  let centerx = floor(rect.x + rect.w/2);
  let centery = floor(rect.y + rect.h/2);
  camera2d.shift(
    clamp(-centerx + hx, -rect.x, level.w * TILESIZE - rect.w),
    clamp(-centery + hy, -rect.y, level.h * TILESIZE - rect.h));

  autoAtlas('gfx', ['hero-down', 'hero-right', 'hero-up', 'hero-left'][heist_state.dir]).draw({
    x: hx - TILESIZE/2,
    y: hy - TILESIZE/2,
    z: Z.HERO,
    w: TILESIZE,
    h: TILESIZE,
  });

  let x0 = floor(camera2d.x0() / TILESIZE);
  let x1 = floor(camera2d.x1() / TILESIZE);
  let y0 = floor(camera2d.y0() / TILESIZE);
  let y1 = floor(camera2d.y1() / TILESIZE);
  let { tiles, chests, guards, w, h } = level;
  for (let yy = y0; yy <= min(y1, h-1); ++yy) {
    for (let xx = x0; xx <= min(x1, w-1); ++xx) {
      let spr = tiles[yy][xx];
      if (spr === 'none') {
        continue;
      }
      let z = TILE_Z[spr];
      assert(z);
      autoAtlas('gfx', spr).draw({
        x: xx * TILESIZE,
        y: yy * TILESIZE,
        w: TILESIZE,
        h: TILESIZE,
        z,
      });
    }
  }
  for (let ii = 0; ii < chests.length; ++ii) {
    let chest = chests[ii];
    autoAtlas('gfx', chest.opened ? 'chest-opened' : chest.pick_state ? 'chest-aborted' : 'chest').draw({
      x: chest.pos[0] * TILESIZE,
      y: chest.pos[1] * TILESIZE,
      w: TILESIZE,
      h: TILESIZE,
      z: Z.CHESTS,
    });
  }

  for (let ii = 0; ii < guards.length; ++ii) {
    let guard = guards[ii];
    autoAtlas('gfx', ['guard-down', 'guard-right', 'guard-up', 'guard-left'][guard.dir]).draw({
      x: round(guard.pos[0] * TILESIZE) - TILESIZE/2,
      y: round(guard.pos[1] * TILESIZE) - TILESIZE/2,
      w: TILESIZE,
      h: TILESIZE,
      z: Z.GUARDS,
    });
    autoAtlas('gfx', 'light').draw({
      x: round(guard.pos[0] * TILESIZE) - 35,
      y: round(guard.pos[1] * TILESIZE) - 35,
      w: 70,
      h: 70,
      blend: BLEND_ADDITIVE,
      z: Z.LIGHT,
    });
    if (DEBUG && false) {
      uiGetFont().draw({
        color: 0xFFFFFFff,
        x: round(guard.pos[0] * TILESIZE),
        y: round(guard.pos[1] * TILESIZE) - TILESIZE/2 - 8,
        z: Z.GUARDS + 1,
        align: ALIGN.HCENTER,
        text: `${guard.goal}`,
      });
    }
  }
}

function doFloaters(dt: number): void {
  let { floaters, caught } = heist_state;
  let { chests } = level;
  let z = Z.FLOATERS + 2;
  for (let ii = floaters.length - 1; ii >= 0; --ii) {
    let floater = floaters[ii];
    floater.t += dt;
    let t = floater.t / 1000;
    if (t >= 1) {
      floaters.splice(ii, 1);
      if (heist_state.unlocking !== -1) {
        // start unlocking game
        let chest = chests[heist_state.unlocking];
        chest.pick_state = startUnlocking(chest.pick_state);
      }
      continue;
    }
    let xx = (floater.pos[0] + 0.5) * TILESIZE;
    let text_height = uiTextHeight();
    let yy = floater.pos[1] * TILESIZE - round(easeOut(t, 2) * TILESIZE) - text_height;
    let text_w = uiGetFont().getStringWidth(null, text_height, floater.msg.replace(/\[c=\d\]/g, '')) + 4;
    xx -= floor(text_w/2);
    markdownAuto({
      x: xx,
      y: yy,
      w: text_w,
      z,
      align: ALIGN.HCENTER,
      text: floater.msg,
    });
    drawBox({
      x: xx,
      y: yy - 3,
      w: text_w,
      h: text_height + 5,
      z: z - 0.1,
    }, autoAtlas('gfx', 'box'));
    z--;
  }

  if (!floaters.length && caught) {
    heist_state.caught = false;
    heist_state.loot = 0;
    dialogPush({
      text: 'THE GUARDS TAKE EVERYTHING YOU\'VE FOUND AND LOCK YOU UP.\n\n' +
        'LUCKILY YOU\'RE BETTER AT HIDING YOUR LOCKPICKS THAN THEY ARE AT SEARCHING,' +
        ' SO IN THE NIGHT YOU ESCAPE AND GET BACK TO YOUR TASK...',
      buttons: [{
        label: 'PHEW, THAT WAS CLOSE...',
        cb: function () {
          leaveHeist(false, 0);
        }
      }],
    });
  }
}

export function doHeistView(dt: number, rect: UIBox): void {
  let { caught } = heist_state;
  let unpaused_dt = dialogMoveLocked() || caught ? 0 : dt;

  doGuards(unpaused_dt);
  doMotion(0, false);

  spriteClipPush(Z.BACKGROUND + 1, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
  doHeistViewSub(rect);
  spriteClipPop();

  doFloaters(dt);

  camera2d.setAspectFixed(game_width, game_height);
}

export function stateHeist(dt: number, is_town: boolean):void {
  // center camera on hero
  if (DEBUG && keyDown(KEYS.SHIFT)) {
    dt *= 2;
  }
  camera2d.setAspectFixed(game_width, game_height);
  let { unlocking, caught } = heist_state;
  let unpaused_dt = unlocking !== -1 || dialogMoveLocked() || caught ? 0 : dt;
  if (!is_town) {
    doTimer(unpaused_dt);

    doGuards(unpaused_dt);
  }

  if (unlocking === -1) {
    doMotion(dt, is_town);
  }

  doHeistViewSub({
    x: 0,
    y: 0,
    w: game_width,
    h: game_height,
  });

  doFloaters(dt);
  // camera back to normal for HUD
  camera2d.setAspectFixed(game_width, game_height);
  drawHeistHUD(dt, is_town);

  if (actionEdge('cancel')) {
    optionsMenu('game');
  }
}

export function initTownMap(initial: boolean): void {
  palette = getPalette();
  // eslint-disable-next-line n/global-require
  initMap('town', require('./town.json'));
  heist_state = new HeistState();
  if (initial) {
    heist_state.pos = [
      7.5,
      14.5,
    ];
    heist_state.dir = 2;
  } else {
    heist_state.pos = [
      16.5,
      8.5,
    ];
    heist_state.dir = 3;
  }
  heist_state.timer = heist_state.time_max = 0;
}
