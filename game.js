(function () {
  'use strict';

  var COLS = 10;
  var ROWS = 20;
  var LINES_PER_LEVEL = 10;

  var SHAPES = {
    I: { matrix: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: 'I' },
    O: { matrix: [[1,1],[1,1]], color: 'O' },
    T: { matrix: [[0,1,0],[1,1,1],[0,0,0]], color: 'T' },
    S: { matrix: [[0,1,1],[1,1,0],[0,0,0]], color: 'S' },
    Z: { matrix: [[1,1,0],[0,1,1],[0,0,0]], color: 'Z' },
    J: { matrix: [[1,0,0],[1,1,1],[0,0,0]], color: 'J' },
    L: { matrix: [[0,0,1],[1,1,1],[0,0,0]], color: 'L' }
  };
  var PIECE_KEYS = Object.keys(SHAPES);

  // ---- Game state ----
  var board;           // ROWS x COLS array, null or color key
  var current;          // { matrix, color, x, y }
  var next;              // { matrix, color }
  var score, level, lines;
  var dropTimer = null;
  var dropInterval;
  var running = false;
  var gameOver = false;

  // ---- DOM ----
  var boardEl = document.getElementById('board');
  var nextEl = document.getElementById('next-piece');
  var scoreEl = document.getElementById('score');
  var levelEl = document.getElementById('level');
  var linesEl = document.getElementById('lines');
  var overlayEl = document.getElementById('overlay');
  var overlayMsgEl = document.getElementById('overlay-message');
  var startBtn = document.getElementById('start-btn');
  var restartBtn = document.getElementById('restart-btn');

  // Build static board cell grid once.
  var boardCells = [];
  (function buildBoardDom() {
    for (var r = 0; r < ROWS; r++) {
      var rowCells = [];
      for (var c = 0; c < COLS; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        boardEl.appendChild(cell);
        rowCells.push(cell);
      }
      boardCells.push(rowCells);
    }
  })();

  var nextCells = [];
  (function buildNextDom() {
    for (var r = 0; r < 4; r++) {
      var rowCells = [];
      for (var c = 0; c < 4; c++) {
        var cell = document.createElement('div');
        cell.className = 'cell';
        nextEl.appendChild(cell);
        rowCells.push(cell);
      }
      nextCells.push(rowCells);
    }
  })();

  function randomPieceKey() {
    return PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  }

  function makePiece(key) {
    var def = SHAPES[key];
    // deep copy matrix so rotations don't mutate the template
    var matrix = def.matrix.map(function (row) { return row.slice(); });
    var size = matrix.length;
    return {
      key: key,
      matrix: matrix,
      color: def.color,
      x: Math.floor((COLS - size) / 2),
      y: 0
    };
  }

  function createEmptyBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) {
      b.push(new Array(COLS).fill(null));
    }
    return b;
  }

  function collides(matrix, x, y) {
    for (var r = 0; r < matrix.length; r++) {
      for (var c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        var boardX = x + c;
        var boardY = y + r;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY < 0) continue; // above visible board, ignore
        if (board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(matrix) {
    var n = matrix.length;
    var result = [];
    for (var i = 0; i < n; i++) {
      result.push(new Array(n).fill(0));
    }
    for (var r = 0; r < n; r++) {
      for (var c = 0; c < n; c++) {
        result[c][n - 1 - r] = matrix[r][c];
      }
    }
    return result;
  }

  function tryRotate() {
    if (!current || current.key === 'O') return; // O piece: rotation is a no-op
    var rotated = rotateMatrix(current.matrix);
    var kicks = [0, -1, 1, -2, 2];
    for (var i = 0; i < kicks.length; i++) {
      var kickX = current.x + kicks[i];
      if (!collides(rotated, kickX, current.y)) {
        current.matrix = rotated;
        current.x = kickX;
        render();
        return;
      }
    }
    // no valid rotation found; leave piece as-is
  }

  function spawnPiece() {
    current = next ? makePieceFromNext(next) : makePiece(randomPieceKey());
    next = { key: randomPieceKey() };
    renderNext();
    if (collides(current.matrix, current.x, current.y)) {
      endGame();
    }
  }

  function makePieceFromNext(n) {
    return makePiece(n.key);
  }

  function lockPiece() {
    for (var r = 0; r < current.matrix.length; r++) {
      for (var c = 0; c < current.matrix[r].length; c++) {
        if (!current.matrix[r][c]) continue;
        var boardX = current.x + c;
        var boardY = current.y + r;
        if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
          board[boardY][boardX] = current.color;
        }
      }
    }
    var cleared = clearLines();
    if (cleared > 0) {
      applyScore(cleared);
    }
    if (!gameOver) {
      spawnPiece();
      render();
    }
  }

  function clearLines() {
    var clearedRows = [];
    for (var r = 0; r < ROWS; r++) {
      var full = true;
      for (var c = 0; c < COLS; c++) {
        if (!board[r][c]) { full = false; break; }
      }
      if (full) clearedRows.push(r);
    }
    if (clearedRows.length === 0) return 0;
    // remove cleared rows and add empty rows on top
    clearedRows.forEach(function (r) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(null));
    });
    return clearedRows.length;
  }

  function applyScore(clearedCount) {
    var table = { 1: 40, 2: 100, 3: 300, 4: 1200 };
    var points = (table[clearedCount] || 0) * level;
    score += points;
    lines += clearedCount;
    var newLevel = Math.floor(lines / LINES_PER_LEVEL) + 1;
    if (newLevel !== level) {
      level = newLevel;
      updateDropInterval();
      restartDropTimer();
    }
    updateInfo();
  }

  function updateDropInterval() {
    dropInterval = Math.max(100, 1000 - (level - 1) * 75);
  }

  function updateInfo() {
    scoreEl.textContent = score;
    levelEl.textContent = level;
    linesEl.textContent = lines;
  }

  function moveHorizontal(dx) {
    if (!running || gameOver) return;
    var newX = current.x + dx;
    if (!collides(current.matrix, newX, current.y)) {
      current.x = newX;
      render();
    }
  }

  function softDrop() {
    if (!running || gameOver) return;
    if (!collides(current.matrix, current.x, current.y + 1)) {
      current.y += 1;
      score += 1;
      updateInfo();
      render();
    } else {
      lockPiece();
    }
  }

  function hardDrop() {
    if (!running || gameOver) return;
    var dropped = 0;
    while (!collides(current.matrix, current.x, current.y + 1)) {
      current.y += 1;
      dropped++;
    }
    score += dropped * 2;
    updateInfo();
    lockPiece();
  }

  function tick() {
    if (!running || gameOver) return;
    if (!collides(current.matrix, current.x, current.y + 1)) {
      current.y += 1;
      render();
    } else {
      lockPiece();
    }
  }

  function restartDropTimer() {
    if (dropTimer) clearInterval(dropTimer);
    dropTimer = setInterval(tick, dropInterval);
  }

  function render() {
    // clear board display
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var cell = boardCells[r][c];
        var val = board[r][c];
        if (val) {
          cell.className = 'cell filled color-' + val;
        } else {
          cell.className = 'cell';
        }
      }
    }
    // draw current piece on top
    if (current && !gameOver) {
      for (var mr = 0; mr < current.matrix.length; mr++) {
        for (var mc = 0; mc < current.matrix[mr].length; mc++) {
          if (!current.matrix[mr][mc]) continue;
          var boardY = current.y + mr;
          var boardX = current.x + mc;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            boardCells[boardY][boardX].className = 'cell filled color-' + current.color;
          }
        }
      }
    }
  }

  function renderNext() {
    for (var r = 0; r < 4; r++) {
      for (var c = 0; c < 4; c++) {
        nextCells[r][c].className = 'cell';
      }
    }
    if (!next) return;
    var def = SHAPES[next.key];
    var matrix = def.matrix;
    for (var mr = 0; mr < matrix.length; mr++) {
      for (var mc = 0; mc < matrix[mr].length; mc++) {
        if (matrix[mr][mc]) {
          nextCells[mr][mc].className = 'cell filled color-' + def.color;
        }
      }
    }
  }

  function endGame() {
    gameOver = true;
    running = false;
    if (dropTimer) clearInterval(dropTimer);
    overlayMsgEl.textContent = 'GAME OVER';
    overlayEl.classList.remove('hidden');
    startBtn.classList.add('hidden');
    restartBtn.classList.remove('hidden');
  }

  function resetState() {
    board = createEmptyBoard();
    score = 0;
    level = 1;
    lines = 0;
    gameOver = false;
    updateDropInterval();
    updateInfo();
    next = { key: randomPieceKey() };
    spawnPiece();
    render();
    renderNext();
  }

  function startGame() {
    resetState();
    if (gameOver) return; // defensive: spawn collision is not possible on an empty board
    running = true;
    overlayEl.classList.add('hidden');
    restartDropTimer();
  }

  // ---- Input ----
  document.addEventListener('keydown', function (e) {
    if (!running || gameOver) return;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveHorizontal(-1);
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveHorizontal(1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        softDrop();
        break;
      case 'ArrowUp':
        e.preventDefault();
        tryRotate();
        break;
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        hardDrop();
        break;
    }
  });

  startBtn.addEventListener('click', function () {
    startGame();
  });

  restartBtn.addEventListener('click', function () {
    restartBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    startGame();
  });

  // Initial idle state: show empty board + START overlay.
  (function init() {
    board = createEmptyBoard();
    score = 0;
    level = 1;
    lines = 0;
    updateInfo();
    render();
    overlayMsgEl.textContent = 'TETRIS';
    overlayEl.classList.remove('hidden');
  })();
})();
