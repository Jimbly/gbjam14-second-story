import assert from 'assert';
import { autoAtlas } from 'glov/client/autoatlas';
import * as camera2d from 'glov/client/camera2d';
import { ALIGN } from 'glov/client/font';
import { markdownAuto } from 'glov/client/markdown';
import { drawBox, uiGetFont, uiTextHeight } from 'glov/client/ui';
import { randCreate } from 'glov/common/rand_alea';
import { Rec } from 'glov/common/types';
import { clamp, easeOut, ridx } from 'glov/common/util';
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
  v2sub,
} from 'glov/common/vmath';
import { actionDown } from './binds';
import { blend } from './blend';
import { game_height, game_width, startUnlocking } from './main';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { asin, atan2, ceil, cos, floor, max, min, round, PI, pow, sin, sqrt } = Math;

// Room size: ~8x6
// hallway width: 2
const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

type Chest = {
  pos: JSVec2;
  type: 'simple' | 'locked';
  value: number;
  opened: boolean;
};
type Cell = 'wall' | 'floor' | 'door' | 'unknown';
class Level {
  w=40;
  h=50;
  cells: Cell[][] = [];
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
  chests: Chest[] = [];
}
let level: Level;
function genLevel(): void {
  let rand = randCreate(123456);
  level = new Level();
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
  door(0, hpath);
  allow_edge = false;
  let vpath = floor(w * 0.4) + rand.range(floor(w * 0.3));
  carve(vpath, 1, 2, h - 2);

  function roundRandom(v: number): number {
    if (rand.range(2)) {
      return ceil(v);
    } else {
      return floor(v);
    }
  }

  let room_min_w = 3;
  let room_min_h = 3;
  let room_min_area = 9 + rand.range(21);
  let room_max_area = 10*8;
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
  let desired_chests = 10;
  function addChest(roomid: number): void {
    let room = rooms[roomid];
    did_chests[roomid] = true;
    --desired_chests;
    while (true) {
      let x = room[0] + rand.range(room[2]);
      let y = room[1] + rand.range(room[3]);
      if (!countDoors([x, y, 1, 1])) {
        const type = rand.range(2) ? 'simple' : 'locked';
        let value = type === 'simple' ? 100 : 200;
        chests.push({
          pos: [x, y],
          type,
          value,
          opened: false,
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

  if (1) { // debug
    chests.push({
      pos: [level.entrance[0] + 3, level.entrance[1]],
      type: 'locked',
      value: 200,
      opened: false,
    });
  }
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
}

let heist_state: HeistState;

export function stateHeistInit(): void {
  genLevel();
  console.log(level.debug());
  heist_state = new HeistState();
  heist_state.pos = [
    level.entrance[0] + 0.5,
    level.entrance[1] + 0.5,
  ];
}
function doMotion(dt: number): void {
  let { pos, unlocking } = heist_state;
  if (unlocking !== -1) {
    return;
  }
  let { cells, chests } = level;
  let impulse: JSVec2 = [0, 0];
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
  for (let ii = 0; ii < chests.length; ++ii) {
    let chest = chests[ii];
    if (!chest.opened && v2distSq(chest.pos, [pos[0] - 0.5, pos[1] - 0.5]) < 0.9*0.9) {
      if (chest.type === 'locked') {
        heist_state.unlocking = ii;
        heist_state.floaters.push({
          t: 0,
          pos: chest.pos,
          msg: '[c=1]LOCKED!',
        });
      } else {
        chest.opened = true;
        heist_state.loot += chest.value;
        heist_state.floaters.push({
          t: 0,
          pos: chest.pos,
          msg: `[c=2]+$[c=3]${chest.value}`,
        });
      }
    }
  }
}

function drawHeistHUD(): void {
  let x = 0;
  let y = 0;
  let h = 11;
  let w = 83;
  let z = Z.UI;
  drawBox({
    x, y, h, w,
    z: z - 1,
  }, autoAtlas('gfx', 'box'));

  let loot = heist_state.loot;
  let eff_bonus = blend('loot', loot);
  markdownAuto({
    x: x + 2, y: y + 2, z: z + 1, w, h,
    text: `[c=2]GOLD: [c=3]$${round(eff_bonus)}[/c][/c]`,
  });
}

export function finishUnlocking(success: boolean, bonus: number): void {
  let chest = level.chests[heist_state.unlocking];
  chest.opened = true;
  if (success) {
    heist_state.loot += chest.value + bonus;
    heist_state.floaters.push({
      t: 0,
      pos: chest.pos,
      msg: `[c=2]+$[c=3]${chest.value + bonus}`,
    });
  } else {
    heist_state.floaters.push({
      t: 0,
      pos: chest.pos,
      msg: '[c=1]FAILED!',
    });
  }
  heist_state.unlocking = -1;
}

const TILESIZE = 14;
export function stateHeist(dt: number):void {
  // center camera on hero
  camera2d.setAspectFixed(game_width, game_height);
  let { pos, floaters } = heist_state;

  doMotion(dt);

  let hx = round(pos[0] * TILESIZE);
  let hy = round(pos[1] * TILESIZE);
  camera2d.shift(
    clamp(-game_width / 2 + hx, 0, level.w * TILESIZE - game_width),
    clamp(-game_height / 2 + hy, 0, level.h * TILESIZE - game_height));

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
  let { cells, chests, h } = level;
  for (let yy = y0; yy <= y1; ++yy) {
    for (let xx = x0; xx <= x1; ++xx) {
      let cellabove = yy && cells[yy - 1][xx] || 'floor';
      let cellleft = cells[yy][xx - 1] || 'floor';
      let cell = cells[yy][xx];
      let cellright = cells[yy][xx + 1] || 'floor';
      let cellbelow = yy < h - 1 && cells[yy + 1][xx] || 'floor';
      let spr;
      let z;
      if (cell === 'wall') {
        if (cellabove === 'floor' && cellbelow === 'floor') {
          spr = 'wall-h';
        } else if (cellleft === 'floor' && cellright === 'floor') {
          spr = 'wall-v';
        } else {
          spr = 'wall-corner';
        }
        z = Z.WALLS;
      } else if (cell === 'door') {
        if (cellleft === 'floor' && cellright === 'floor') {
          spr = 'door-v';
        } else {
          spr = 'door-h';
        }
        z = Z.DOORS;
      } else {
        spr = 'floor-1';
        z = Z.BACKGROUND;
      }
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
    autoAtlas('gfx', chest.opened ? 'chest-opened' : 'chest').draw({
      x: chest.pos[0] * TILESIZE,
      y: chest.pos[1] * TILESIZE,
      w: TILESIZE,
      h: TILESIZE,
      z: Z.CHESTS,
    });
  }

  for (let ii = floaters.length - 1; ii >= 0; --ii) {
    let floater = floaters[ii];
    floater.t += dt;
    let t = floater.t / 1000;
    if (t >= 1) {
      floaters.splice(ii, 1);
      if (heist_state.unlocking !== -1) {
        // start unlocking game
        startUnlocking();
      }
      continue;
    }
    let xx = (floater.pos[0] + 0.5) * TILESIZE;
    let text_height = uiTextHeight();
    let yy = floater.pos[1] * TILESIZE - round(easeOut(t, 2) * TILESIZE) - text_height;
    let w = uiGetFont().getStringWidth(null, text_height, floater.msg.replace(/\[c=\d\]/g, '')) + 4;
    xx -= floor(w/2);
    markdownAuto({
      x: xx,
      y: yy,
      w,
      z: Z.FLOATERS,
      align: ALIGN.HCENTER,
      text: floater.msg,
    });
    drawBox({
      x: xx,
      y: yy - 3,
      w: w,
      h: text_height + 5,
      z: Z.FLOATERS - 1,
    }, autoAtlas('gfx', 'box'));
  }

  // camera back to normal for HUD
  camera2d.setAspectFixed(game_width, game_height);
  drawHeistHUD();
}
