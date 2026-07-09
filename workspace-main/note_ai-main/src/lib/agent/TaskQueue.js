// ── Task Queue ───────────────────────────────────────────────────────────
// Dynamic task queue. Tasks can be added, removed, reordered at any time.

import { ActionType } from './actions.js';

export class TaskQueue {
  constructor() {
    this._tasks = [];
  }

  get length() { return this._tasks.length; }
  get tasks() { return [...this._tasks]; }

  /** Add a task to the end of the queue. */
  append(action) {
    this._tasks.push(action);
  }

  /** Add a task to the front of the queue (for urgent/repair tasks). */
  prepend(action) {
    this._tasks.unshift(action);
  }

  /** Remove and return the next task. Returns null if empty. */
  dequeue() {
    return this._tasks.shift() || null;
  }

  /** Peek at the next task without removing it. */
  peek() {
    return this._tasks[0] || null;
  }

  /** Insert a task after a specific task ID. */
  insertAfter(afterId, action) {
    const idx = this._tasks.findIndex(t => t.id === afterId);
    if (idx === -1) {
      this._tasks.push(action);
    } else {
      this._tasks.splice(idx + 1, 0, action);
    }
  }

  /** Remove a task by ID. */
  remove(taskId) {
    this._tasks = this._tasks.filter(t => t.id !== taskId);
  }

  /** Reorder: move task from index to another index. */
  reorder(fromIdx, toIdx) {
    if (fromIdx < 0 || fromIdx >= this._tasks.length) return;
    if (toIdx < 0 || toIdx >= this._tasks.length) return;
    const [task] = this._tasks.splice(fromIdx, 1);
    this._tasks.splice(toIdx, 0, task);
  }

  /** Clear all tasks. */
  clear() {
    this._tasks = [];
  }

  /** Get remaining task descriptions (for planner context). */
  getSummary(max = 5) {
    return this._tasks.slice(0, max).map(t => `${t.type}: ${t.description}`);
  }

  /** Check if there's any task of a given type. */
  hasType(type) {
    return this._tasks.some(t => t.type === type);
  }

  /** Remove all tasks of a given type (e.g. after repair). */
  removeType(type) {
    this._tasks = this._tasks.filter(t => t.type !== type);
  }
}
