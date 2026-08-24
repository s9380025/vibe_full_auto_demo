```
PRD Compliance: PASS
Functional Test: PASS
Design Validation: PASS
Regression Test: PASS
Overall Result: PASS
```

# QA-001 Independent Verification Report

Scope: `main` branch after merge of `feature/dev-001` (commit `8594122`) and
`feature/design-001` (commit `935175e`). Verified independently against
`docs/PRD.md`. No prior agent report was trusted; every claim below was
re-derived from the actual `index.html`, `style.css`, `game.js` on `main`,
from git history, from an automated test suite written for this task
(`tests/game.logic.test.js`), and from a live run in a real browser.

No product source file (`index.html`, `style.css`, `game.js`) was modified.
Only `tests/game.logic.test.js` and this report were added.

---

## 1. Regression Test — PASS

`git log --oneline --all --graph` on `main`:

```
*   935175e Merge feature/design-001: improve tetris game UI
|\
| * fe08db8 style: improve tetris game UI
|/
*   8594122 Merge feature/dev-001: implement tetris core game logic
|\
| * b9b7f29 feat: implement tetris core game logic
|/
* b96aa45 docs: initialize agentic tetris project
```

`git diff 8594122 935175e -- game.js` → **empty output**. `game.js` is
byte-for-byte identical between the post-DEV-001 merge commit and the current
`main` HEAD. `git diff --stat 8594122 935175e` confirms the Design Agent's
commit touched only `index.html` (+10/-… lines, structural wrapper only) and
`style.css` (+176/-41 lines). Game logic was not touched by the Design Agent.
**Regression Test: PASS** — this was directly verified via `git diff`, not
inferred.

## 2. Functional Test — PASS

### Automated test suite (`tests/game.logic.test.js`)

Since `game.js` has no exported/testable internals and no npm dependencies
are installed in this environment (no `jsdom`, no network access assumed), I
wrote a minimal, purpose-built DOM stub (`FakeElement`/fake `document`) that
implements exactly the DOM surface `game.js` uses
(`getElementById`, `createElement`, `classList`, `textContent`,
`addEventListener`, `setInterval`/`clearInterval`), loaded the **real,
unmodified `game.js`** into it via Node's `vm` module, and drove it with
synthetic `keydown`/`click` events identical in shape to what a browser
dispatches (`{ key: 'ArrowLeft', preventDefault(){} }`, etc.) — game.js's own
event listeners were exercised, not reimplemented. `Math.random` was
monkey-patched with a controllable queue so exact tetromino sequences could
be forced (e.g. "spawn five O-pieces in a row" to build a guaranteed
double-line clear), then behavior was asserted purely by reading back the
rendered DOM state (cell class names, text content) — never by reaching into
game.js's closures.

Run with `node tests/game.logic.test.js`. Result: **37/37 assertions passed**
(verified now, not from memory — see console output below).

```
TOTAL: 37  PASS: 37  FAIL: 0
```

Covered scenarios:
- Board is exactly 10x20 (200 cells); NEXT box is 4x4.
- START resets state and begins the game (overlay hides).
- The RNG value consumed for the *current* piece is exactly what renders on
  the board at spawn, and the *following* RNG value is exactly what NEXT
  displays — then after a lock, the piece that actually spawns is exactly
  the one NEXT previously showed. **No NEXT/current desync found.**
- Left/right wall collision: piece cannot move past column 0 or column 9.
- Rotation wall-kick: I-piece flush against the left wall rotates via the
  kick table (`[0,-1,1,-2,2]`) without crashing or producing a malformed
  shape (verified exactly 4 cells remain, all one color, all one column).
- Soft drop: +1 score per cell, piece moves down by 1.
- Hard drop: piece locks instantly, score increases.
- **Multi-line clear**: filled rows 18 and 19 completely (5 O-pieces across
  all 10 columns) in one lock → both lines clear simultaneously, `lines`
  counter goes from 0 to 2, `score` reflects the 2-line table value (100 at
  level 1) plus drop bonuses, and everything below the freshly-spawned next
  piece is empty (proving the rows were actually removed, not just visually
  covered).
- **Level-up boundary**: 5 consecutive double-clears (10 lines total) flips
  `level` from 1 to exactly 2 at the 10-line boundary — no off-by-one.
- **Drop-speed increase**: on that level-up, the registered `setInterval`
  delay dropped from 1000ms to 925ms, matching
  `max(100, 1000 - (level-1)*75)`.
- **Game over detection**: stacking O-pieces straight down a single column
  (no line ever completed) triggers GAME OVER exactly when the 11th piece's
  spawn position collides with the top of the 10-piece-tall stack — not one
  piece early or late. Overlay shows "GAME OVER", START hidden, RESTART
  shown.
- Input is fully ignored after game over (board unchanged across further
  keydowns).
- **RESTART**: board fully wiped (verified rows below the freshly spawned
  piece are empty, i.e. the old stack was actually cleared, not just
  covered), score/level/lines reset to 0/1/0, overlay hidden, input
  re-enabled.
- All 7 tetromino types (I, O, T, S, Z, J, L) spawn and render with their
  own distinct `color-X` CSS class.

One bug was found and fixed **in the test itself** during development (an
incorrect assumption that the board would be fully empty immediately after a
line clear — it isn't, because `lockPiece()` immediately spawns and draws the
next piece before returning). This was a test-authoring mistake, not a
game.js defect; it was corrected before the suite was finalized, and the
corrected assertion (bottom rows specifically, not the whole board) still
passes.

### Live browser walkthrough (real Chromium instance, `localhost` static
server, no source files touched)

- Loaded `index.html` fresh: START overlay, centered board, side panel all
  render correctly with no console errors.
- Clicked START (mouse): game begins, piece renders and auto-drops over
  real wall-clock time without any input — confirms **auto drop** works
  live, not just in the simulated harness.
- Left the game running: it naturally stacked pieces in a single column
  (no horizontal input) until the board filled to the top and **GAME OVER**
  triggered live, displaying the pink "GAME OVER" overlay text and a
  RESTART button, exactly matching the code path exercised in the automated
  suite.
- Clicked RESTART (mouse): board instantly cleared, SCORE/LEVEL/LINES reset
  to 0/1/0, a new piece spawned — confirms restart end-to-end in a real
  browser.

**Limitation — disclosed, not glossed over**: this sandbox's browser
automation tool dispatches synthetic keyboard events whose
`KeyboardEvent.key` property comes through as an **empty string** (verified
by attaching a raw `keydown` listener and logging `e.key`, for both the
`key` action and the `type` action). Since `game.js`'s input handler
switches on `e.key` (`'ArrowLeft'`, `'ArrowRight'`, `'ArrowDown'`,
`'ArrowUp'`, `' '`), none of my simulated arrow-key/space presses in the live
browser were actually recognized by the game — this is a tooling artifact of
the automation environment, not a defect in `game.js` (a real physical
keyboard populates `e.key` correctly per spec, and the Node harness above
proves the handler logic itself is correct when given a well-formed event
object identical in shape to a real one). Consequently, **keyboard-driven
functional behavior (move/rotate/soft-drop/hard-drop) was validated
authoritatively via the Node test harness, not via live keyboard input** —
this is flagged explicitly rather than silently claiming a live PASS I did
not actually observe. Mouse-driven interactions (START/RESTART clicks) and
passive behaviors (auto-drop, game-over detection, rendering) were
confirmed live.

**Functional Test: PASS**, based on: automated logic verification (37/37,
authoritative for all input-driven mechanics) + live browser confirmation of
load/render/auto-drop/game-over/restart + full manual code trace of every
PRD functional item below.

### Item-by-item trace against PRD §핵심 기능

| # | Requirement | Verified via | Result |
|---|---|---|---|
| 1 | START button starts game | Live click + automated Test 1 | PASS |
| 2 | 10x20 board | Automated Test 1 (200 cells) + code (`COLS=10,ROWS=20`) | PASS |
| 3 | 7 tetrominoes I/O/T/S/Z/J/L | Automated Test 9 (all 7 spawn with distinct colors) | PASS |
| 4 | Auto drop | Live browser (piece fell with zero input) + `tick()`/`setInterval` trace | PASS |
| 5 | Left/right move | Automated Test 2 (wall-bounded) | PASS |
| 6 | Soft drop | Automated Test 4 | PASS |
| 7 | Rotation | Automated Test 3 (with wall-kick) | PASS |
| 8 | Hard drop (Space) | Automated Test 4/5/6/7 | PASS |
| 9 | Wall + locked-block collision | Automated Test 2 + `collides()` trace (checked boundary logic line-by-line) | PASS |
| 10 | Line clear | Automated Test 5 (double clear) + manual proof the splice/unshift algorithm is correct for non-adjacent multi-row clears (see below) | PASS |
| 11 | Score increases on line clear | Automated Test 5/6 | PASS |
| 12 | Level increases every N lines | Automated Test 6 (exact 10-line boundary) | PASS |
| 13 | Drop speed increases with level | Automated Test 6 (`setInterval` delay 1000→925ms) | PASS |
| 14 | Next piece displayed | Automated Test 1 (NEXT/current never desync) + live screenshots | PASS |
| 15 | Game over detection | Automated Test 7 + live browser | PASS |
| 16 | Restart | Automated Test 7/8 + live browser | PASS |

**Non-adjacent multi-line clear correctness (static proof)**: `clearLines()`
collects full-row indices in ascending order, then for each index `r` does
`board.splice(r,1); board.unshift(emptyRow)`. Working through the index
algebra: for any row index `i` strictly greater than the just-processed `r`,
its position in the array is unchanged after the splice+unshift pair (the
splice shifts it up by 1, the unshift shifts it back down by 1 — net zero),
while every row above `r` shifts down by exactly 1 (correct gravity). Because
`clearedRows` is processed in ascending order, every subsequent index in the
list still refers to the correct original row when it's processed. This was
verified analytically and empirically confirmed for the adjacent 2-row case
in Test 5; the non-adjacent case was not separately live-tested (constructing
a precise non-adjacent multi-row-full scenario with real tetromino shapes is
significantly more involved to script) — **this one sub-case rests on static
analysis rather than an executed test**, and is called out here rather than
silently folded into the PASS.

## 3. Design Validation — PASS

Verified live in a real browser (screenshots taken, not just code review):

- **Board centered / separated from info panel**: `#main-area` is a flex row
  (`display:flex; gap:22px`) with `#board-wrapper` and `#side-panel` as
  siblings; live screenshot confirms clear visual separation (distinct
  panel background, border, drop shadow) and the whole `#game-container` is
  centered on the page (`body { display:flex; justify-content:center;
  align-items:center }`).
- **SCORE / LEVEL / LINES displayed**: present as three labeled
  `.panel-box.stat-box` elements, each with its own colored accent border
  (cyan/pink/yellow), confirmed live and updating (score/level/lines all
  changed correctly during the automated-and-live runs).
- **NEXT piece displayed**: dedicated 4x4 grid box, confirmed live to always
  show the correct upcoming piece shape and color, and to never desync from
  what actually spawns (automated Test 1).
- **Tetromino types visually distinct**: 7 distinct CSS custom-property
  colors (`--color-I` cyan, `-O` yellow, `-T` purple, `-S` green, `-Z` red,
  `-J` blue, `-L` orange) mapped 1:1 via `color-X` classes; confirmed live —
  screenshots show clearly distinguishable purple/orange/teal/blue/red
  pieces stacked together.
- **START / GAME OVER states clear**: both render as a full-board overlay
  with large glowing text (cyan "TETRIS"/START button on launch, pink "GAME
  OVER"/RESTART button on loss) — confirmed live for both states, including
  the natural GAME OVER trigger during the browser walkthrough.
- **Overall visual consistency**: consistent dark arcade theme (neon
  cyan/pink/yellow accents, monospace pixel fonts, grid-lined board), no
  layout breakage observed; a responsive `@media (max-width:520px)` rule
  reflows the side panel to a horizontal row for narrow viewports (reviewed
  in code, not live-tested at that breakpoint — noted as a static-only
  check).

**Observation (not a fail)**: `index.html` loads two Google Fonts
(`Press Start 2P`, `VT323`) from `fonts.googleapis.com`, an external network
dependency not mentioned in the PRD's "외부 Library 사용 안 함" tech
constraint (fonts are arguably not a "library" in the same sense as a JS/CSS
framework, but it is still a network call). Per the QA task instructions this
is not treated as a hard fail since `style.css` correctly declares fallback
fonts (`'Courier New', monospace` / `'Courier New', Courier, monospace`) for
both, so the game remains fully playable and legible offline — verified by
reading the font-family declarations in `style.css`. Flagged here for the
Main Agent's awareness only.

**Design Validation: PASS**.

## 4. PRD Compliance — PASS

- All 16 functional requirements and all 7 design requirements in
  `docs/PRD.md` are implemented and verified (see tables above).
- No scope violations found: no backend, no external JS/CSS framework, no
  build step (`index.html` loads `style.css`/`game.js` directly as static
  files), Vanilla JS only for logic.
- No PRD-absent features were found bolted on. The only behavior beyond the
  literal PRD wording is that soft-drop/hard-drop award small bonus points
  (`+1`/`+dropped*2`) in addition to line-clear score — this is a minor,
  conventional scoring detail still squarely inside "점수(Score)" as a
  system, not a new feature, and does not conflict with any PRD constraint;
  noted here rather than silently passed over.
- `docs/PROJECT_RULES.md` constraints relevant to QA were followed: no
  product source modified, no force-push, no destructive `main` operations,
  failures (the one found in my own draft test) were fixed and disclosed
  rather than hidden or silently marked PASS.

## What was live/dynamically tested vs. statically reviewed

**Dynamically tested (executed, not assumed):**
- Full automated suite (`tests/game.logic.test.js`, 37 assertions) driving
  the actual unmodified `game.js` through a DOM stub — covers all move/
  rotate/drop/collision/line-clear/score/level/speed/next-piece/game-over/
  restart mechanics with deterministic, controlled RNG.
- Live browser: initial load/render, START via mouse click, passive
  auto-drop over real time, natural GAME OVER trigger, RESTART via mouse
  click, screenshots of all major visual states (idle/START, in-play,
  GAME OVER, post-restart).
- `git diff` between the pre-Design and current `main` commit for `game.js`
  (empty diff = proof, not inference).

**Statically reviewed only (with limitation disclosed):**
- Keyboard-driven live interaction (arrow keys / space in the actual
  browser) — the automation tool's synthetic key events don't populate
  `KeyboardEvent.key`, so this path was validated via the Node harness
  instead, not via a real physical keyboard in this session.
- The non-adjacent (as opposed to adjacent) multi-row line-clear index
  arithmetic — proven analytically, not exercised by a live scenario.
- The `@media (max-width:520px)` responsive layout — reviewed in
  `style.css`, not rendered at that viewport width in this session.
- Cross-browser behavior — only one Chromium-based engine was available in
  this environment.

## Files added by this QA pass

- `tests/game.logic.test.js` — automated regression/functional suite
  (`node tests/game.logic.test.js` to run, no dependencies required).
- `reports/QA-001-REPORT.md` — this report.

No changes were made to `index.html`, `style.css`, or `game.js`.
