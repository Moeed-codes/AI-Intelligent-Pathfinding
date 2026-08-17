/* ==========================================================================
   AI Intelligent Pathfinding & Search Algorithm Visualizer
   --------------------------------------------------------------------------
   Pure vanilla JavaScript. All seven search algorithms are implemented
   by hand below for educational clarity:

     1. BFS  (Breadth First Search)          - FIFO queue
     2. DFS  (Depth First Search)            - LIFO stack
     3. UCS  (Uniform Cost Search)           - priority queue by g(n)
     4. Greedy Best First Search             - priority queue by h(n)
     5. A*   Search                          - priority queue by f(n)=g(n)+h(n)
     6. Hill Climbing                        - greedy local search
     7. Simulated Annealing                  - probabilistic local search

   Architecture
   ------------
   * `grid` is a 2D array of cell types: "empty", "start", "goal", "wall".
   * Every algorithm is an async function that receives (grid, start, goal,
     env). The `env` object exposes:
       - env.emit(kind, r, c)  -> records/colors an event (explored, frontier,
                                  path, current) and optionally pauses
       - env.pause()           -> animation delay; resolves immediately when
                                  running in "instant"/compare mode
     This single code path powers BOTH live animation and the instant
     benchmark/comparison mode (env.visual = false).
   ========================================================================== */

"use strict";

/* --------------------------------------------------------------------------
   1. DOM references
   -------------------------------------------------------------------------- */
const gridEl      = document.getElementById("grid");
const sizeSelect  = document.getElementById("sizeSelect");
const toolbarEl   = document.getElementById("toolbar");
const algoSelect  = document.getElementById("algoSelect");
const btnStart    = document.getElementById("btnStart");
const btnReset    = document.getElementById("btnReset");
const btnClear    = document.getElementById("btnClear");
const btnMaze     = document.getElementById("btnMaze");
const btnCompare  = document.getElementById("btnCompare");
const speedSlider = document.getElementById("speedSlider");
const speedLabel  = document.getElementById("speedLabel");
const noPathNotice= document.getElementById("noPathNotice");

// Live statistics fields
const statAlgo       = document.getElementById("statAlgo");
const statExplored   = document.getElementById("statExplored");
const statLength     = document.getElementById("statLength");
const statCost       = document.getElementById("statCost");
const statTime       = document.getElementById("statTime");
const statHeuristic  = document.getElementById("statHeuristic");
const statResult     = document.getElementById("statResult");
const statStrategy   = document.getElementById("statStrategy");
const compareBody    = document.getElementById("compareBody");

/* --------------------------------------------------------------------------
   2. Grid model
   -------------------------------------------------------------------------- */
let cols = 25, rows = 20;            // current grid dimensions
let grid = [];                       // grid[r][c] = "empty"|"start"|"goal"|"wall"
let cellEls = [];                    // cellEls[r][c] = DOM element
let start = { r: 4, c: 10 };         // initial state
let goal  = { r: 15, c: 14 };        // goal state

const SIZE_MAP = {
  "15": { cols: 15, rows: 15 },
  "25": { cols: 25, rows: 20 },
  "40": { cols: 40, rows: 30 },
};

// The 4 movement operators (actions) - 4-directional movement
const DIRS = [
  [-1, 0], // up
  [0, 1],  // right
  [1, 0],  // down
  [0, -1], // left
];

const T_EMPTY = "empty";
const T_START = "start";
const T_GOAL  = "goal";
const T_WALL  = "wall";

/* --------------------------------------------------------------------------
   3. Small utilities
   -------------------------------------------------------------------------- */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Structural equality for coordinates
const same = (a, b) => a && b && a.r === b.r && a.c === b.c;

// Bounds check
const inBounds = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;

const isWall = (r, c) => grid[r][c] === T_WALL;

const randInt = (n) => Math.floor(Math.random() * n);

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/* --------------------------------------------------------------------------
   4. Heuristic function - Manhattan distance
      h(n) = |x1 - x2| + |y1 - y2|
   Admissible on a 4-connected grid with unit edge costs, so A* is optimal.
   -------------------------------------------------------------------------- */
function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

// List of the 4 neighbouring coordinates of a cell (passable checked by caller)
function neighbors(node) {
  return DIRS.map(([dr, dc]) => ({ r: node.r + dr, c: node.c + dc }));
}

// Walk parent pointers from the goal back to the start (backtracking)
function reconstructPath(parent, startNode, goalNode) {
  const path = [];
  let cur = goalNode;
  while (cur) {
    path.push(cur);
    if (same(cur, startNode)) break;
    cur = parent[cur.r][cur.c];
  }
  path.reverse();
  return path;
}

/* --------------------------------------------------------------------------
   5. PriorityQueue - binary min-heap (hand-written, used by UCS/Greedy/A*)
   -------------------------------------------------------------------------- */
class PriorityQueue {
  constructor(compare) {
    this.heap = [];
    this.compare = compare; // comparator(a, b) returns true if a has priority
  }

  isEmpty() { return this.heap.length === 0; }
  size() { return this.heap.length; }

  push(item) {
    const h = this.heap;
    h.push(item);
    let i = h.length - 1;
    // bubble up: move the new item toward the root while it has priority
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.compare(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }

  pop() {
    const h = this.heap;
    const top = h[0];
    const last = h.pop();
    if (h.length > 0) {
      h[0] = last;
      let i = 0;
      // sift down: push the new root down until the heap is ordered again
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < h.length && this.compare(h[l], h[s])) s = l;
        if (r < h.length && this.compare(h[r], h[s])) s = r;
        if (s === i) break;
        [h[i], h[s]] = [h[s], h[i]];
        i = s;
      }
    }
    return top;
  }
}

/* --------------------------------------------------------------------------
   6. The environment object passed to every algorithm.
      Handles both live visualization (colors + delays) and instant mode
      (benchmark / comparison - no DOM writes, no waiting).
   -------------------------------------------------------------------------- */
function makeEnv(visual, token) {
  return {
    visual,
    token,
    exploredCount: 0,
    delay: visual ? getDelay() : 0,

    // Record + optionally visualize a search event. `kind` is one of
    // "explored", "frontier", "path", "current".
    emit(kind, r, c) {
      if (visual && cellEls[r]) colorCell(r, c, kind);
      // "explored" (tree search expansions) and "current" (local search moves)
      // are the meaningful steps -> count them and pause the animation here.
      if (kind === "explored" || kind === "current") {
        this.exploredCount++;
        return this.pause();
      }
      return Promise.resolve();
    },

    pause() {
      if (token.cancelled) return Promise.reject(CANCEL);
      if (this.delay > 0) return sleep(this.delay);
      return Promise.resolve();
    },
  };
}

const CANCEL = { cancelled: true }; // sentinel thrown when the user resets

/* ==========================================================================
   7. THE SEARCH ALGORITHMS
   ========================================================================== */

/* ---------- Breadth First Search (BFS) -----------------------------------
   FIFO queue -> explores level by level. Optimal on unweighted graphs.
   ------------------------------------------------------------------------- */
async function bfs(gridA, startNode, goalNode, env) {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));

  const queue = [startNode];                 // FIFO frontier
  visited[startNode.r][startNode.c] = true;

  while (queue.length > 0) {
    const cur = queue.shift();               // dequeue oldest node
    await env.emit("explored", cur.r, cur.c);

    if (same(cur, goalNode)) {
      return { found: true, explored: env.exploredCount, path: reconstructPath(parent, startNode, goalNode) };
    }

    for (const nb of neighbors(cur)) {       // generate successor states
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c) || visited[nb.r][nb.c]) continue;
      visited[nb.r][nb.c] = true;
      parent[nb.r][nb.c] = cur;              // remember how we got here
      env.emit("frontier", nb.r, nb.c);
      queue.push(nb);                        // enqueue at the back
    }
  }
  return { found: false, path: null, explored: env.exploredCount };
}

/* ---------- Depth First Search (DFS) -------------------------------------
   LIFO stack -> dives deep, then backtracks. Not optimal, memory-friendly.
   ------------------------------------------------------------------------- */
async function dfs(gridA, startNode, goalNode, env) {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));

  const stack = [startNode];                 // LIFO frontier
  visited[startNode.r][startNode.c] = true;

  while (stack.length > 0) {
    const cur = stack.pop();                 // pop newest node
    await env.emit("explored", cur.r, cur.c);

    if (same(cur, goalNode)) {
      return { found: true, explored: env.exploredCount, path: reconstructPath(parent, startNode, goalNode) };
    }

    // Push neighbours in reverse so the first neighbour is explored first
    for (const nb of neighbors(cur).reverse()) {
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c) || visited[nb.r][nb.c]) continue;
      visited[nb.r][nb.c] = true;
      parent[nb.r][nb.c] = cur;
      env.emit("frontier", nb.r, nb.c);
      stack.push(nb);
    }
  }
  return { found: false, path: null, explored: env.exploredCount };
}

/* ---------- Uniform Cost Search (UCS) ------------------------------------
   Priority queue keyed by g(n) = path cost. Optimal for any positive costs.
   ------------------------------------------------------------------------- */
async function ucs(gridA, startNode, goalNode, env) {
  const bestG = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));
  const closed = Array.from({ length: rows }, () => Array(cols).fill(false));

  const pq = new PriorityQueue((a, b) => a.g < b.g); // order by accumulated cost
  bestG[startNode.r][startNode.c] = 0;
  pq.push({ node: startNode, g: 0 });

  while (!pq.isEmpty()) {
    const { node: cur, g: gCur } = pq.pop();
    if (closed[cur.r][cur.c]) continue;      // skip stale/duplicate entries
    closed[cur.r][cur.c] = true;
    await env.emit("explored", cur.r, cur.c);

    if (same(cur, goalNode)) {
      return { found: true, explored: env.exploredCount, path: reconstructPath(parent, startNode, goalNode) };
    }

    for (const nb of neighbors(cur)) {
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c)) continue;
      const newG = gCur + 1;                 // unit edge cost
      if (newG < bestG[nb.r][nb.c]) {        // relaxation step
        bestG[nb.r][nb.c] = newG;
        parent[nb.r][nb.c] = cur;
        env.emit("frontier", nb.r, nb.c);
        pq.push({ node: nb, g: newG });
      }
    }
  }
  return { found: false, path: null, explored: env.exploredCount };
}

/* ---------- Greedy Best First Search -------------------------------------
   Priority queue keyed by h(n) only. f(n) = h(n). Fast but not optimal.
   ------------------------------------------------------------------------- */
async function greedy(gridA, startNode, goalNode, env) {
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));

  const pq = new PriorityQueue((a, b) => a.h < b.h); // order by heuristic only
  visited[startNode.r][startNode.c] = true;
  pq.push({ node: startNode, h: manhattan(startNode, goalNode) });

  while (!pq.isEmpty()) {
    const { node: cur } = pq.pop();
    await env.emit("explored", cur.r, cur.c);

    if (same(cur, goalNode)) {
      return { found: true, explored: env.exploredCount, path: reconstructPath(parent, startNode, goalNode) };
    }

    for (const nb of neighbors(cur)) {
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c) || visited[nb.r][nb.c]) continue;
      visited[nb.r][nb.c] = true;
      parent[nb.r][nb.c] = cur;
      env.emit("frontier", nb.r, nb.c);
      pq.push({ node: nb, h: manhattan(nb, goalNode) });
    }
  }
  return { found: false, path: null, explored: env.exploredCount };
}

/* ---------- A* Search -----------------------------------------------------
   Priority queue keyed by f(n) = g(n) + h(n). Optimal + complete because
   Manhattan distance is admissible (never overestimates).
   ------------------------------------------------------------------------- */
async function astar(gridA, startNode, goalNode, env) {
  const bestG = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));

  const pq = new PriorityQueue((a, b) => a.f < b.f); // order by evaluation f
  bestG[startNode.r][startNode.c] = 0;
  pq.push({ node: startNode, g: 0, f: manhattan(startNode, goalNode) });

  while (!pq.isEmpty()) {
    const { node: cur, g: gCur } = pq.pop();
    if (gCur > bestG[cur.r][cur.c]) continue; // stale entry -> skip
    await env.emit("explored", cur.r, cur.c);

    if (same(cur, goalNode)) {
      return { found: true, explored: env.exploredCount, path: reconstructPath(parent, startNode, goalNode) };
    }

    for (const nb of neighbors(cur)) {
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c)) continue;
      const newG = gCur + 1;
      if (newG < bestG[nb.r][nb.c]) {        // relaxation step
        bestG[nb.r][nb.c] = newG;
        parent[nb.r][nb.c] = cur;
        env.emit("frontier", nb.r, nb.c);
        const h = manhattan(nb, goalNode);
        pq.push({ node: nb, g: newG, f: newG + h });
      }
    }
  }
  return { found: false, path: null, explored: env.exploredCount };
}

/* ---------- Hill Climbing (Local Search) ---------------------------------
   No frontier, no backtracking: at every step move to the best neighbour
   (lowest h). If no neighbour improves the heuristic the search is stuck at
   a LOCAL OPTIMUM and terminates without reaching the global optimum.
   ------------------------------------------------------------------------- */
async function hillClimbing(gridA, startNode, goalNode, env) {
  let cur = { r: startNode.r, c: startNode.c };
  const visited = [{ r: cur.r, c: cur.c }];
  let found = same(cur, goalNode);

  env.emit("current", cur.r, cur.c);         // show the moving agent
  await env.pause();

  while (!found) {
    let best = null;
    let bestH = manhattan(cur, goalNode);

    // Evaluate every reachable neighbour (greedy, steepest-improvement)
    for (const nb of neighbors(cur)) {
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c)) continue;
      env.emit("frontier", nb.r, nb.c);      // mark candidate states
      const nh = manhattan(nb, goalNode);
      if (nh < bestH) { bestH = nh; best = nb; } // strict improvement only
    }

    if (!best) break;                        // local optimum: no improving move

    env.emit("path", cur.r, cur.c);          // leave a trail
    cur = best;
    env.emit("current", cur.r, cur.c);       // move the agent
    await env.pause();

    visited.push({ r: cur.r, c: cur.c });
    if (same(cur, goalNode)) found = true;
  }

  env.emit("path", cur.r, cur.c);            // highlight the final position
  return { found, path: visited, explored: visited.length };
}

/* ---------- Simulated Annealing (Local Search) ---------------------------
   Accepts worse neighbours with probability exp(-delta/T) to escape local
   optima. Temperature T cools over time: exploration early, exploitation late.
   ------------------------------------------------------------------------- */
async function simulatedAnnealing(gridA, startNode, goalNode, env) {
  let cur = { r: startNode.r, c: startNode.c };
  const visited = [{ r: cur.r, c: cur.c }];
  const cells = rows * cols;

  let T = 50;                                // initial temperature
  let steps = 0;
  const maxSteps = cells * 4;                // step budget
  let found = same(cur, goalNode);

  env.emit("current", cur.r, cur.c);
  await env.pause();

  while (steps < maxSteps && !found && T > 0.01) {
    // Sample one random reachable neighbour
    const options = neighbors(cur).filter(
      (nb) => inBounds(nb.r, nb.c) && !isWall(nb.r, nb.c)
    );
    if (options.length === 0) break;         // fully enclosed

    const nxt = options[randInt(options.length)];
    const delta = manhattan(nxt, goalNode) - manhattan(cur, goalNode);
    env.emit("frontier", nxt.r, nxt.c);      // mark the sampled candidate

    // Accept better moves always; worse moves with Boltzmann probability
    let moved = false;
    if (delta < 0) {
      moved = true;
    } else if (Math.exp(-delta / T) > Math.random()) {
      moved = true;
    }

    if (moved) {
      env.emit("path", cur.r, cur.c);        // leave a trail
      cur = nxt;
      env.emit("current", cur.r, cur.c);
      await env.pause();
      visited.push({ r: cur.r, c: cur.c });
      if (same(cur, goalNode)) found = true;
    }

    T *= 0.9995;                             // geometric cooling schedule
    steps++;
  }

  env.emit("path", cur.r, cur.c);
  return { found, path: visited, explored: visited.length };
}

/* --------------------------------------------------------------------------
   8. Algorithm metadata (name, type, strategy, optimality)
   -------------------------------------------------------------------------- */
const ALGORITHMS = {
  bfs: {
    name: "BFS", full: "Breadth First Search", type: "uninformed",
    strategy: "Uninformed - FIFO queue", optimal: true, fn: bfs,
  },
  dfs: {
    name: "DFS", full: "Depth First Search", type: "uninformed",
    strategy: "Uninformed - LIFO stack", optimal: false, fn: dfs,
  },
  ucs: {
    name: "UCS", full: "Uniform Cost Search", type: "uninformed",
    strategy: "Uninformed - Priority queue by g(n)", optimal: true, fn: ucs,
  },
  greedy: {
    name: "Greedy", full: "Greedy Best First Search", type: "informed",
    strategy: "Informed - Priority queue by h(n)", optimal: false, fn: greedy,
  },
  astar: {
    name: "A*", full: "A* Search", type: "informed",
    strategy: "Informed - Priority queue by f(n)=g(n)+h(n)", optimal: true, fn: astar,
  },
  hill: {
    name: "Hill Climbing", full: "Hill Climbing", type: "local",
    strategy: "Local Search - greedy best-improvement", optimal: false, fn: hillClimbing,
  },
  anneal: {
    name: "Simulated Annealing", full: "Simulated Annealing", type: "local",
    strategy: "Local Search - probabilistic (Boltzmann) acceptance", optimal: false, fn: simulatedAnnealing,
  },
};

/* --------------------------------------------------------------------------
   9. Grid rendering + cell painting
   -------------------------------------------------------------------------- */
function buildGrid() {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  grid = Array.from({ length: rows }, () => Array(cols).fill(T_EMPTY));
  cellEls = Array.from({ length: rows }, () => Array(cols));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.r = r;
      cell.dataset.c = c;
      cellEls[r][c] = cell;
      gridEl.appendChild(cell);
    }
  }

  // Reset markers to sensible in-bounds coordinates on (re)build
  start = { r: Math.min(4, rows - 1), c: Math.floor(cols / 2) - 2 };
  goal = { r: Math.max(rows - 5, 1), c: Math.floor(cols / 2) + 3 };
  setCellType(start.r, start.c, T_START);
  setCellType(goal.r, goal.c, T_GOAL);
}

// Apply/remove a temporary visual mark on a cell
function colorCell(r, c, kind) {
  const el = cellEls[r][c];
  if (!el) return;
  el.classList.remove("frontier", "explored", "path", "current");
  if (kind && kind !== "none") el.classList.add(kind);
}

// Clear all temporary search marks (keeps start/goal/walls)
function clearTempMarks() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      colorCell(r, c, "none");
    }
  }
  noPathNotice.classList.add("hidden");
}

function placeStart(pos) {
  if (same(pos, start)) return;

  // Clear the old start position (and any stale search marks on it)
  grid[start.r][start.c] = T_EMPTY;
  cellEls[start.r][start.c].classList.remove(T_START);
  colorCell(start.r, start.c, "none");

  // If the user drops the start onto the goal, swap the two markers
  if (grid[pos.r][pos.c] === T_GOAL) {
    const oldStart = { ...start };
    start = { r: pos.r, c: pos.c };
    goal = oldStart;
    setCellType(pos.r, pos.c, T_START);
    colorCell(pos.r, pos.c, "none");
    setCellType(goal.r, goal.c, T_GOAL);
    colorCell(goal.r, goal.c, "none");
  } else {
    start = { r: pos.r, c: pos.c };
    setCellType(start.r, start.c, T_START);
    colorCell(start.r, start.c, "none");
  }
  updateHeuristicStat();
}

function placeGoal(pos) {
  if (same(pos, goal)) return;

  // Clear the old goal position (and any stale search marks on it)
  grid[goal.r][goal.c] = T_EMPTY;
  cellEls[goal.r][goal.c].classList.remove(T_GOAL);
  colorCell(goal.r, goal.c, "none");

  // If the user drops the goal onto the start, swap the two markers
  if (grid[pos.r][pos.c] === T_START) {
    const oldGoal = { ...goal };
    goal = { r: pos.r, c: pos.c };
    start = oldGoal;
    setCellType(pos.r, pos.c, T_GOAL);
    colorCell(pos.r, pos.c, "none");
    setCellType(start.r, start.c, T_START);
    colorCell(start.r, start.c, "none");
  } else {
    goal = { r: pos.r, c: pos.c };
    setCellType(goal.r, goal.c, T_GOAL);
    colorCell(goal.r, goal.c, "none");
  }
  updateHeuristicStat();
}

// Set the semantic type of a cell and synchronize its DOM classes
function setCellType(r, c, type) {
  grid[r][c] = type;
  cellEls[r][c].classList.remove(T_START, T_GOAL, T_WALL);
  cellEls[r][c].classList.add(type);
}

function paintWall(r, c) {
  if (grid[r][c] === T_START || grid[r][c] === T_GOAL) return;
  if (grid[r][c] === T_WALL) return;
  grid[r][c] = T_WALL;
  colorCell(r, c, "none"); // strip any stale search marks
  cellEls[r][c].classList.add(T_WALL);
}

function eraseCell(r, c) {
  if (grid[r][c] !== T_WALL) return;
  grid[r][c] = T_EMPTY;
  colorCell(r, c, "none"); // strip any stale search marks
  cellEls[r][c].classList.remove(T_WALL);
}

function clearWalls() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === T_WALL) eraseCell(r, c);
    }
  }
}

/* --------------------------------------------------------------------------
   10. Random maze - recursive backtracker (DFS carving)
   ------------------------------------------------------------------------- */
function generateMaze() {
  clearTempMarks();
  clearWalls();
  const maze = Array.from({ length: rows }, () => Array(cols).fill(T_WALL));

  // Start carving from an interior odd-coordinate cell (1,1)
  maze[1][1] = T_EMPTY;
  const stack = [{ r: 1, c: 1 }];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    // Two-cell jumps in random order create the maze corridors
    const dirs = shuffle([[0, 2], [0, -2], [2, 0], [-2, 0]]);
    let carved = false;

    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (inBounds(nr, nc) && maze[nr][nc] === T_WALL) {
        maze[cur.r + dr / 2][cur.c + dc / 2] = T_EMPTY; // open the wall between
        maze[nr][nc] = T_EMPTY;
        stack.push({ r: nr, c: nc });
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop(); // dead end -> backtrack
  }

  // Write the maze onto the grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (maze[r][c] === T_WALL) { grid[r][c] = T_WALL; cellEls[r][c].classList.add(T_WALL); }
      else { grid[r][c] = T_EMPTY; cellEls[r][c].classList.remove(T_WALL); }
    }
  }

  // Place start/goal at guaranteed-carved odd/odd coordinates
  // (the recursive backtracker only carves cells with odd row AND odd column)
  const gr = rows % 2 === 1 ? rows - 2 : rows - 1;
  const gc = cols % 2 === 1 ? cols - 2 : cols - 1;
  placeStart({ r: 1, c: 1 });
  placeGoal({ r: gr, c: gc });
}

/* --------------------------------------------------------------------------
   11. Speed control
   ------------------------------------------------------------------------- */
function getDelay() {
  const v = parseInt(speedSlider.value, 10);
  if (v === 0) return 0; // instant
  return Math.round(200 / v); // speed 10 -> 20ms, speed 1 -> 200ms
}

function updateSpeedLabel() {
  const v = parseInt(speedSlider.value, 10);
  speedLabel.textContent =
    v === 0 ? "Instant" :
    v <= 3 ? "Slow" :
    v <= 6 ? "Medium" : "Fast";
}

/* --------------------------------------------------------------------------
   12. Animation runner + live statistics
   ------------------------------------------------------------------------- */
let running = false;
let currentToken = null;

// Disable/enable the interactive controls during a run
function setControlsDisabled(disabled) {
  [btnStart, btnCompare, btnMaze, btnClear, btnReset].forEach((b) => {
    b.disabled = disabled;
  });
}

function resetStats() {
  statAlgo.textContent = ALGORITHMS[algoSelect.value].full;
  statExplored.textContent = statLength.textContent =
  statCost.textContent = statTime.textContent = "&hellip;";
  statResult.textContent = "Running&hellip;";
  statResult.className = "";
  statStrategy.textContent = ALGORITHMS[algoSelect.value].strategy;
  updateHeuristicStat();
}

function updateHeuristicStat() {
  statHeuristic.textContent = manhattan(start, goal);
}

function showResultStats(meta, result, timeMs) {
  statAlgo.textContent = meta.full;
  statExplored.textContent = result.explored;
  statStrategy.textContent = meta.strategy;
  statTime.textContent = timeMs.toFixed(1) + " ms";

  if (result.path && result.path.length > 0) {
    statLength.textContent = result.path.length;
    statCost.textContent = result.path.length - 1; // unit edge costs
  } else {
    statLength.textContent = "&mdash;";
    statCost.textContent = "&mdash;";
  }

  statResult.textContent = result.found ? "Path Found" : "Path Not Found";
  statResult.className = result.found ? "ok" : "fail";
}

// Run one selected algorithm live with animation
async function runSelected() {
  if (running) return;
  const key = algoSelect.value;
  const meta = ALGORITHMS[key];

  const token = { cancelled: false };
  currentToken = token;
  running = true;
  setControlsDisabled(true);
  clearTempMarks();
  resetStats();

  const t0 = performance.now();

  try {
    if (same(start, goal)) {
      // Trivial case: initial state == goal state
      showResultStats(meta, { found: true, explored: 1, path: [{ r: start.r, c: start.c }] }, performance.now() - t0);
      statResult.textContent = "Start is the Goal";
      statResult.className = "ok";
    } else {
      const env = makeEnv(true, token);
      const result = await meta.fn(grid, start, goal, env);
      const timeMs = performance.now() - t0;
      showResultStats(meta, result, timeMs);

      if (result.found && result.path && meta.type !== "local") {
        await animatePath(result.path, token); // local searches already drew their trail
      } else if (!result.found) {
        noPathNotice.classList.remove("hidden");
      }
    }
  } catch (err) {
    if (err !== CANCEL) throw err;           // swallow intentional cancellation
  } finally {
    if (token === currentToken) {
      running = false;
      setControlsDisabled(false);
    }
  }
}

// Animate the reconstructed final path (yellow)
async function animatePath(path, token) {
  const delay = getDelay() || 25;
  for (const node of path) {
    if (token.cancelled) return;             // stop immediately if reset
    colorCell(node.r, node.c, "path");
    await sleep(delay);
  }
}

// Stop any active run (used by Reset)
function stopRunning() {
  if (currentToken) currentToken.cancelled = true;
  running = false;
}

/* --------------------------------------------------------------------------
   13. Compare / benchmark mode - run all 7 algorithms instantly
   ------------------------------------------------------------------------- */
async function runComparison() {
  if (running) return;
  const token = { cancelled: false };
  currentToken = token;
  running = true;
  setControlsDisabled(true);
  clearTempMarks();

  const rows = [];
  const order = Object.keys(ALGORITHMS);

  for (const key of order) {
    const meta = ALGORITHMS[key];
    const env = makeEnv(false, token);       // no visuals, no delays
    const t0 = performance.now();

    let result;
    if (same(start, goal)) {
      result = { found: true, explored: 1, path: [{ r: start.r, c: start.c }] };
    } else {
      result = await meta.fn(grid, start, goal, env);
    }
    const timeMs = performance.now() - t0;

    rows.push({
      key, name: meta.full, type: meta.type, optimal: meta.optimal,
      explored: result.explored,
      length: result.path ? result.path.length : null,
      cost: result.path ? result.path.length - 1 : null,
      timeMs, found: result.found,
    });
  }

  renderCompareTable(rows);

  if (token === currentToken) {
    running = false;
    setControlsDisabled(false);
  }
}

function renderCompareTable(rows) {
  // Best/worst highlighting among algorithms that found a path
  const found = rows.filter((r) => r.found && r.cost !== null);
  const minExplored = Math.min(...rows.map((r) => r.explored));
  const minCost = found.length ? Math.min(...found.map((r) => r.cost)) : null;
  const maxCost = found.length ? Math.max(...found.map((r) => r.cost)) : null;

  compareBody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    const typeLabel =
      r.type === "uninformed" ? "Uninformed" :
      r.type === "informed" ? "Informed" : "Local Search";

    const td = (html, cls) => {
      const el = document.createElement("td");
      el.innerHTML = html;
      if (cls) el.className = cls;
      tr.appendChild(el);
      return el;
    };

    td(r.name);
    td(typeLabel);
    td(r.explored, r.explored === minExplored ? "best" : "");
    td(r.found && r.length !== null ? r.length : "&mdash;");
    td(r.found && r.cost !== null ? r.cost : "&mdash;",
       r.found && r.cost === minCost ? "best" : r.found && r.cost === maxCost ? "worst" : "");
    td(r.timeMs.toFixed(1) + " ms");
    td(r.optimal ? '<span class="tag-optimal">Optimal</span>' : '<span class="tag-not-optimal">Not Optimal</span>');
    td(r.found ? "Yes" : "No");

    compareBody.appendChild(tr);
  });
}

/* --------------------------------------------------------------------------
   14. Interaction: painting walls / placing start & goal
   ------------------------------------------------------------------------- */
let tool = "brush";
let pointerDown = false;

toolbarEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".tool-btn");
  if (!btn) return;
  toolbarEl.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  tool = btn.dataset.tool;
});

function cellAt(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el || !el.classList.contains("cell")) return null;
  return { r: parseInt(el.dataset.r, 10), c: parseInt(el.dataset.c, 10) };
}

function applyTool(pos) {
  if (!pos) return;
  if (tool === "brush") paintWall(pos.r, pos.c);
  else if (tool === "erase") eraseCell(pos.r, pos.c);
  else if (tool === "start") placeStart(pos);
  else if (tool === "goal") placeGoal(pos);
}

gridEl.addEventListener("pointerdown", (e) => {
  if (running) return;
  pointerDown = true;
  gridEl.setPointerCapture(e.pointerId);
  applyTool(cellAt(e.clientX, e.clientY));
});

gridEl.addEventListener("pointermove", (e) => {
  if (!pointerDown || running) return;
  applyTool(cellAt(e.clientX, e.clientY));
});

const endPointer = () => { pointerDown = false; };
gridEl.addEventListener("pointerup", endPointer);
gridEl.addEventListener("pointercancel", endPointer);

/* --------------------------------------------------------------------------
   15. Wire up the buttons & controls
   ------------------------------------------------------------------------- */
btnStart.addEventListener("click", runSelected);

btnReset.addEventListener("click", () => {
  stopRunning();
  clearTempMarks();
  resetStats();
});

btnClear.addEventListener("click", () => {
  if (running) return;
  clearWalls();
});

btnMaze.addEventListener("click", () => {
  if (running) return;
  generateMaze();
});

btnCompare.addEventListener("click", runComparison);

speedSlider.addEventListener("input", updateSpeedLabel);

sizeSelect.addEventListener("change", () => {
  if (running) return;
  const { cols: nc, rows: nr } = SIZE_MAP[sizeSelect.value];
  cols = nc; rows = nr;
  buildGrid();
  clearTempMarks();
  resetStats();
});

/* --------------------------------------------------------------------------
   16. Boot
   ------------------------------------------------------------------------- */
buildGrid();
resetStats();
updateSpeedLabel();