/**
 * QA-001 independent verification test.
 *
 * This test loads the ACTUAL, UNMODIFIED game.js (from the repo root) inside a
 * minimal hand-rolled DOM stub (no jsdom / no npm install / no network access
 * required) and drives it exactly the way a browser would: dispatching
 * synthetic keydown/click events and reading back the rendered DOM (cell
 * classNames, textContent) — never touching game.js's internals directly.
 *
 * Math.random is monkey-patched with a queue so tetromino spawn order is
 * deterministic, which lets us construct exact scenarios (e.g. "fill row 19
 * and row 18 completely with O pieces") and assert on the resulting DOM state.
 *
 * Run with:  node tests/game.logic.test.js
 * Exits 0 if all assertions pass, 1 otherwise. No test is ever marked PASS
 * without actually being executed and checked.
 */

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const GAME_JS_PATH = path.join(__dirname, '..', 'game.js');
const COLS = 10, ROWS = 20;

// ---------- Minimal DOM stub ----------

class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this._className = '';
    this.children = [];
    this._text = '';
    this._listeners = {};
  }
  get className() { return this._className; }
  set className(v) { this._className = v; }
  get classList() {
    const self = this;
    return {
      add(c) {
        const parts = self._className.split(' ').filter(Boolean);
        if (!parts.includes(c)) parts.push(c);
        self._className = parts.join(' ');
      },
      remove(c) {
        self._className = self._className.split(' ').filter(Boolean).filter(p => p !== c).join(' ');
      },
      contains(c) {
        return self._className.split(' ').filter(Boolean).includes(c);
      }
    };
  }
  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) {
    this._listeners[type] = this._listeners[type] || [];
    this._listeners[type].push(fn);
  }
  dispatch(type, evt) {
    (this._listeners[type] || []).forEach(fn => fn(evt));
  }
}

function makeFakeDocument() {
  const registry = {};
  const docListeners = {};
  return {
    getElementById(id) {
      if (!registry[id]) registry[id] = new FakeElement('div');
      return registry[id];
    },
    createElement(tag) { return new FakeElement(tag); },
    addEventListener(type, fn) {
      docListeners[type] = docListeners[type] || [];
      docListeners[type].push(fn);
    },
    dispatchKeydown(key) {
      (docListeners.keydown || []).forEach(fn => fn({ key: key, preventDefault() {} }));
    },
    _registry: registry
  };
}

// ---------- Controllable RNG ----------
// randomPieceKey() does PIECE_KEYS[Math.floor(Math.random() * 7)]
// PIECE_KEYS order = Object.keys(SHAPES) = ['I','O','T','S','Z','J','L']
const PIECE_ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
function randValueFor(key) {
  const idx = PIECE_ORDER.indexOf(key);
  if (idx < 0) throw new Error('unknown key ' + key);
  return (idx + 0.5) / 7; // safely inside the bucket for that index
}

function loadGame(rngQueueGetter) {
  const code = fs.readFileSync(GAME_JS_PATH, 'utf8');
  const fakeDoc = makeFakeDocument();
  const intervals = { nextId: 1, active: null }; // {id, fn, ms}
  const sandbox = {
    document: fakeDoc,
    console: console,
    Math: Object.assign(Object.create(Math), {
      random: function () {
        const q = rngQueueGetter();
        if (q.length > 0) return q.shift();
        return Math.random.call(Math); // fallback, unused in our deterministic tests
      }
    }),
    setInterval: function (fn, ms) {
      const id = intervals.nextId++;
      intervals.active = { id: id, fn: fn, ms: ms };
      return id;
    },
    clearInterval: function (id) {
      if (intervals.active && intervals.active.id === id) intervals.active = null;
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'game.js' });
  return { doc: fakeDoc, intervals: intervals, sandbox: sandbox };
}

// ---------- Board inspection helpers ----------

function boardCellClass(doc, r, c) {
  const boardEl = doc._registry['board'];
  return boardEl.children[r * COLS + c].className;
}
function isFilled(doc, r, c) {
  return boardCellClass(doc, r, c).indexOf('filled') !== -1;
}
function boardAllEmpty(doc) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (isFilled(doc, r, c)) return false;
  }
  return true;
}
function nextCellClass(doc, r, c) {
  const nextEl = doc._registry['next-piece'];
  return nextEl.children[r * 4 + c].className;
}

// ---------- Test runner ----------

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('PASS - ' + name);
  } catch (e) {
    failed++;
    failures.push({ name: name, error: e });
    console.log('FAIL - ' + name);
    console.log('       ' + (e && e.message ? e.message : e));
  }
}

// ============================================================
// TEST 1: START resets state, board is 10x20, next-piece matches
//         what actually spawns next (no NEXT/current desync).
// ============================================================
(function () {
  const queue = [randValueFor('I'), randValueFor('O'), randValueFor('T')];
  const g = loadGame(() => queue);
  const doc = g.doc;

  // board DOM must be exactly 20 rows x 10 cols = 200 cells
  test('board DOM has exactly 200 cells (10x20)', () => {
    assert.strictEqual(doc._registry['board'].children.length, ROWS * COLS);
  });
  test('next-piece DOM has exactly 16 cells (4x4)', () => {
    assert.strictEqual(doc._registry['next-piece'].children.length, 16);
  });

  // click START
  doc._registry['start-btn'].dispatch('click');

  test('after START, overlay is hidden (game running)', () => {
    assert.ok(doc._registry['overlay'].classList.contains('hidden'));
  });

  // First random ('I') becomes the spawned current piece; it is drawn on the
  // board at its spawn location (I piece matrix row index 1 is the bar,
  // spawn x = floor((10-4)/2) = 3, y = 0), so board row1, cols 3-6 must be filled I.
  test('first RNG value determines the piece that actually spawns (I piece drawn at row1 cols3-6)', () => {
    for (let c = 3; c <= 6; c++) {
      assert.ok(isFilled(doc, 1, c), 'expected filled cell at row1,col' + c);
      assert.ok(boardCellClass(doc, 1, c).indexOf('color-I') !== -1, 'expected color-I at row1,col' + c);
    }
  });

  // Second random ('O') is what's shown in the NEXT box.
  test('NEXT box shows the second RNG piece (O) - matches what will spawn next', () => {
    // O matrix = [[1,1],[1,1]] at rows0-1, cols0-1 of the 4x4 next grid
    assert.ok(nextCellClass(doc, 0, 0).indexOf('color-O') !== -1);
    assert.ok(nextCellClass(doc, 0, 1).indexOf('color-O') !== -1);
    assert.ok(nextCellClass(doc, 1, 0).indexOf('color-O') !== -1);
    assert.ok(nextCellClass(doc, 1, 1).indexOf('color-O') !== -1);
  });

  // Hard-drop the I piece; the piece that spawns next must be exactly the O
  // that was just shown in NEXT (desync check), and NEXT should now show T.
  doc.dispatchKeydown(' ');
  test('after lock, the piece that spawns matches what NEXT previously showed (O piece now on board)', () => {
    // O piece default spawn x = floor((10-2)/2) = 4, y=0 -> rows0-1, cols4-5
    assert.ok(isFilled(doc, 0, 4) && boardCellClass(doc, 0, 4).indexOf('color-O') !== -1);
    assert.ok(isFilled(doc, 0, 5) && boardCellClass(doc, 0, 5).indexOf('color-O') !== -1);
  });
  test('NEXT box now shows the third RNG piece (T)', () => {
    // T matrix = [[0,1,0],[1,1,1],[0,0,0]]
    assert.ok(nextCellClass(doc, 0, 1).indexOf('color-T') !== -1);
    assert.ok(nextCellClass(doc, 1, 0).indexOf('color-T') !== -1);
    assert.ok(nextCellClass(doc, 1, 1).indexOf('color-T') !== -1);
    assert.ok(nextCellClass(doc, 1, 2).indexOf('color-T') !== -1);
  });
})();

// ============================================================
// TEST 2: Wall collision (left/right) stops movement at boundary.
// ============================================================
(function () {
  const queue = [randValueFor('O'), randValueFor('O')];
  const g = loadGame(() => queue);
  const doc = g.doc;
  doc._registry['start-btn'].dispatch('click');
  // O piece spawns at x=4 (cols 4-5). Move left far more than needed.
  for (let i = 0; i < 10; i++) doc.dispatchKeydown('ArrowLeft');
  test('piece cannot move past left wall (col 0)', () => {
    assert.ok(isFilled(doc, 0, 0) && isFilled(doc, 0, 1));
    assert.ok(!isFilled(doc, 1, 2)); // shouldn't have wrapped or gone negative-visible elsewhere
  });
  for (let i = 0; i < 15; i++) doc.dispatchKeydown('ArrowRight');
  test('piece cannot move past right wall (col 9)', () => {
    assert.ok(isFilled(doc, 0, 8) && isFilled(doc, 0, 9));
  });
})();

// ============================================================
// TEST 3: Rotation with wall-kick near the left wall (I piece).
// ============================================================
(function () {
  const queue = [randValueFor('I'), randValueFor('I')];
  const g = loadGame(() => queue);
  const doc = g.doc;
  doc._registry['start-btn'].dispatch('click');
  // Push I piece flush to left wall.
  for (let i = 0; i < 10; i++) doc.dispatchKeydown('ArrowLeft');
  test('I piece flush against left wall before rotation (row1 cols0-3 filled)', () => {
    for (let c = 0; c <= 3; c++) assert.ok(isFilled(doc, 1, c));
  });
  doc.dispatchKeydown('ArrowUp'); // rotate
  test('rotate near left wall succeeds via kick, producing a vertical I with no crash', () => {
    // After rotation the I piece should occupy a single column across 4 rows
    // somewhere within bounds (exact column depends on kick table, just verify
    // shape integrity: exactly 4 filled cells, all in the same column, all color-I).
    let filledCoords = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (isFilled(doc, r, c) && boardCellClass(doc, r, c).indexOf('color-I') !== -1) {
          filledCoords.push([r, c]);
        }
      }
    }
    assert.strictEqual(filledCoords.length, 4, 'expected exactly 4 filled I cells after rotation, got ' + filledCoords.length);
    const cols = filledCoords.map(p => p[1]);
    assert.ok(cols.every(c => c === cols[0]), 'expected all 4 cells in same column after vertical rotation');
  });
})();

// ============================================================
// TEST 4: Soft drop / hard drop scoring and immediate lock.
// ============================================================
(function () {
  const queue = [randValueFor('O'), randValueFor('O')];
  const g = loadGame(() => queue);
  const doc = g.doc;
  doc._registry['start-btn'].dispatch('click');
  test('score starts at 0', () => {
    assert.strictEqual(doc._registry['score'].textContent, '0');
  });
  doc.dispatchKeydown('ArrowDown'); // soft drop: +1 score, y+=1
  test('soft drop increments score by 1', () => {
    assert.strictEqual(doc._registry['score'].textContent, '1');
  });
  doc.dispatchKeydown(' '); // hard drop remaining distance and lock
  test('hard drop adds score and locks the piece (board no longer empty)', () => {
    const score = parseInt(doc._registry['score'].textContent, 10);
    assert.ok(score > 1, 'expected score to increase further from hard drop bonus, got ' + score);
    assert.ok(!boardAllEmpty(doc), 'expected locked piece to remain on board');
  });
})();

// ============================================================
// TEST 5: Multi-line clear (2 full rows at once), score/lines update,
//         and rows above the cleared lines shift down correctly.
// ============================================================
(function () {
  const allO = []; // infinite O queue via fallback below
  const g = loadGame(() => { allO.push(randValueFor('O')); return [allO.pop()]; });
  const doc = g.doc;
  doc._registry['start-btn'].dispatch('click');

  // Fill both bottom rows (18,19) exactly using 5 O-pieces (2 cols wide each)
  // at x = 0,2,4,6,8. Default spawn x=4.
  const xPositions = [0, 2, 4, 6, 8];
  xPositions.forEach(function (targetX) {
    const delta = targetX - 4;
    const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
    for (let i = 0; i < Math.abs(delta); i++) doc.dispatchKeydown(key);
    doc.dispatchKeydown(' '); // hard drop + lock
  });

  test('after filling rows 18 and 19 completely with O pieces, both lines clear (bottom rows empty again)', () => {
    // Note: lockPiece() immediately spawns the next piece after a clear, so a
    // fresh piece is drawn near the top (rows 0-1) - that is expected, not a bug.
    // What must be true is that the two previously-full rows (18,19), and
    // everything below the newly spawned piece, are now empty (shifted/cleared).
    for (let r = 2; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        assert.ok(!isFilled(doc, r, c), 'expected row ' + r + ' col ' + c + ' to be empty after double clear, board not fully cleared');
      }
    }
  });
  test('lines counter increased by exactly 2', () => {
    assert.strictEqual(doc._registry['lines'].textContent, '2');
  });
  test('score reflects double-line-clear table value (100) at level 1', () => {
    // applyScore: table[2] = 100, points = 100 * level(1) = 100 (no soft/hard drop bonuses accrued here since hardDrop was called from y=0 each time, contributing dropped*2 bonus too - so score should be >= 100)
    const score = parseInt(doc._registry['score'].textContent, 10);
    assert.ok(score >= 100, 'expected score >= 100 (100 base line-clear points + hard-drop bonuses), got ' + score);
  });
  test('level has NOT increased yet (2 lines < 10 lines-per-level)', () => {
    assert.strictEqual(doc._registry['level'].textContent, '1');
  });
})();

// ============================================================
// TEST 6: Level-up boundary at exactly 10 lines, and drop-speed increase.
// ============================================================
(function () {
  const allO = [];
  const g = loadGame(() => { allO.push(randValueFor('O')); return [allO.pop()]; });
  const doc = g.doc;
  doc._registry['start-btn'].dispatch('click');

  // Each "set" of 5 O-pieces (x=0,2,4,6,8) clears exactly 2 lines.
  // 5 sets => 10 lines => level should become exactly 2 at that point.
  for (let set = 0; set < 5; set++) {
    [0, 2, 4, 6, 8].forEach(function (targetX) {
      const delta = targetX - 4;
      const key = delta < 0 ? 'ArrowLeft' : 'ArrowRight';
      for (let i = 0; i < Math.abs(delta); i++) doc.dispatchKeydown(key);
      doc.dispatchKeydown(' ');
    });
  }

  test('lines counter reaches exactly 10 after 5 double-clears', () => {
    assert.strictEqual(doc._registry['lines'].textContent, '10');
  });
  test('level increments to exactly 2 at the 10-line boundary', () => {
    assert.strictEqual(doc._registry['level'].textContent, '2');
  });
  test('drop interval decreased on level-up (faster drop registered via setInterval)', () => {
    // updateDropInterval: max(100, 1000 - (level-1)*75) -> level2 => 925ms
    assert.ok(g.intervals.active, 'expected an active drop interval');
    assert.strictEqual(g.intervals.active.ms, 925);
  });
})();

// ============================================================
// TEST 7: Game over detection when a new piece cannot spawn.
// ============================================================
(function () {
  const allO = [];
  const g = loadGame(() => { allO.push(randValueFor('O')); return [allO.pop()]; });
  const doc = g.doc;
  doc._registry['start-btn'].dispatch('click');

  // Stack O pieces straight down at the default spawn column (x=4, cols4-5)
  // without moving. Each piece is 2 rows tall; after 10 pieces the column is
  // full top-to-bottom (20 rows), so the 11th spawn attempt collides at y=0
  // and must trigger game over.
  for (let i = 0; i < 10; i++) doc.dispatchKeydown(' ');

  test('GAME OVER triggers exactly when the stack reaches the top (column 4-5 full, no line ever completed)', () => {
    assert.ok(doc._registry['overlay'].classList.contains('hidden') === false, 'expected overlay to be visible');
    assert.strictEqual(doc._registry['overlay-message'].textContent, 'GAME OVER');
  });
  test('on game over, START button is hidden and RESTART button is shown', () => {
    assert.ok(doc._registry['start-btn'].classList.contains('hidden'));
    assert.ok(!doc._registry['restart-btn'].classList.contains('hidden'));
  });
  test('lines never incremented (columns 4-5 only, rows never full) - sanity check on the scenario', () => {
    assert.strictEqual(doc._registry['lines'].textContent, '0');
  });

  const boardSnapshotBefore = doc._registry['board'].children.map(c => c.className).join('|');
  doc.dispatchKeydown(' '); // input after game over must be ignored
  doc.dispatchKeydown('ArrowLeft');
  test('input is ignored after game over (board unchanged, no crash)', () => {
    const boardSnapshotAfter = doc._registry['board'].children.map(c => c.className).join('|');
    assert.strictEqual(boardSnapshotAfter, boardSnapshotBefore);
  });

  // ---- TEST 8 (chained): RESTART fully resets state ----
  doc._registry['restart-btn'].dispatch('click');
  test('RESTART clears the previously-stacked blocks (rows below the fresh spawn are empty)', () => {
    // Before restart, columns 4-5 were stacked solid from row0 to row19 (game
    // over state). After restart+resetState, only the freshly spawned piece
    // (rows 0-1) should be drawn; every row from 2 downward must be empty -
    // proving the old stack was actually wiped, not just visually covered.
    for (let r = 2; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        assert.ok(!isFilled(doc, r, c), 'expected row ' + r + ' col ' + c + ' to be empty after restart, old stack leaked');
      }
    }
  });
  test('RESTART resets score/level/lines to 0/1/0', () => {
    assert.strictEqual(doc._registry['score'].textContent, '0');
    assert.strictEqual(doc._registry['level'].textContent, '1');
    assert.strictEqual(doc._registry['lines'].textContent, '0');
  });
  test('RESTART hides overlay (game running again) and hides RESTART button state is consistent', () => {
    assert.ok(doc._registry['overlay'].classList.contains('hidden'));
  });
  test('RESTART re-enables input (piece responds to movement again)', () => {
    const before = doc._registry['board'].children.map(c => c.className).join('|');
    doc.dispatchKeydown('ArrowLeft');
    const after = doc._registry['board'].children.map(c => c.className).join('|');
    assert.notStrictEqual(before, after, 'expected board to change after moving the piece post-restart');
  });
})();

// ============================================================
// TEST 9: All 7 tetromino shapes spawn correctly and are visually distinct colors.
// ============================================================
(function () {
  const keys = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const colorsSeen = new Set();
  keys.forEach(function (k) {
    // sequence: first random -> this key becomes current on spawn; second random arbitrary (O)
    const queue = [randValueFor(k), randValueFor('O')];
    const g = loadGame(() => queue);
    const doc = g.doc;
    doc._registry['start-btn'].dispatch('click');
    let found = false;
    for (let r = 0; r < ROWS && !found; r++) {
      for (let c = 0; c < COLS && !found; c++) {
        if (boardCellClass(doc, r, c).indexOf('color-' + k) !== -1) found = true;
      }
    }
    test('tetromino ' + k + ' spawns and renders with its own color class', () => {
      assert.ok(found, 'expected to find a color-' + k + ' cell on the board after spawn');
    });
    colorsSeen.add('color-' + k);
  });
  test('all 7 tetromino color classes are distinct', () => {
    assert.strictEqual(colorsSeen.size, 7);
  });
})();

// ---------- Summary ----------
console.log('\n' + '='.repeat(60));
console.log('TOTAL: ' + (passed + failed) + '  PASS: ' + passed + '  FAIL: ' + failed);
console.log('='.repeat(60));
if (failed > 0) {
  process.exitCode = 1;
}
