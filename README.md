# dsa-at-work

> How the CS fundamentals actually show up in real codebases.

A collection of real systems I've encountered in industry, each one tracing back to a core CS pattern. Every module is a working implementation with the algorithm made explicit - not as a puzzle, but as the foundation of something that runs in production.

---

## 🧭 Project Philosophy

Every module here:

- Is **production-quality code** you could extract and drop into a real project
- Has an **interactive UI** that shows the system behaving under real conditions
- Has a **README** that connects the CS pattern to where you'd actually see it - at companies like Amazon, Stripe, or Netflix

---

## 🛠️ Stack

| Layer     | Tech                                 |
| --------- | ------------------------------------ |
| Framework | Next.js 14 (App Router)              |
| Language  | TypeScript                           |
| Styling   | Tailwind CSS                         |
| State     | React hooks (no external lib needed) |
| Backend   | Next.js API Routes                   |
| Storage   | In-memory (no DB required)           |
| Testing   | Vitest                               |

> **Why no database?** Keeping it in-memory means anyone can clone and run instantly. The focus is the algorithm and the system design, not infra setup.

---

## 🗺️ Modules Roadmap

### Module 01 - DFS Thinking

**Real-world system:** Component Dependency Tracer  
**What it does:** Takes a JSON dependency graph (like a webpack bundle or React tree), runs DFS, detects circular dependencies, and shows traversal order  
**Where you see this at work:** Refactoring large components, build tooling, microservice tracing

**Core code deliverable:** `dependencyTracer.ts` - a utility that accepts a graph and returns traversal path, circular dep warnings, and depth stats

---

### Module 02 - Queue Design

**Real-world system:** HTTP Retry Queue with exponential backoff  
**What it does:** Fires batches of API calls (some fail randomly), queues retries with backoff, tracks dead-letter jobs, shows live metrics  
**Where you see this at work:** Every resilient microservice, AWS SQS, Stripe webhook retries

**Core code deliverable:** `retryQueue.ts` - production-ready retry queue with concurrency control, backoff strategy, dead-letter queue, and drain-on-shutdown

---

### Module 03 - Sorting Trade-offs

**Real-world system:** Query Optimizer  
**What it does:** Given a dataset + query type, recommends and benchmarks which sort algorithm fits, shows actual perf numbers  
**Where you see this at work:** Database query planners, data pipeline optimization

**Core code deliverable:** `queryOptimizer.ts` - evaluates data shape and recommends sort strategy with benchmarks

---

### Module 04 - Hashmap Everywhere

**Real-world system:** LRU Cache with TTL  
**What it does:** In-memory cache layer with configurable size, TTL, eviction policy, hit/miss stats  
**Where you see this at work:** Redis conceptually, CDN edge caching, memoization layers

**Core code deliverable:** `lruCache.ts` - drop-in LRU cache with TTL, eviction hooks, and observable stats

---

### Module 05 - Sliding Window

**Real-world system:** API Rate Limiter  
**What it does:** Sliding window log rate limiter on an API route, shows allowed/rejected requests over time  
**Where you see this at work:** GitHub API, Stripe, AWS - every public API uses this

**Core code deliverable:** `rateLimiter.ts` - sliding window rate limiter you could wrap any API route with

---

## ✅ Build Checklist

### 🏗️ Phase 0 - Project Setup

- [x] Init Next.js 14 project with TypeScript + Tailwind
- [x] Build dashboard/home page with module cards
- [x] Set up Vitest

---

### 📦 Module 01 - DFS Thinking

- [x] `dependencyTracer.ts` core logic
- [x] Circular dep detection
- [x] API route + UI

---

### 📦 Module 02 - Retry Queue (First)

**Core logic**

- [x] `retryQueue.ts` - base queue class with enqueue/dequeue
- [x] Add exponential backoff strategy
- [x] Add max retry limit + dead-letter queue
- [x] Add concurrency control (max N in-flight)
- [x] Add drain() for graceful shutdown

**API Route**

- [x] `POST /api/modules/retry-queue/fire` - fires a batch of jobs (configurable fail rate)
- [x] `GET /api/modules/retry-queue/status` - returns live queue state

**UI**

- [x] Controls panel (batch size, fail rate, max retries, concurrency limit)
- [x] Live job board - shows each job: pending / in-flight / retrying / done / dead
- [x] Metrics panel - success rate, avg retries, throughput, dead-letter count
- [x] Visual backoff timeline per job

- [x] `modules/02-retry-queue/README.md` - production context + DSA breakdown

---

### 📦 Module 03 - Sorting Trade-offs

- [x] `queryOptimizer.ts` core logic
- [x] Benchmarking harness
- [x] API route + UI

---

### 📦 Module 04 - Hashmap / LRU Cache

- [x] `lruCache.ts` core logic
- [x] TTL + eviction
- [x] API route + UI

---

### 📦 Module 05 - Sliding Window Rate Limiter

- [x] `rateLimiter.ts` core logic
- [x] API route integration
- [x] UI

---

### 🎨 Phase Final - Polish

- [ ] Consistent design system across all module UIs
- [ ] Mobile responsive
- [ ] Each module README links to real-world references (Stripe docs, AWS docs, etc.)
- [ ] Root README polished with screenshots/gifs
- [ ] Deploy to Vercel

---

## 🚀 Getting Started

```bash
git clone https://github.com/yourusername/dsa-at-work
cd dsa-at-work
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📚 The Idea

CS fundamentals don't show up at work as textbook problems. They show up as the thinking underneath every resilient, well-designed system. This repo documents that connection - one real system at a time.

> _"You don't implement a queue. But you design with queues."_

---
