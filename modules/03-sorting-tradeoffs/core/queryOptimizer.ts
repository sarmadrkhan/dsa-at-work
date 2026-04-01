export type SortAlgorithm =
  | "quicksort"
  | "mergesort"
  | "timsort"
  | "heapsort"
  | "insertion-sort"
  | "counting-sort";

export type DataProfile =
  | "random"
  | "nearly-sorted"
  | "reversed"
  | "many-duplicates"
  | "small-dataset";

export type QueryType =
  | "one-time-sort"
  | "repeated-reads"
  | "stream-sort"
  | "stable-required";

export interface BenchmarkResult {
  algorithm: SortAlgorithm;
  durationMs: number;
  operationCount: number;
  memoryProfile: "in-place" | "extra-space";
  stable: boolean;
  recommended: boolean;
  reason: string;
}

export interface OptimzerInput {
  dataProfile: DataProfile;
  queryType: QueryType;
  dataSize: number;
}

export interface OptimizerResult {
  input: OptimzerInput;
  recommendation: SortAlgorithm;
  recommendationReason: string;
  benchmarks: BenchmarkResult[];
  tradeoffSummary: string;
}

// --- Algorithm metadata ---
type AlgorithmMeta = {
  stable: boolean;
  memoryProfile: "in-place" | "extra-space";
  description: string;
};

const ALGORITHM_META: Record<SortAlgorithm, AlgorithmMeta> = {
  quicksort: {
    stable: false,
    memoryProfile: "in-place",
    description:
      "Fast average case, unstable, in-place. Default in most runtimes.",
  },
  mergesort: {
    stable: true,
    memoryProfile: "extra-space",
    description:
      "Stable, predictable O(n log n). Used when order of equal elements matters.",
  },
  timsort: {
    stable: true,
    memoryProfile: "extra-space",
    description:
      "Hybrid merge+insertion. Exploits existing order. Default in Python and Java.",
  },
  heapsort: {
    stable: false,
    memoryProfile: "in-place",
    description:
      "Guaranteed O(n log n), in-place. Used when memory is constrained.",
  },
  "insertion-sort": {
    stable: true,
    memoryProfile: "in-place",
    description:
      "O(n) on nearly-sorted data. Best for small or almost-sorted datasets.",
  },
  "counting-sort": {
    stable: true,
    memoryProfile: "extra-space",
    description:
      "O(n+k) for integer data with small range. Used in radix sort pipelines.",
  },
};

// --- Simulate sorting a dataset and return duration ---
function simulateSort(
  algorithm: SortAlgorithm,
  dataProfile: DataProfile,
  dataSize: number,
): { durationMs: number; operationCount: number } {
  // Build a dataset matching the profile
  const data = buildDataset(dataProfile, dataSize);
  const arr = [...data];

  const start = performance.now();
  let operationCount = 0;

  switch (algorithm) {
    case "quicksort":
      operationCount = quicksort(arr, 0, arr.length - 1);
      break;
    case "mergesort":
      operationCount = mergesort(arr);
      break;
    case "timsort":
      // JS native sort is timsort under the hood
      arr.sort((a, b) => a - b);
      operationCount = Math.round(dataSize * Math.log2(dataSize || 1));
      break;
    case "heapsort":
      operationCount = heapsort(arr);
      break;
    case "insertion-sort":
      operationCount = insertionSort(arr);
      break;
    case "counting-sort":
      operationCount = countingSort(arr);
      break;
  }

  const durationMs = Math.max(0.01, performance.now() - start);
  return { durationMs: Math.round(durationMs * 100) / 100, operationCount };
}

// --- Dataset builders ---
function buildDataset(profile: DataProfile, size: number): number[] {
  switch (profile) {
    case "random":
      return Array.from({ length: size }, () =>
        Math.floor(Math.random() * size),
      );
    case "nearly-sorted": {
      const arr = Array.from({ length: size }, (_, i) => i);
      // Swap ~5% of elements
      const swaps = Math.floor(size * 0.05);
      for (let i = 0; i < swaps; i++) {
        const a = Math.floor(Math.random() * size);
        const b = Math.floor(Math.random() * size);
        [arr[a], arr[b]] = [arr[b], arr[a]];
      }
      return arr;
    }
    case "reversed":
      return Array.from({ length: size }, (_, i) => size - i);
    case "many-duplicates":
      return Array.from({ length: size }, () => Math.floor(Math.random() * 10));
    case "small-dataset":
      return Array.from({ length: Math.min(size, 20) }, () =>
        Math.floor(Math.random() * 100),
      );
  }
}

// --- Sort implementations ---
function quicksort(arr: number[], low: number, high: number): number {
  let ops = 0;
  if (low < high) {
    const pivot = arr[high];
    let i = low - 1;
    for (let j = low; j < high; j++) {
      ops++;
      if (arr[j] <= pivot) {
        i++;
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
    const pi = i + 1;
    ops += quicksort(arr, low, pi - 1);
    ops += quicksort(arr, pi + 1, high);
  }
  return ops;
}

function mergesort(arr: number[]): number {
  let ops = 0;
  if (arr.length <= 1) return ops;

  const mid = Math.floor(arr.length / 2);
  const left = arr.slice(0, mid);
  const right = arr.slice(mid);

  ops += mergesort(left);
  ops += mergesort(right);

  let i = 0,
    j = 0,
    k = 0;
  while (i < left.length && j < right.length) {
    ops++;
    if (left[i] <= right[j]) arr[k++] = left[i++];
    else arr[k++] = right[j++];
  }
  while (i < left.length) arr[k++] = left[i++];
  while (j < right.length) arr[k++] = right[j++];

  return ops;
}

function heapsort(arr: number[]): number {
  let ops = 0;
  const n = arr.length;

  const heapify = (arr: number[], n: number, i: number) => {
    let largest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    ops++;
    if (l < n && arr[l] > arr[largest]) largest = l;
    if (r < n && arr[r] > arr[largest]) largest = r;
    if (largest !== i) {
      [arr[i], arr[largest]] = [arr[largest], arr[i]];
      heapify(arr, n, largest);
    }
  };

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) heapify(arr, n, i);
  for (let i = n - 1; i > 0; i--) {
    [arr[0], arr[i]] = [arr[i], arr[0]];
    heapify(arr, i, 0);
  }

  return ops;
}

function insertionSort(arr: number[]): number {
  let ops = 0;
  for (let i = 1; i < arr.length; i++) {
    const key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
      ops++;
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = key;
  }
  return ops;
}

function countingSort(arr: number[]): number {
  let ops = 0;
  if (arr.length === 0) return ops;
  const max = Math.max(...arr);
  const count = new Array(max + 1).fill(0);
  arr.forEach((n) => {
    count[n]++;
    ops++;
  });
  let idx = 0;
  count.forEach((c, n) => {
    while (c-- > 0) {
      arr[idx++] = n;
      ops++;
    }
  });
  return ops;
}

// --- Recommendation engine ---
function recommend(
  dataProfile: DataProfile,
  queryType: QueryType,
  dataSize: number,
): { algorithm: SortAlgorithm; reason: string; tradeoffSummary: string } {
  if (dataProfile === "small-dataset" || dataSize <= 20) {
    return {
      algorithm: "insertion-sort",
      reason:
        "Small datasets have negligible sort cost. Insertion sort has the lowest overhead and is optimal under ~20 elements - this is why most standard libraries switch to it for small partitions.",
      tradeoffSummary:
        "For small n, constant factors dominate over algorithmic complexity. O(n²) with tiny constants beats O(n log n) with large ones.",
    };
  }

  if (dataProfile === "nearly-sorted") {
    return {
      algorithm: "timsort",
      reason:
        "Nearly-sorted data has existing runs that Timsort exploits directly, approaching O(n) in the best case. This is exactly why Python and Java chose Timsort as their default - real-world data is rarely fully random.",
      tradeoffSummary:
        "Timsort degrades gracefully on random data but excels on structured data. The right choice when the data has any existing order.",
    };
  }

  if (dataProfile === "many-duplicates") {
    return {
      algorithm: "counting-sort",
      reason:
        "When the value range is small (many duplicates implies few distinct values), counting sort runs in O(n+k) - faster than any comparison-based sort. Used in database engines for low-cardinality columns.",
      tradeoffSummary:
        "Counting sort trades memory (the count array) for speed. Only viable when the value range k is not much larger than n.",
    };
  }

  if (queryType === "stable-required") {
    return {
      algorithm: "mergesort",
      reason:
        "Stability is required - equal elements must preserve their original order. Mergesort is the canonical stable O(n log n) sort. Used in database ORDER BY with multiple columns.",
      tradeoffSummary:
        "Stability costs extra memory (O(n) auxiliary space) but is non-negotiable when sort order of equal elements carries meaning.",
    };
  }

  if (dataProfile === "reversed") {
    return {
      algorithm: "heapsort",
      reason:
        "Reversed data is quicksort's worst case without randomization - it degrades to O(n²). Heapsort guarantees O(n log n) regardless of input shape and is in-place.",
      tradeoffSummary:
        "Heapsort's guaranteed worst case makes it the safe choice for adversarial or unknown input distributions.",
    };
  }

  // Default: random data, no special constraints
  return {
    algorithm: "quicksort",
    reason:
      "Random data with no stability requirement - quicksort's average O(n log n) with low constant factors and in-place operation makes it the default choice. This is why C's qsort, V8's Array.sort (for large arrays), and most system libraries default to quicksort variants.",
    tradeoffSummary:
      "Quicksort wins on random data due to cache locality and low overhead, but requires randomization to avoid O(n²) worst case on sorted or adversarial input.",
  };
}

// --- Main export ---
export function runOptimizer(input: OptimzerInput): OptimizerResult {
  const { dataProfile, queryType, dataSize } = input;
  const algorithms: SortAlgorithm[] = [
    "quicksort",
    "mergesort",
    "timsort",
    "heapsort",
    "insertion-sort",
    "counting-sort",
  ];

  const {
    algorithm: recommended,
    reason,
    tradeoffSummary,
  } = recommend(dataProfile, queryType, dataSize);

  const benchmarks: BenchmarkResult[] = algorithms.map((algo) => {
    const { durationMs, operationCount } = simulateSort(
      algo,
      dataProfile,
      dataSize,
    );
    const meta = ALGORITHM_META[algo];
    return {
      algorithm: algo,
      durationMs,
      operationCount,
      memoryProfile: meta.memoryProfile,
      stable: meta.stable,
      recommended: algo === recommended,
      reason: meta.description,
    };
  });

  // Sort benchmarks: recommended first, then by duration
  benchmarks.sort((a, b) => {
    if (a.recommended) return -1;
    if (b.recommended) return 1;
    return a.durationMs - b.durationMs;
  });

  return {
    input,
    recommendation: recommended,
    recommendationReason: reason,
    benchmarks,
    tradeoffSummary,
  };
}
