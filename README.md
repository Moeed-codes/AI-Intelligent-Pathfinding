# AI Intelligent Pathfinding & Search Algorithm Visualizer

An educational, browser-based tool that demonstrates classic **Artificial Intelligence search algorithms** on a 2D grid. Users build a map with a **start node**, a **goal node** and **obstacles**, then watch how different AI search strategies explore the state space and find a path — with live statistics and a side-by-side algorithm comparison.

Built with **pure HTML, CSS and vanilla JavaScript** — no frameworks, no backend, no databases, no external APIs. Every algorithm is written by hand so the code is easy to read and study.

---

## 1. Project Overview

The application visualizes the fundamental AI concepts of **problem solving by search**. A grid is treated as a **state space** where each cell is a state, and movement between adjacent cells (up / down / left / right) are the **actions**. The user defines:

- an **initial state** (start node),
- a **goal state** (goal node), and
- **obstacles** (walls) that cannot be entered.

The user then picks an algorithm and the visualizer animates how the algorithm **explores states, expands its search tree, backtracks**, and finally **reconstructs the solution path**. Live statistics report nodes explored, path length, path cost, execution time and heuristic values. A **Compare Algorithms** panel benchmarks all seven algorithms on the same grid and ranks them by efficiency and optimality.

---

## 2. Problem Statement

Given a 2D grid containing a start cell, a goal cell and obstacle cells, find a path from start to goal that:

1. never passes through an obstacle,
2. uses only the four directional movement operators, and
3. can be evaluated on **optimality** (minimum number of steps / minimum path cost) and **efficiency** (number of nodes explored).

The project evaluates how different AI search strategies — uninformed, informed and local — solve this problem, and compares their behavior and performance.

---

## 3. Objectives

- Demonstrate the **state space, initial state, goal state, actions/operators** and **search tree** concepts visually.
- Implement **7 classical AI search algorithms** from scratch in JavaScript.
- Show the difference between **uninformed search** (BFS, DFS, UCS) and **informed search** (Greedy, A*).
- Demonstrate **local search** (Hill Climbing, Simulated Annealing) and the **local optimum** problem.
- Illustrate the role of the **heuristic function** and the **evaluation function**.
- Provide **live statistics** and an **algorithm comparison table** for educational analysis.
- Teach A* (f(n) = g(n) + h(n)) and Greedy (f(n) = h(n)) in a hands-on way.

---

## 4. AI Concepts Used

| Concept | Meaning in this project |
|---|---|
| **State Space** | Every cell of the grid is a state; the whole grid is the set of all reachable states. |
| **Initial State** | The green **start** node. |
| **Goal State** | The red **goal** node. |
| **Actions / Operators** | The four moves: up, down, left, right. |
| **Search Tree** | Grows from the initial state as nodes are expanded into children; the **frontier** (teal) is the set of nodes waiting to be expanded. |
| **Search Strategy** | The order in which the frontier is expanded (FIFO queue, LIFO stack, or priority queue). |
| **Uninformed Search** | No goal-location knowledge (BFS, DFS, UCS). |
| **Informed Search** | Uses a heuristic to guide the search (Greedy, A*). |
| **Heuristic Function** | h(n) = Manhattan distance from node n to the goal. |
| **Evaluation Function** | f(n), the ranking of frontier nodes: f = g for UCS, f = h for Greedy, f = g + h for A*. |
| **Local Search** | Keeps a single current state and improves it (no search tree). |
| **Local Optimum** | A state with no improving neighbour, even though the goal lies elsewhere. |
| **Global Optimum** | The best state in the whole space (here: the goal, h = 0). |
| **Backtracking** | Walking parent pointers back from goal to start to reconstruct the path. |
| **Path Cost** | Number of moves (edges) on the final path; with unit costs it equals path length − 1. |

---

## 5. Algorithms

| # | Algorithm | Type | Strategy | Optimal |
|---|---|---|---|---|
| 1 | **Breadth First Search (BFS)** | Uninformed | FIFO queue — expands level by level | Yes (unit costs) |
| 2 | **Depth First Search (DFS)** | Uninformed | LIFO stack — dives deep, then backtracks | No |
| 3 | **Uniform Cost Search (UCS)** | Uninformed | Priority queue by g(n) | Yes |
| 4 | **Greedy Best First Search** | Informed | Priority queue by h(n) | No |
| 5 | **A\* Search** | Informed | Priority queue by f(n) = g(n) + h(n) | Yes |
| 6 | **Hill Climbing** | Local | Greedy best-improvement neighbour | No |
| 7 | **Simulated Annealing** | Local | Random neighbour + probabilistic acceptance | No |

---

## 6. Heuristic Function

The grid uses **Manhattan distance**, which is **admissible** (it never overestimates the true cost on a 4-connected grid with unit edge costs):

```
h(n) = |x1 - x2| + |y1 - y2|
```

where (x1, y1) is the current node and (x2, y2) is the goal node.

---

## 7. A* Formula

A* combines the actual cost from the start with the estimated cost to the goal:

```
f(n) = g(n) + h(n)
```

- **g(n)** = cost of the path from the start node to node n (accumulated step cost).
- **h(n)** = heuristic estimate of the cost from n to the goal (Manhattan distance).
- **f(n)** = total estimated cost of a solution path going through n.

Because h is admissible, A* is **optimal** and **complete**: the first time the goal is popped from the frontier, the path is provably the cheapest.

For comparison, **Greedy Best First Search** uses only the heuristic:

```
f(n) = h(n)
```

Greedy reaches the goal quickly but can be misled by obstacles and is **not optimal**.

---

## 8. Hill Climbing Explanation

Hill Climbing is a **local search**: it keeps a single current state and repeatedly moves to the neighbour with the lowest heuristic value, keeping **no history** — there is no frontier, no closed list and no backtracking.

- It always improves, so it descends the "heuristic surface" toward the **global optimum** (the goal, where h = 0).
- It can get stuck at a **local optimum**: a state whose neighbours all have a heuristic value that is worse or equal, even though the goal lies elsewhere.
- Because rejected states are never reconsidered, the algorithm cannot escape the local optimum.

**Try it:** run Hill Climbing on a grid with a long wall between start and goal — the agent walks right up to the wall, finds no improving neighbour, and stops, demonstrating the local-optimum failure.

---

## 9. Simulated Annealing Explanation

Simulated Annealing extends local search with randomness, inspired by the physical process of cooling molten metal. A **temperature** parameter T starts high and cools toward 0.

At every step the algorithm samples a random neighbour and computes the change in heuristic:

```
delta = h(next) - h(current)
```

- If `delta < 0` (better neighbour) it **always** moves.
- If `delta >= 0` (worse neighbour) it moves with probability:

```
P(accept) = e^(-delta / T)
```

- **High temperature:** accepts most moves, so the search freely explores and can escape local optima.
- **Low temperature:** behaves almost like Hill Climbing — converging on the best region.

The cooling schedule gradually shifts the behaviour from exploration to exploitation. Simulated Annealing is **not guaranteed** to find the goal; the visualizer highlights every visited state and the final position.

---

## 10. Algorithm Comparison

The **Compare Algorithms** panel runs all seven algorithms instantly on the current grid and produces a table with:

- **Algorithm** name
- **Search type** (uninformed / informed / local)
- **Nodes Explored** (efficiency)
- **Path Length** (number of cells in the path)
- **Path Cost** (number of moves)
- **Execution Time** (milliseconds)
- **Optimal / Not Optimal**
- **Path Found** (Yes / No)

Best values (fewest nodes explored, lowest cost) are highlighted in green; the highest cost is highlighted in red. On typical grids you will observe:

- **BFS / UCS / A\*** all find the **optimal** path; A* explores the fewest nodes because the heuristic guides it.
- **DFS** often finds a long, winding path quickly (few nodes explored, high cost).
- **Greedy** races toward the goal but may produce a non-optimal path.
- **Hill Climbing** may not find the goal at all if it hits a local optimum.
- **Simulated Annealing** usually finds the goal but sometimes takes a long route.

---

## 11. How to Run

No build step, no server, no dependencies.

1. Download / copy the four files into one folder:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
2. Double-click **`index.html`** (or open it in any modern browser — Chrome, Edge, Firefox, Safari).

**Usage**

1. Use the tool buttons (**Brush / Erase / Start / Goal**) to draw walls, erase, and move the start/goal nodes.
2. Select a **grid size** (Small / Medium / Large).
3. Optionally generate a **Random Maze**.
4. Pick an **algorithm** from the dropdown.
5. Press **Start Search** and watch the animation.
6. Adjust the **animation speed** slider (Slow → Instant).
7. Press **Compare Algorithms** to benchmark all seven at once.
8. Read the **AI Concepts Used** section at the bottom for explanations.

**Controls**

| Control | Action |
|---|---|
| Brush | Click / drag to draw obstacles |
| Erase | Click / drag to remove obstacles |
| Start / Goal | Click to move the start / goal node |
| Grid Size | Small (15×15), Medium (25×20), Large (40×30) |
| Random Maze | Generates a perfect maze with recursive backtracking |
| Reset | Stops the animation and clears visual marks |
| Clear Obstacles | Removes all walls |
| Animation Speed | Slow → Instant (0 runs instantly, ideal for large grids) |

---

## 12. Future Improvements

- **8-directional movement** (diagonals) with the diagonal-distance heuristic.
- **Weighted cells** (different terrain costs) to demonstrate UCS and A* with non-unit g(n).
- **Interactive comparison charts** (bar charts for nodes explored / path cost).
- **Step-by-step mode** (single-step with forward/back controls) for classroom use.
- **Cost on path display** and node labels (g, h, f values shown inside each cell).
- **Multiple agents / goal sets** and multi-goal search problems.
- **Additional algorithms**: Iterative Deepening DFS, Bidirectional BFS, D* Lite, Jump Point Search.
- **Save / load maps** (e.g., JSON or a shareable text encoding) without a backend.
- **Grid rendering on `<canvas>`** for very large maps (e.g., 100×100+).

---

*Artificial Intelligence course project — all algorithms implemented by hand in vanilla JavaScript for educational purposes.*