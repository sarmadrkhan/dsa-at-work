export interface GraphNode {
  id: string;
  label: string;
  dependencies: string[]; // ids of nodes this node depends on
}

export interface Graph {
  nodes: GraphNode[];
}

export interface TraversalStep {
  nodeId: string;
  depth: number;
  status: "visiting" | "done" | "circular";
  parentId: string | null;
}

export interface CircularDependency {
  cycle: string[]; // the chain of node ids that form the cycle
}

export interface TracerResult {
  traversalOrder: string[]; // node ids in DFS visit order
  steps: TraversalStep[]; // detailed step-by-step trace
  circularDeps: CircularDependency[];
  depths: Record<string, number>; // nodeId -> depth in traversal
  totalNodes: number;
  maxDepth: number;
}

// --- Core DFS Traversal ---
export function traceGraph(graph: Graph, startNodeId: string): TracerResult {
  const nodeMap = new Map<string, GraphNode>();
  graph.nodes.forEach((n) => nodeMap.set(n.id, n));

  const visited = new Set<string>();
  const inStack = new Set<string>(); // tracks current DFS path for cycle detection
  const traversalOrder: string[] = [];
  const steps: TraversalStep[] = [];
  const circularDeps: CircularDependency[] = [];
  const depths: Record<string, number> = {};

  function dfs(nodeId: string, depth: number, parentId: string | null) {
    // Cycle detected - this node is already in the current DFS path
    if (inStack.has(nodeId)) {
      const cycleStart = steps.findIndex((s) => s.nodeId === nodeId);
      const cycle = steps.slice(cycleStart).map((s) => s.nodeId);
      cycle.push(nodeId); // close the loop

      circularDeps.push({ cycle });
      steps.push({ nodeId, depth, status: "circular", parentId });
      return;
    }

    // Already fully visited via another path - skip
    if (visited.has(nodeId)) return;

    // Mark as in current path
    inStack.add(nodeId);
    depths[nodeId] = depth;
    traversalOrder.push(nodeId);
    steps.push({ nodeId, depth, status: "visiting", parentId });

    const node = nodeMap.get(nodeId);
    if (node) {
      for (const depId of node.dependencies) {
        dfs(depId, depth + 1, nodeId);
      }
    }

    // Done with this node - remove from current path
    inStack.delete(nodeId);
    visited.add(nodeId);

    // Update step status to done
    const stepIndex = steps.findLastIndex(
      (s) => s.nodeId === nodeId && s.status === "visiting",
    );
    if (stepIndex !== -1) steps[stepIndex].status = "done";
  }

  dfs(startNodeId, 0, null);

  return {
    traversalOrder,
    steps,
    circularDeps,
    depths,
    totalNodes: traversalOrder.length,
    maxDepth: Math.max(...Object.values(depths), 0),
  };
}

// --- Preset Graphs ---
// These are realistic dependency graphs modeled after real codebases

export const PRESET_GRAPHS: Record<
  string,
  { label: string; description: string; graph: Graph; startNodeId: string }
> = {
  react_component_tree: {
    label: "React Component Tree",
    description:
      "A typical feature module broken into components, hooks, and utilities",
    startNodeId: "dashboard",
    graph: {
      nodes: [
        {
          id: "dashboard",
          label: "Dashboard",
          dependencies: ["statsPanel", "activityFeed", "useAuth"],
        },
        {
          id: "statsPanel",
          label: "StatsPanel",
          dependencies: ["useStats", "chart"],
        },
        {
          id: "activityFeed",
          label: "ActivityFeed",
          dependencies: ["useActivity", "listItem"],
        },
        { id: "useAuth", label: "useAuth()", dependencies: ["apiClient"] },
        { id: "useStats", label: "useStats()", dependencies: ["apiClient"] },
        {
          id: "useActivity",
          label: "useActivity()",
          dependencies: ["apiClient"],
        },
        { id: "chart", label: "Chart", dependencies: ["utils"] },
        { id: "listItem", label: "ListItem", dependencies: ["utils"] },
        { id: "apiClient", label: "apiClient", dependencies: ["config"] },
        { id: "utils", label: "utils", dependencies: [] },
        { id: "config", label: "config", dependencies: [] },
      ],
    },
  },

  microservice_calls: {
    label: "Microservice Call Chain",
    description: "An API gateway fanning out to downstream services",
    startNodeId: "gateway",
    graph: {
      nodes: [
        {
          id: "gateway",
          label: "API Gateway",
          dependencies: ["authService", "orderService"],
        },
        {
          id: "authService",
          label: "Auth Service",
          dependencies: ["userService", "tokenStore"],
        },
        {
          id: "orderService",
          label: "Order Service",
          dependencies: ["inventoryService", "paymentService"],
        },
        { id: "userService", label: "User Service", dependencies: ["db"] },
        { id: "tokenStore", label: "Token Store", dependencies: ["cache"] },
        {
          id: "inventoryService",
          label: "Inventory Service",
          dependencies: ["db"],
        },
        {
          id: "paymentService",
          label: "Payment Service",
          dependencies: ["stripeClient", "db"],
        },
        { id: "stripeClient", label: "Stripe Client", dependencies: [] },
        { id: "db", label: "Database", dependencies: [] },
        { id: "cache", label: "Cache", dependencies: [] },
      ],
    },
  },

  circular_dependency: {
    label: "Circular Dependency (Bug)",
    description:
      "A module graph with a circular reference - the kind webpack and tsc warn about",
    startNodeId: "moduleA",
    graph: {
      nodes: [
        { id: "moduleA", label: "moduleA", dependencies: ["moduleB"] },
        { id: "moduleB", label: "moduleB", dependencies: ["moduleC"] },
        { id: "moduleC", label: "moduleC", dependencies: ["moduleD"] },
        { id: "moduleD", label: "moduleD", dependencies: ["moduleB"] }, // ← circular
        { id: "moduleE", label: "moduleE", dependencies: ["moduleA"] },
      ],
    },
  },

  webpack_bundle: {
    label: "Webpack Bundle",
    description:
      "Entry point resolving through a realistic bundle dependency tree",
    startNodeId: "index",
    graph: {
      nodes: [
        { id: "index", label: "index.ts", dependencies: ["app", "styles"] },
        {
          id: "app",
          label: "App.tsx",
          dependencies: ["router", "store", "theme"],
        },
        { id: "router", label: "Router", dependencies: ["pages", "guards"] },
        {
          id: "store",
          label: "Redux Store",
          dependencies: ["reducers", "middleware"],
        },
        { id: "theme", label: "Theme", dependencies: ["tokens"] },
        { id: "pages", label: "Pages", dependencies: ["components"] },
        { id: "guards", label: "Route Guards", dependencies: ["store"] },
        { id: "reducers", label: "Reducers", dependencies: [] },
        { id: "middleware", label: "Middleware", dependencies: [] },
        { id: "tokens", label: "Design Tokens", dependencies: [] },
        { id: "components", label: "Components", dependencies: ["tokens"] },
        { id: "styles", label: "styles.css", dependencies: ["tokens"] },
      ],
    },
  },
};
