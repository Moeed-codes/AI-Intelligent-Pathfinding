# Case-Study Based AI Agent Development Project Report

**Subject:** Artificial Intelligence (AI) CS-461
**Case Study:** Smart Delivery & Route-Planning Agent

---

## 1. Case Study Selection
For this assignment, the selected case study is the **Smart Delivery/Route-Planning Agent**. In urban logistics, agents (such as delivery bots or courier vehicles) are tasked with navigating complex city grids to deliver packages from a central depot to multiple customer locations. They must abide by physical constraints (like carrying capacity), optimize their routing to save fuel/time, and adapt dynamically to environmental factors such as weather and traffic conditions.

## 2. Problem Definition
The problem involves a single AI agent operating in a 2D grid world. The agent starts at a designated **Depot** with a specific number of packages (its capacity). It needs to deliver these packages to various **Delivery Locations**. The environment contains **Obstacles** (buildings/walls) and **Traffic Zones** (high-cost roads). 

The goal is to compute an optimal sequence of movements that allows the agent to deliver all packages while minimizing the total path cost. 
The agent faces the following challenges:
- **Navigation:** Finding the shortest path avoiding obstacles.
- **Constraints:** The agent can only carry a fixed number of packages. Once empty, it must return to the Depot to restock before it can fulfill remaining orders.
- **Dynamic Costs:** The cost of traversing cells is not static; it changes based on external weather conditions and traffic density.

## 3. Agent Design
The agent is designed as a goal-based, utility-driven agent.
- **Perception:** The agent perceives the entire grid map, the locations of all delivery points, the depot, obstacles, traffic zones, and the current weather state.
- **State:** The agent's state is defined by `(current_x, current_y)`, `packages_carried` (integer), and `remaining_deliveries` (list of coordinates).
- **Actions:** The agent can move Up, Down, Left, or Right.
- **Goals:** The primary goal is to empty the `remaining_deliveries` list. The sub-goal is to reach the next chosen delivery location or the depot (when restocking is required).

## 4. Environment and State Representation
The environment is a discrete 2D grid `(rows x cols)`. 
Each cell in the grid represents a specific terrain or entity:
- `T_EMPTY`: Normal road (default cost).
- `T_WALL`: Impassable obstacle.
- `T_TRAFFIC`: High congestion road (increased cost).
- `T_START`: The Depot where the agent starts and restocks.
- `T_GOAL`: Active delivery locations.

The State Space consists of the agent's coordinates in the grid. The transitions between states are the 4-directional moves.

## 5. AI Techniques & Knowledge-Based Reasoning
The project employs several AI techniques to fulfill the problem requirements:
- **Search & Optimization:** The A* (A-Star) search algorithm is used for low-level pathfinding.
- **Constraint Satisfaction (CSP):** The carrying capacity constraint is strictly enforced. The agent validates `packagesCarried > 0` before attempting a delivery. If the constraint is violated, the agent's goal temporarily switches to the Depot.
- **Knowledge-Based Reasoning (Forward Chaining):** The agent deduces the cost of traversal (`g(n)`) dynamically using a rule engine. 
  - **Rule 1:** `IF Weather == Clear THEN Cost = Normal (Traffic = 3, Road = 1)`
  - **Rule 2:** `IF Weather == Rain THEN Cost = High (Traffic = 6, Road = 1.5)`
  - **Rule 3:** `IF Weather == Snow THEN Cost = Extreme (Traffic = 8, Road = 3)`
  This logical inference updates the graph edges before path planning occurs.
- **Decision Making:** When multiple deliveries exist, the agent uses a greedy heuristic (closest Manhattan distance) to select the next delivery point.

## 6. Algorithm
The core pathfinding algorithm is **A* Search**, which evaluates nodes using the function `f(n) = g(n) + h(n)`:
- `g(n)`: The accumulated cost from the start node, dynamically calculated via the Forward Chaining rules.
- `h(n)`: The Manhattan distance heuristic, estimating the cost to the goal.

**Pseudocode for the Agent Loop:**
```
WHILE remaining_deliveries IS NOT EMPTY:
    IF packages_carried == 0:
        target = Depot
        path = A_Star(current_pos, target)
        packages_carried = max_capacity
    ELSE:
        target = Get_Closest_Delivery(current_pos, remaining_deliveries)
        path = A_Star(current_pos, target)
        packages_carried -= 1
        REMOVE target FROM remaining_deliveries
        
    Traverse(path)
    Update(total_cost)
    current_pos = target
    
target = Depot
path = A_Star(current_pos, target)
Traverse(path)
```

## 7. Implementation
The solution is implemented as an interactive, browser-based web application using pure HTML, CSS, and Vanilla JavaScript. 
- **HTML/CSS:** Provides a visual dashboard. Users can draw obstacles, paint traffic zones, set delivery points, and toggle agent capacity and weather conditions.
- **JavaScript:** Contains the logic for the Grid model, the Priority Queue for A*, the Forward Chaining rule evaluator, and the asynchronous animation loop that visualizes the agent's search tree and final paths.

## 8. Results & Testing
The agent successfully demonstrates all required capabilities:
- **Pathfinding:** It perfectly avoids walls and finds optimal routes.
- **Constraint Handling:** When capacity is set to 1, and there are 3 deliveries, the agent visually routes from Depot -> Delivery 1 -> Depot -> Delivery 2 -> Depot -> Delivery 3 -> Depot.
- **Dynamic Routing:** When a direct path contains heavy traffic, setting the weather to "Rain" causes the agent to route *around* the traffic to save fuel cost, proving that the knowledge base and A* evaluate dynamic weights correctly.

## 9. Limitations
- **Greedy Decision Making:** The agent chooses the *nearest* delivery point next. While this is fast, it does not guarantee the globally optimal Traveling Salesperson (TSP) route.
- **Static Environment during transit:** The environment (weather/traffic) only affects the agent during the planning phase. If weather changes *while* the agent is moving, it does not currently recalculate mid-route.

## 10. Conclusion
This project successfully applies fundamental AI concepts to a practical case study. By integrating informed search (A*), constraint handling, and logical inference (forward chaining rules) into a single cohesive system, we have built a capable and intelligent Delivery Agent. The visualizer clearly demonstrates how variations in environmental knowledge (weather) and constraints (capacity) directly impact an AI agent's decision-making process and behavior.
