# Module 01 - DFS Thinking

**Pattern:** Depth-First Search  
**Real-world system:** Component Dependency Tracer  
**Seen at:** Webpack · TypeScript Compiler · npm · VS Code

---

## The Big Picture

Every non-trivial codebase is a graph. Components depend on other components, services call other services, modules import other modules. When something breaks, or needs to be refactored, or causes a slow build - the answer is almost always hiding somewhere in that graph.

DFS is the algorithm used to walk that graph. Not as a puzzle, but as the engine behind the tools used every day - webpack's bundle analyzer, TypeScript's incremental compiler, eslint's circular dependency detector. This module builds a working version of that tracer.

---

## File: `core/dependencyTracer.ts`

### Types & Interfaces

```ts
interface GraphNode {
  id: string;
  label: string;
  dependencies: string[];
}
```

The building block. Each node knows its own ID and which other nodes it depends on. This is exactly the structure webpack builds internally when it resolves imports - every file is a node, every `import` statement is an edge.

---

```ts
interface TraversalStep {
  nodeId: string;
  depth: number;
  status: "visiting" | "done" | "circular";
  parentId: string | null;
}
```

Captures not just _what_ was visited but _how_ - depth, parent, and current status. Three statuses map directly to what happens during a real DFS:

| Status     | Meaning                                                         |
| ---------- | --------------------------------------------------------------- |
| `visiting` | Currently on the active path, not yet finished                  |
| `done`     | All dependencies have been fully resolved                       |
| `circular` | Encountered a node already on the active path - this is a cycle |

---

```ts
interface TracerResult {
  traversalOrder: string[];
  steps: TraversalStep[];
  circularDeps: CircularDependency[];
  depths: Record<string, number>;
  totalNodes: number;
  maxDepth: number;
}
```

The full output of a trace run. `traversalOrder` is the sequence nodes were first visited. `steps` is the detailed log that powers the UI's step-by-step replay. `circularDeps` is the list of detected cycles with the full chain of node IDs that form each one.

---

### `traceGraph` - The Core Algorithm

```ts
const visited = new Set<string>();
const inStack = new Set<string>();
```

Two sets, and the distinction between them is the entire algorithm:

- `visited` - fully processed, never revisit
- `inStack` - currently on the active DFS path right now

A node being in `inStack` when encountered _again_ is precisely what a circular dependency looks like. The traversal has looped back to something it hasn't finished yet. This is how `tsc`, `eslint-plugin-import`, and webpack all detect circular deps under the hood.

---

```ts
if (inStack.has(nodeId)) {
  // cycle detected
}
```

When a cycle is found, the cycle chain is reconstructed by slicing the steps array from where the repeated node first appeared. This gives the full path - exactly what webpack prints when it warns `"Critical dependency: the request of a CommonJS require is an expression"` or what TypeScript prints for circular reference errors.

---

```ts
inStack.add(nodeId); // entering
// ... recurse into dependencies
inStack.delete(nodeId); // backtracking
visited.add(nodeId);
```

The enter/backtrack pattern is the heartbeat of DFS. A node is added to `inStack` when first entered, removed when fully resolved. This is what makes it possible to distinguish "currently being explored" from "already explored" - the same logic used in topological sort, which is how build tools determine compilation order.

---

```ts
const stepIndex = steps.findLastIndex(
  (s) => s.nodeId === nodeId && s.status === "visiting",
);
if (stepIndex !== -1) steps[stepIndex].status = "done";
```

When DFS finishes a node, its step is updated from `visiting` to `done`. This lets the UI animate the backtracking phase - the moment DFS finishes exploring a branch and climbs back up. It's what makes DFS visually distinct from BFS and what makes the traversal feel like it's actually exploring a tree.

---

### Preset Graphs

Four realistic graphs are included, each modeled after a real codebase structure:

| Preset                  | Models                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| React Component Tree    | A feature module broken into components, hooks, and utilities     |
| Microservice Call Chain | An API gateway fanning out to downstream services                 |
| Circular Dependency     | A module graph with a cycle - the kind webpack and tsc warn about |
| Webpack Bundle          | An entry point resolving through a realistic bundle tree          |

The circular dependency preset is the most instructive. It produces the exact graph structure that causes webpack's circular dependency warning and TypeScript's slow incremental builds - a chain of modules where one eventually imports something earlier in the chain.

---

## File: `api/routes`

### Three routes:

- `/trace` - the core endpoint. Accepts a graph and start node, runs `traceGraph`, returns the full result including traversal order, steps, circular deps, and depth stats. Stateless - no singleton needed because the tracer is a pure function. Every call is independent, same input always produces same output

- `/presets` - returns metadata only (label, description, node count) for all preset graphs. Keeps the list response lightweight - the full graph data isn't sent until a preset is actually selected.

- `/presets/[key]` - returns the full graph for a specific preset using a dynamic route segment. This is the same pattern used in real APIs when listing resources vs fetching a single resource - index endpoint stays fast, detail endpoint loads on demand.

---

## File: `app/modules/01-dfs-thinking/page.tsx`

- **Lazy preset loading** - presets are fetched on first interaction, not on page load. The full graph data is only fetched when a preset is actually selected. This mirrors how real tools like webpack's bundle analyzer load data - metadata first, detail on demand.

- **Immediate trace on select** - selecting a preset fetches the graph and runs the trace in one flow. No separate "run" button needed since the tracer is deterministic - same graph always produces same result.

- **Step-by-step replay** - the traversal steps can be walked forward and backward manually. The node status map updates in sync with the current replay position, so selecting "Prev" and "Next" shows exactly which nodes were visiting, done, or circular at each point in the traversal. This makes the backtracking behavior of DFS visible in a way that reading code alone cannot.

- **Circular dependency warning** - surfaces at the top of the result when detected, styled as a warning with the full cycle chain. The explanatory note connects it directly to webpack and TypeScript - making it clear this isn't a toy detection, it's the same pattern those tools use.

- **Depth indentation in steps** - each step is indented by its depth level, making the tree structure of the traversal visually obvious. The deeper a node, the further right it appears - mirroring how call stacks and tree diagrams are typically read.

---

## The Key Insight

DFS isn't used at work to solve tree puzzles. It's the traversal strategy underneath every tool that needs to understand structure - build systems, compilers, bundlers, refactoring tools.

The reason it shows up everywhere is the same reason it works: it goes deep before it goes wide. That property - following a path to its end before backtracking - is exactly what's needed when resolving dependencies, detecting cycles, or understanding how a change in one place ripples through a system.

When a senior engineer looks at a tangled module and instinctively starts tracing "this depends on that, which depends on that" - they're running DFS manually. This module just makes that process explicit and visual.

---

## References

- [Webpack - Circular Dependency Detection](https://webpack.js.org/plugins/circular-dependency-plugin/)
- [TypeScript - Project References and Incremental Builds](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [eslint-plugin-import - no-cycle rule](https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md)
- [npm - How require() resolves modules](https://nodejs.org/api/modules.html#all-together)
