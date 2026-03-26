# Problem: Task Scheduler with Cooldown

## Difficulty: Medium

## The Real-World Connection

Before looking at this problem, think about what the retry queue does - it processes
jobs but respects a concurrency limit, and when a job fails it waits (cooldown) before
trying again. This problem captures that same mechanic: tasks that can't run back to back
without a gap.

This is the exact pattern behind:

- CPU task schedulers in operating systems
- Job queues with cooldown periods (Sidekiq, BullMQ)
- Rate-limited retry systems

---

## Problem Statement

Given a list of tasks represented by characters, and a non-negative integer `n`
representing the cooldown period between two identical tasks - find the minimum
number of intervals (time units) needed to finish all tasks.

The CPU can either:

- Execute a task
- Stay idle

Between two executions of the **same** task, there must be at least `n` intervals.

---

## Examples

**Example 1:**

```
Input:  tasks = ["A","A","A","B","B","B"], n = 2
Output: 8
Explanation: A -> B -> idle -> A -> B -> idle -> A -> B
```

**Example 2:**

```
Input:  tasks = ["A","A","A","B","B","B"], n = 0
Output: 6
Explanation: No cooldown needed. A -> A -> A -> B -> B -> B
```

**Example 3:**

```
Input:  tasks = ["A","A","A","A","B","C","D"], n = 3
Output: 10
Explanation: A -> B -> C -> D -> A -> idle -> idle -> A -> idle -> idle -> A
```

---

## Constraints

- `1 <= tasks.length <= 10^4`
- `tasks[i]` is an uppercase English letter
- `0 <= n <= 100`

---

## Hints

1. Which task should always be scheduled first?
2. The most frequent task determines the minimum length of the schedule
3. Think about how many idle slots are created by the most frequent task
4. What happens when other tasks fill those idle slots?

---

## What to implement

```ts
function leastInterval(tasks: string[], n: number): number {
  // solution here
}
```
