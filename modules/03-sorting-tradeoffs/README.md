# Module 03 - Sorting Trade-offs

**Pattern:** Sorting & Trade-offs  
**Real-world system:** Query Optimizer  
**Seen at:** PostgreSQL Query Planner · Database Engines · Data Pipeline Tooling

---

## The Big Picture

No database engine uses the same sort algorithm for every query. The right sort depends on the shape of the data, the size of the dataset, whether stability is required, and how much memory is available. PostgreSQL, MySQL, and SQLite all have internal query planners that make this decision before executing any sort operation.

This module builds a working version of that decision engine. Given a dataset profile and a query type, it recommends the right algorithm, explains why, and runs actual benchmarks across all six algorithms so the trade-offs are visible in real numbers - not just theory.

---

## File: `core/queryOptimizer.ts`

### Types & Interfaces

```ts
type SortAlgorithm =
  | "quicksort"
  | "mergesort"
  | "timsort"
  | "heapsort"
  | "insertion-sort"
  | "counting-sort";
```

Six algorithms, each representing a different trade-off point. Together they cover every major sorting decision a production system makes.

---

```ts
type DataProfile =
  | "random"
  | "nearly-sorted"
  | "reversed"
  | "many-duplicates"
  | "small-dataset";
```

Real database columns have characteristic distributions. A `created_at` column is nearly-sorted. A `status` column with three possible values is many-duplicates. A `uuid` primary key is random. The data profile is the most important input to any sort decision.

---

```ts
type QueryType =
  | "one-time-sort"
  | "repeated-reads"
  | "stream-sort"
  | "stable-required";
```

The query type captures constraints beyond the data itself. `stable-required` means equal elements must preserve their original order - non-negotiable for multi-column ORDER BY. `stream-sort` implies memory constraints. These constraints can override what the data profile alone would suggest.

---

```ts
interface BenchmarkResult {
  algorithm: SortAlgorithm;
  durationMs: number;
  operationCount: number;
  memoryProfile: "in-place" | "extra-space";
  stable: boolean;
  recommended: boolean;
  reason: string;
}
```

The result of actually running an algorithm on real data. `durationMs` and `operationCount` are measured, not estimated. `recommended` flags which algorithm the optimizer chose so the UI can highlight it in context of the full benchmark table.

---

### `ALGORITHM_META`

Static metadata for each algorithm - stability and memory profile. These are fixed properties of the algorithms themselves, not of the data. Stability and memory usage are the two constraints that most often override raw performance in production decisions.

---

### Dataset Builders

```ts
function buildDataset(profile: DataProfile, size: number): number[];
```

Each profile generates a dataset with real structural characteristics:

- `random` - uniformly distributed integers, the baseline case
- `nearly-sorted` - a sorted array with 5% of elements randomly swapped - mirrors a `created_at` column where recent inserts are appended in order
- `reversed` - descending order, quicksort's worst case without randomization
- `many-duplicates` - values drawn from a range of 0–9 regardless of size - mirrors low-cardinality columns like `status` or `country_code`
- `small-dataset` - capped at 20 elements - the regime where constant factors dominate over algorithmic complexity

These aren't toy datasets. They're the distributions that database statisticians actually track in column histograms to inform query planning.

---

### Sort Implementations

All six algorithms are implemented from scratch in TypeScript. The benchmark numbers are real execution times on real arrays - not estimates. This means quicksort on reversed data will genuinely show worse performance than heapsort, and insertion sort on a 20-element array will genuinely beat everything else.

`performance.now()` is used for sub-millisecond precision - the same approach used by benchmark libraries like `benchmark.js` and Node's built-in `perf_hooks`.

---

### Recommendation Engine

```ts
function recommend(dataProfile, queryType, dataSize);
```

A decision tree that mirrors how PostgreSQL's query planner reasons:

| Condition              | Recommended    | Why                                                                                           |
| ---------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| Small dataset (≤ 20)   | insertion-sort | Constant factors dominate at small n. PostgreSQL switches at 16 elements.                     |
| Nearly sorted          | timsort        | Exploits existing runs, approaches O(n). Python and Java's default for this reason.           |
| Many duplicates        | counting-sort  | O(n+k) beats all comparison sorts when value range is small.                                  |
| Stability required     | mergesort      | Only stable O(n log n) sort. Used for multi-column ORDER BY.                                  |
| Reversed data          | heapsort       | Quicksort degrades to O(n²) on reversed input. Heapsort guarantees O(n log n).                |
| Random, no constraints | quicksort      | Best average case, lowest constants, cache-friendly. Default in C, V8, most system libraries. |

---

### `runOptimizer`

The main export. Calls the recommendation engine, runs all six benchmarks, sorts results with the recommended algorithm first, and returns the full result including the trade-off summary. The trade-off summary explains not just what was chosen but what was given up - the cost of the decision, not just the benefit.

---

## File: `api/routes`

- `/optimize` - accepts `dataProfile`, `queryType`, and `dataSize`, runs `runOptimizer`, returns the full result. Stateless - no singleton needed, the optimizer is a pure function.

---

## File: `app/modules/03-sorting-tradeoffs/page.tsx`

- **Profile and query type selectors** - the two selectors mirror the two inputs a database query planner uses: what does the data look like, and what does the query need. Changing either one can flip the recommendation entirely - switching from `random` to `nearly-sorted` changes the recommendation from quicksort to timsort, switching to `stable-required` overrides both and forces mergesort.

- **Run on demand** - unlike the other modules there's no polling. The optimizer is deterministic and stateless - results are computed fresh on each run. Running the same config twice produces slightly different benchmark times, the same way real benchmarks do, because execution time has natural variance.

- **Duration bars** - each algorithm gets a bar proportional to its duration relative to the slowest. Makes the performance gap between algorithms visual rather than just a number. At large data sizes the gap between the recommended algorithm and the worst becomes dramatic.

- **Recommended badge and highlight** - the recommended algorithm is visually distinct in the benchmark table. Seeing it ranked first with real numbers beneath the recommendation text makes the reasoning concrete - not just "timsort is better for this" but "timsort is 3x faster than quicksort on this dataset."

- **Trade-off section** - every recommendation card includes what was given up, not just what was gained. This is the part that separates understanding an algorithm from understanding a decision.

---

## The Key Insight

There is no universally best sorting algorithm. Every algorithm is a trade-off - quicksort wins on random data but loses on adversarial input, timsort wins on structured data but adds memory overhead, counting sort wins on low-cardinality data but is useless on floats or strings.

The sorting trade-off shows up at work not when writing sort functions, but when making decisions: should this pipeline sort in memory or stream-sort to disk? Should this ORDER BY use an index or a full sort? Is this column's cardinality low enough to use a counting approach?

Those decisions follow the same logic as choosing a sort algorithm - profile the data, identify the constraints, pick the trade-off that fits. That's what a query planner does on every query, and that's the thinking this module makes explicit.

---
