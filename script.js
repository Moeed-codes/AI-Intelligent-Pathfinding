"use strict";

/* ==========================================================================
   Smart Delivery/Route-Planning Agent (Case Study)
   ========================================================================== */

/* 1. DOM references */
const gridEl = document.getElementById("grid");
const sizeSelect = document.getElementById("sizeSelect");
const toolbarEl = document.getElementById("toolbar");
const btnStart = document.getElementById("btnStart");
const btnReset = document.getElementById("btnReset");
const btnClear = document.getElementById("btnClear");
const btnMaze = document.getElementById("btnMaze");
const speedSlider = document.getElementById("speedSlider");
const speedLabel = document.getElementById("speedLabel");
const noPathNotice = document.getElementById("noPathNotice");

const weatherSelect = document.getElementById("weatherSelect");
const capacitySelect = document.getElementById("capacitySelect");
const activeRuleDisplay = document.getElementById("activeRuleDisplay");

const statStatus = document.getElementById("statStatus");
const statPackages = document.getElementById("statPackages");
const statDeliveries = document.getElementById("statDeliveries");
const statCost = document.getElementById("statCost");
const statRules = document.getElementById("statRules");
const statTime = document.getElementById("statTime");

/* 2. Grid model */
let cols = 25, rows = 20;
let grid = [];
let cellEls = [];
let depot = { r: 4, c: 10 };
let deliveries = [{ r: 15, c: 14 }];

const SIZE_MAP = {
  "15": { cols: 15, rows: 15 },
  "25": { cols: 25, rows: 20 },
  "40": { cols: 40, rows: 30 },
};

const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];

const T_EMPTY = "empty";
const T_START = "start"; // Depot
const T_GOAL = "goal";   // Delivery
const T_WALL = "wall";
const T_TRAFFIC = "traffic";

/* 3. Small utilities */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const same = (a, b) => a && b && a.r === b.r && a.c === b.c;
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

/* 4. Heuristics */
function manhattan(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}
function neighbors(node) {
  return DIRS.map(([dr, dc]) => ({ r: node.r + dr, c: node.c + dc }));
}
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

/* 5. PriorityQueue */
class PriorityQueue {
  constructor(compare) { this.heap = []; this.compare = compare; }
  isEmpty() { return this.heap.length === 0; }
  size() { return this.heap.length; }
  push(item) {
    const h = this.heap; h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.compare(h[i], h[p])) break;
      [h[i], h[p]] = [h[p], h[i]];
      i = p;
    }
  }
  pop() {
    const h = this.heap;
    const top = h[0]; const last = h.pop();
    if (h.length > 0) {
      h[0] = last; let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2; let s = i;
        if (l < h.length && this.compare(h[l], h[s])) s = l;
        if (r < h.length && this.compare(h[r], h[s])) s = r;
        if (s === i) break;
        [h[i], h[s]] = [h[s], h[i]]; i = s;
      }
    }
    return top;
  }
}

/* 6. Environment */
function makeEnv(token) {
  return {
    token,
    delay: getDelay(),
    emit(kind, r, c) {
      if (cellEls[r]) colorCell(r, c, kind);
      if (kind === "explored" || kind === "current") return this.pause();
      return Promise.resolve();
    },
    pause() {
      if (token.cancelled) return Promise.reject({ cancelled: true });
      if (this.delay > 0) return sleep(this.delay);
      return Promise.resolve();
    },
  };
}

/* 7. Knowledge-Based Reasoning (Forward Chaining) */
function updateRuleDisplay() {
  const w = weatherSelect.value;
  if (w === "clear") {
    activeRuleDisplay.textContent = "IF Weather == Clear THEN Cost = Normal";
    statRules.textContent = "Clear / Normal";
  } else if (w === "rain") {
    activeRuleDisplay.textContent = "IF Weather == Rain AND Cell == Traffic THEN Cost = High";
    statRules.textContent = "Rain / Traffic Penalty";
  } else if (w === "snow") {
    activeRuleDisplay.textContent = "IF Weather == Snow THEN Cost = Extreme (All)";
    statRules.textContent = "Snow / Universal Penalty";
  }
}
weatherSelect.addEventListener("change", updateRuleDisplay);

function getEdgeCost(r, c) {
  const w = weatherSelect.value;
  const isTraffic = grid[r][c] === T_TRAFFIC;
  
  if (w === "clear") {
    return isTraffic ? 3 : 1;
  } else if (w === "rain") {
    return isTraffic ? 6 : 1.5;
  } else if (w === "snow") {
    return isTraffic ? 8 : 3;
  }
  return 1;
}

/* 8. A* Search with dynamic edge costs */
async function astar(startNode, goalNode, env) {
  const bestG = Array.from({ length: rows }, () => Array(cols).fill(Infinity));
  const parent = Array.from({ length: rows }, () => Array(cols).fill(null));

  const pq = new PriorityQueue((a, b) => a.f < b.f);
  bestG[startNode.r][startNode.c] = 0;
  pq.push({ node: startNode, g: 0, f: manhattan(startNode, goalNode) });

  let exploredNodes = 0;
  while (!pq.isEmpty()) {
    const { node: cur, g: gCur } = pq.pop();
    if (gCur > bestG[cur.r][cur.c]) continue;
    
    exploredNodes++;
    await env.emit("explored", cur.r, cur.c);

    if (same(cur, goalNode)) {
      return { found: true, path: reconstructPath(parent, startNode, goalNode), cost: gCur, explored: exploredNodes };
    }

    for (const nb of neighbors(cur)) {
      if (!inBounds(nb.r, nb.c) || isWall(nb.r, nb.c)) continue;
      const edgeCost = getEdgeCost(nb.r, nb.c);
      const newG = gCur + edgeCost;
      if (newG < bestG[nb.r][nb.c]) {
        bestG[nb.r][nb.c] = newG;
        parent[nb.r][nb.c] = cur;
        env.emit("frontier", nb.r, nb.c);
        const h = manhattan(nb, goalNode);
        pq.push({ node: nb, g: newG, f: newG + h });
      }
    }
  }
  return { found: false, path: null, cost: 0, explored: exploredNodes };
}

/* 9. Grid rendering */
function buildGrid() {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  grid = Array.from({ length: rows }, () => Array(cols).fill(T_EMPTY));
  cellEls = Array.from({ length: rows }, () => Array(cols));
  deliveries = [];

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

  depot = { r: Math.min(4, rows - 1), c: Math.floor(cols / 2) - 2 };
  setCellType(depot.r, depot.c, T_START);
  
  const d1 = { r: Math.max(rows - 5, 1), c: Math.floor(cols / 2) + 3 };
  deliveries.push(d1);
  setCellType(d1.r, d1.c, T_GOAL);
  
  updateDeliveryStats();
}

function colorCell(r, c, kind) {
  const el = cellEls[r][c];
  if (!el) return;
  el.classList.remove("frontier", "explored", "path", "current");
  if (kind && kind !== "none") el.classList.add(kind);
}

function clearTempMarks() {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      colorCell(r, c, "none");
    }
  }
  noPathNotice.classList.add("hidden");
}

function setCellType(r, c, type) {
  grid[r][c] = type;
  cellEls[r][c].className = "cell " + type;
}

function updateDeliveryStats() {
  statDeliveries.textContent = deliveries.length;
}

function placeDepot(pos) {
  if (grid[pos.r][pos.c] === T_START) return;
  
  if (grid[pos.r][pos.c] === T_GOAL) {
    deliveries = deliveries.filter(d => !same(d, pos));
    updateDeliveryStats();
  }
  
  setCellType(depot.r, depot.c, T_EMPTY);
  depot = { r: pos.r, c: pos.c };
  setCellType(depot.r, depot.c, T_START);
}

function toggleDelivery(pos) {
  if (same(pos, depot)) return;
  
  if (grid[pos.r][pos.c] === T_GOAL) {
    setCellType(pos.r, pos.c, T_EMPTY);
    deliveries = deliveries.filter(d => !same(d, pos));
  } else {
    setCellType(pos.r, pos.c, T_GOAL);
    deliveries.push({ r: pos.r, c: pos.c });
  }
  updateDeliveryStats();
}

function paintType(r, c, type) {
  if (grid[r][c] === T_START || grid[r][c] === T_GOAL) return;
  if (grid[r][c] === type) return;
  setCellType(r, c, type);
}

function eraseCell(r, c) {
  if (grid[r][c] === T_START || grid[r][c] === T_GOAL) return;
  setCellType(r, c, T_EMPTY);
}

function generateMaze() {
  clearTempMarks();
  
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== T_START && grid[r][c] !== T_GOAL) setCellType(r, c, T_WALL);
    }
  }

  const maze = Array.from({ length: rows }, () => Array(cols).fill(T_WALL));
  maze[1][1] = T_EMPTY;
  const stack = [{ r: 1, c: 1 }];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const dirs = shuffle([[0, 2], [0, -2], [2, 0], [-2, 0]]);
    let carved = false;
    for (const [dr, dc] of dirs) {
      const nr = cur.r + dr, nc = cur.c + dc;
      if (inBounds(nr, nc) && maze[nr][nc] === T_WALL) {
        maze[cur.r + dr / 2][cur.c + dc / 2] = T_EMPTY;
        maze[nr][nc] = T_EMPTY;
        stack.push({ r: nr, c: nc });
        carved = true;
        break;
      }
    }
    if (!carved) stack.pop();
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== T_START && grid[r][c] !== T_GOAL) {
        if (maze[r][c] === T_EMPTY) setCellType(r, c, T_EMPTY);
      }
    }
  }
}

function getDelay() {
  const v = parseInt(speedSlider.value, 10);
  if (v === 0) return 0;
  return Math.round(200 / v);
}
function updateSpeedLabel() {
  const v = parseInt(speedSlider.value, 10);
  speedLabel.textContent = v === 0 ? "Instant" : v <= 3 ? "Slow" : v <= 6 ? "Medium" : "Fast";
}

/* 10. Delivery Agent Loop (Decision Making & Routing) */
let running = false;
let currentToken = null;

function setControlsDisabled(disabled) {
  [btnStart, btnMaze, btnClear, btnReset].forEach(b => b.disabled = disabled);
}

async function startShift() {
  if (running) return;
  const token = { cancelled: false };
  currentToken = token;
  running = true;
  setControlsDisabled(true);
  clearTempMarks();
  
  statStatus.textContent = "Working";
  statTime.textContent = "...";
  
  const capacity = parseInt(capacitySelect.value, 10);
  let packagesCarried = capacity;
  statPackages.textContent = packagesCarried;
  
  let currentPos = { ...depot };
  let remainingDeliveries = [...deliveries];
  let totalFuelCost = 0;
  
  const t0 = performance.now();
  const env = makeEnv(token);

  try {
    while (remainingDeliveries.length > 0) {
      if (packagesCarried === 0) {
        // Constraint Satisfaction: Need to return to Depot to reload
        statStatus.textContent = "Returning to Depot (Constraint)";
        const res = await astar(currentPos, depot, env);
        if (!res.found) throw new Error("No path to depot");
        
        await animatePath(res.path, token);
        totalFuelCost += res.cost;
        statCost.textContent = totalFuelCost;
        
        packagesCarried = capacity;
        statPackages.textContent = packagesCarried;
        currentPos = { ...depot };
        clearTempMarks(); // clear search tree for next route
        continue;
      }

      // Decision Making: Pick closest delivery
      statStatus.textContent = "Routing to Delivery...";
      remainingDeliveries.sort((a, b) => manhattan(currentPos, a) - manhattan(currentPos, b));
      const nextTarget = remainingDeliveries[0];
      
      const res = await astar(currentPos, nextTarget, env);
      if (!res.found) {
        noPathNotice.classList.remove("hidden");
        throw new Error("No path to delivery");
      }
      
      await animatePath(res.path, token);
      totalFuelCost += res.cost;
      statCost.textContent = totalFuelCost;
      
      // Delivery made
      packagesCarried--;
      statPackages.textContent = packagesCarried;
      remainingDeliveries.shift();
      statDeliveries.textContent = remainingDeliveries.length;
      setCellType(nextTarget.r, nextTarget.c, T_EMPTY); // Package delivered, clear node
      
      currentPos = { ...nextTarget };
      clearTempMarks();
    }
    
    // Shift over, return to depot
    statStatus.textContent = "Shift Over, Returning Home";
    const res = await astar(currentPos, depot, env);
    if (res.found) {
      await animatePath(res.path, token);
      totalFuelCost += res.cost;
      statCost.textContent = totalFuelCost;
    }
    
    statStatus.textContent = "Shift Complete!";
    statTime.textContent = (performance.now() - t0).toFixed(1) + " ms";

  } catch (err) {
    if (!token.cancelled) {
      statStatus.textContent = "Failed/Stuck";
    }
  } finally {
    if (token === currentToken) {
      running = false;
      setControlsDisabled(false);
      // Restore delivery nodes for next run
      deliveries.forEach(d => setCellType(d.r, d.c, T_GOAL));
      statDeliveries.textContent = deliveries.length;
    }
  }
}

async function animatePath(path, token) {
  const delay = getDelay() || 25;
  for (const node of path) {
    if (token.cancelled) return;
    colorCell(node.r, node.c, "path");
    await sleep(delay);
  }
}

function stopRunning() {
  if (currentToken) currentToken.cancelled = true;
  running = false;
  setControlsDisabled(false);
}

/* 11. Event Listeners */
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
  if (tool === "brush") paintType(pos.r, pos.c, T_WALL);
  else if (tool === "traffic") paintType(pos.r, pos.c, T_TRAFFIC);
  else if (tool === "erase") eraseCell(pos.r, pos.c);
  else if (tool === "start") placeDepot(pos);
  else if (tool === "goal") toggleDelivery(pos);
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

btnStart.addEventListener("click", startShift);
btnReset.addEventListener("click", () => {
  stopRunning();
  clearTempMarks();
  statStatus.textContent = "Idle";
  statTime.textContent = "—";
  statCost.textContent = "0";
  statPackages.textContent = "0";
  // Restore any deliveries that were cleared during a run
  deliveries.forEach(d => {
    if (grid[d.r][d.c] !== T_GOAL) setCellType(d.r, d.c, T_GOAL);
  });
  updateDeliveryStats();
});
btnClear.addEventListener("click", () => {
  if (running) return;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === T_WALL || grid[r][c] === T_TRAFFIC) eraseCell(r, c);
    }
  }
});
btnMaze.addEventListener("click", () => { if (!running) generateMaze(); });
speedSlider.addEventListener("input", updateSpeedLabel);
sizeSelect.addEventListener("change", () => {
  if (!running) {
    const { cols: nc, rows: nr } = SIZE_MAP[sizeSelect.value];
    cols = nc; rows = nr;
    buildGrid();
  }
});

/* Boot */
buildGrid();
updateSpeedLabel();
updateRuleDisplay();