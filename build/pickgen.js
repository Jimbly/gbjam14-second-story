const fs = require('fs');
const { pngRead, pngWrite } = require('./pngnative');
const { floor, random } = Math;

function randInt(mx) {
  return floor(random() * mx);
}

// function shuffleArray(arr) {
//   for (let ii = arr.length - 1; ii >= 1; --ii) {
//     let swap = randInt(ii + 1);
//     let t = arr[ii];
//     arr[ii] = arr[swap];
//     arr[swap] = t;
//   }
// }

// let ends = [];
// for (let ii = 0; ii < 4; ++ii) {
//   for (let jj = 0; jj < 4; ++jj) {
//     ends.push((ii + 1) * 10 + jj + 1);
//   }
// }
// shuffleArray(ends);
// console.log(ends);
let ends = [
  23, 31, 14, 44, 41, 12, 42, 43,
  34, 24, 33, 32, 13, 21, 11, 22
];

console.log('Pairs:');
for (let ii = 0; ii < 8; ++ii) {
  console.log(`  ${ends[ii]}: ${ends[ii+8]}`);
}

let pats = [
  null,
  [0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,0,0],
  [1,1,1,1,1,1,1,1],
  [1,1,0,0,0,0,1,1],
];
let color = [
  [0x34, 0x68, 0x56, 0xff],
  [0x88, 0xc0, 0x70, 0xff],
  [0xe0, 0xf8, 0xd0, 0xff],
];

for (let ii = 0; ii < 8; ++ii) {
  let dec_top = [];
  let nm = randInt(2) + 1;
  for (let jj = 0; jj < nm; ++jj) {
    let v = randInt(14);
    dec_top.push(v);
    if (randInt(2)) {
      dec_top.push(v + 1);
    }
  }
  let dec_bot = [];
  nm = randInt(2) + 1;
  for (let jj = 0; jj < nm; ++jj) {
    let v = randInt(14);
    dec_bot.push(v);
    if (randInt(2)) {
      dec_bot.push(v + 1);
    }
  }
  for (let reverse = 0; reverse < 2; reverse++) {
    let { img } = pngRead(fs.readFileSync(`${__dirname}/pick-template.png`));
    let { data, width, height } = img;
    function set(x, y, c) {
      for (let jj = 0; jj < 4; ++jj) {
        data[(y * width + x) * 4 + jj] = c[jj];
      }
    }
    let picktop = ends[ii];
    let pickbot = ends[ii + 8];
    if (reverse) {
      picktop = pickbot;
      pickbot = ends[ii];
      let t = dec_top;
      dec_top = dec_bot;
      dec_bot = t;
    }
    let pickb = picktop % 10;
    let picka = (picktop - pickb) / 10;
    let pickd = pickbot % 10;
    let pickc = (pickbot - pickd) / 10;

    let laston = false;
    let pat = pats[pickb].concat(pats[picka]);
    for (let jj = 0; jj < pat.length; ++jj) {
      let on = pat[jj];
      let nexton = pat[jj + 1];

      if (on) {
        let c = color[1];
        if (!laston) {
          c = color[2];
        } else if (!nexton) {
          c = color[0];
        }
        for (let kk = 0; kk < 6; ++kk) {
          set(4 + kk, jj, c);
        }
        set(9, jj, color[2]);
      } else {
        set(3, jj, color[0]);
      }
      laston = on;
    }
    for (let jj = 0; jj < dec_top.length; ++jj) {
      set(1, 7 + dec_top[jj], color[2]);
    }

    laston = false;
    pat = pats[pickc].concat(pats[pickd]);
    let y = height - pat.length;
    for (let jj = 0; jj < pat.length; ++jj) {
      let on = pat[jj];
      let nexton = pat[jj + 1];

      if (on) {
        let c = color[1];
        if (!laston) {
          c = color[2];
        } else if (!nexton) {
          c = color[0];
        }
        for (let kk = 0; kk < 6; ++kk) {
          set(kk, y + jj, c);
        }
        set(0, y + jj, color[2]);
      } else {
        if (!nexton && !pat[jj + 2]) {
          set(6, y + jj, color[0]);
        }
      }
      laston = on;
    }
    for (let jj = 0; jj < dec_bot.length; ++jj) {
      set(8, 52 - dec_bot[jj], color[2]);
    }

    fs.writeFileSync(`${__dirname}/../src/client/atlases/gfx/pick${picktop}.png`, pngWrite(img));
  }
}
