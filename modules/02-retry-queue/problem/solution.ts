/**
 * Task Scheduler with Cooldown
 *
 * Approach: Greedy - frequency counting
 *
 * Key insight: The most frequent task defines the skeleton of the schedule.
 * Idle slots exist because we must wait `n` intervals before repeating it.
 * Other tasks fill those idle slots. If there are enough tasks to fill all
 * idle slots, no idling is needed at all.
 *
 * This is identical to how a retry queue works:
 * - The "cooldown" is the backoff delay
 * - "Idle slots" are the gaps where the worker is waiting to retry
 * - Other tasks filling idle slots = other jobs running during the backoff window
 */
function leastInterval(tasks: string[], n: number): number {
  // Step 1 - Count frequency of each task
  const freq = new Map<string, number>();
  for (const task of tasks) {
    freq.set(task, (freq.get(task) ?? 0) + 1);
  }

  // Step 2 - Find the highest frequency
  const maxFreq = Math.max(...freq.values());

  // Step 3 - Count how many tasks share the max frequency
  // These all need the same number of slots
  let maxCount = 0;
  for (const count of freq.values()) {
    if (count === maxFreq) maxCount++;
  }

  // Step 4 - Calculate minimum intervals
  //
  // The most frequent task creates (maxFreq - 1) "chunks" of work,
  // each chunk being (n + 1) slots wide (the task itself + n cooldown slots).
  // The last chunk only needs maxCount slots (no trailing cooldown needed).
  //
  // Visual for tasks = [A,A,A,B,B,B], n = 2:
  //   [ A B _ ] [ A B _ ] [ A B ]
  //     chunk1    chunk2   last
  //
  // Formula: (maxFreq - 1) * (n + 1) + maxCount
  //
  // But if we have so many varied tasks that they fill all idle slots,
  // the answer is simply tasks.length (no idle time needed at all)
  const chunks = (maxFreq - 1) * (n + 1) + maxCount;
  return Math.max(chunks, tasks.length);
}

// --- Tests ---
console.log(leastInterval(["A", "A", "A", "B", "B", "B"], 2)); // 8
console.log(leastInterval(["A", "A", "A", "B", "B", "B"], 0)); // 6
console.log(leastInterval(["A", "A", "A", "A", "B", "C", "D"], 3)); // 10
