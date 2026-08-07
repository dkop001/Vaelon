// ── Task Graph ──────────────────────────────────────────────────────────
// DAG-based task management. Replaces the flat VecDeque<Action> queue.
// Planner only expands nodes. Scheduler picks the next task deterministically.

use crate::agent::actions::{Action, ToolResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum TaskStatus {
    Waiting,
    Running,
    Blocked,
    Finished,
    Failed,
    Cancelled,
}

impl TaskStatus {
    pub fn is_terminal(&self) -> bool {
        matches!(self, TaskStatus::Finished | TaskStatus::Failed | TaskStatus::Cancelled)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskNode {
    pub id: String,
    pub parent_id: Option<String>,
    pub children: Vec<String>,
    pub description: String,
    pub status: TaskStatus,
    pub priority: i32,
    pub dependencies: Vec<String>,
    pub action: Option<Action>,
    pub result: Option<ToolResult>,
    pub created_at: String,
    pub updated_at: String,
}

impl TaskNode {
    pub fn new(description: impl Into<String>, priority: i32) -> Self {
        let ts = now_str();
        Self {
            id: Uuid::new_v4().to_string(),
            parent_id: None,
            children: vec![],
            description: description.into(),
            status: TaskStatus::Waiting,
            priority,
            dependencies: vec![],
            action: None,
            result: None,
            created_at: ts.clone(),
            updated_at: ts,
        }
    }

    /// Depth in the graph (length of parent chain).
    pub fn depth(&self, graph: &TaskGraph) -> usize {
        let mut d = 0;
        let mut current = self.parent_id.as_deref();
        while let Some(pid) = current {
            d += 1;
            current = graph.nodes.get(pid).and_then(|n| n.parent_id.as_deref());
        }
        d
    }
}

pub struct TaskGraph {
    nodes: HashMap<String, TaskNode>,
    root: Option<String>,
}

impl TaskGraph {
    pub fn new() -> Self {
        Self { nodes: HashMap::new(), root: None }
    }

    /// Add a root task.
    pub fn add_root(&mut self, description: impl Into<String>) -> String {
        let node = TaskNode::new(description, 0);
        let id = node.id.clone();
        self.nodes.insert(id.clone(), node);
        self.root = Some(id.clone());
        id
    }

    /// Add a child task under a parent.
    pub fn add_child(&mut self, parent_id: &str, description: impl Into<String>, priority: i32) -> Option<String> {
        let parent = self.nodes.get_mut(parent_id)?;
        let mut child = TaskNode::new(description, priority);
        let child_id = child.id.clone();
        child.parent_id = Some(parent_id.to_string());
        child.dependencies.push(parent_id.to_string());
        parent.children.push(child_id.clone());
        self.nodes.insert(child_id.clone(), child);
        Some(child_id)
    }

    /// Add a dependency between existing tasks.
    pub fn add_dependency(&mut self, task_id: &str, depends_on: &str) -> bool {
        if let Some(node) = self.nodes.get_mut(task_id) {
            if !node.dependencies.contains(&depends_on.to_string()) {
                node.dependencies.push(depends_on.to_string());
            }
            true
        } else {
            false
        }
    }

    /// Get a task node by ID.
    pub fn get(&self, id: &str) -> Option<&TaskNode> {
        self.nodes.get(id)
    }

    /// Get mutable reference to a task node.
    pub fn get_mut(&mut self, id: &str) -> Option<&mut TaskNode> {
        self.nodes.get_mut(id)
    }

    /// Set task status.
    pub fn set_status(&mut self, id: &str, status: TaskStatus) {
        if let Some(node) = self.nodes.get_mut(id) {
            node.status = status;
            node.updated_at = now_str();
        }
    }

    /// Set task action.
    pub fn set_action(&mut self, id: &str, action: Action) {
        if let Some(node) = self.nodes.get_mut(id) {
            node.action = Some(action);
            node.updated_at = now_str();
        }
    }

    /// Set task result.
    pub fn set_result(&mut self, id: &str, result: ToolResult) {
        if let Some(node) = self.nodes.get_mut(id) {
            node.result = Some(result);
            node.updated_at = now_str();
        }
    }

    /// Get all nodes with a given status.
    pub fn nodes_with_status(&self, status: TaskStatus) -> Vec<&TaskNode> {
        self.nodes.values().filter(|n| n.status == status).collect()
    }

    /// Count nodes with a given status.
    pub fn count_status(&self, status: TaskStatus) -> usize {
        self.nodes.values().filter(|n| n.status == status).count()
    }

    /// Check if all tasks are done.
    pub fn is_complete(&self) -> bool {
        self.nodes.values().all(|n| n.status.is_terminal())
    }

    /// Check if all tasks finished successfully.
    pub fn is_success(&self) -> bool {
        self.nodes.values().all(|n| matches!(n.status, TaskStatus::Finished))
    }

    /// Get tasks that are ready to run (Waiting with all deps satisfied).
    pub fn ready_tasks(&self) -> Vec<&TaskNode> {
        let mut ready: Vec<&TaskNode> = self.nodes.values()
            .filter(|n| n.status == TaskStatus::Waiting)
            .filter(|n| {
                n.dependencies.iter().all(|dep| {
                    self.nodes.get(dep).map(|d| d.status == TaskStatus::Finished).unwrap_or(false)
                })
            })
            .collect();
        ready.sort_by(|a, b| {
            b.priority.cmp(&a.priority)
                .then_with(|| a.depth(self).cmp(&b.depth(self)))
        });
        ready
    }

    /// Check if graph is empty (no tasks at all).
    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    /// Get the root node ID.
    pub fn root_id(&self) -> Option<&str> {
        self.root.as_deref()
    }

    /// Get all todo descriptions (waiting + running).
    pub fn todo_descriptions(&self) -> Vec<String> {
        self.nodes.values()
            .filter(|n| matches!(n.status, TaskStatus::Waiting | TaskStatus::Running | TaskStatus::Blocked))
            .map(|n| n.description.clone())
            .collect()
    }

    /// Get all completed descriptions.
    pub fn completed_descriptions(&self) -> Vec<String> {
        self.nodes.values()
            .filter(|n| matches!(n.status, TaskStatus::Finished))
            .map(|n| n.description.clone())
            .collect()
    }

    /// Get all failed descriptions.
    pub fn failed_descriptions(&self) -> Vec<String> {
        self.nodes.values()
            .filter(|n| matches!(n.status, TaskStatus::Failed))
            .map(|n| n.description.clone())
            .collect()
    }
}

// ── Scheduler (deterministic, no LLM) ───────────────────────────────────

pub struct Scheduler;

impl Scheduler {
    /// Pick the next task to execute.
    /// Returns None if no tasks are ready.
    pub fn next_task(graph: &TaskGraph) -> Option<TaskNode> {
        graph.ready_tasks().first().cloned().cloned()
    }
}

fn now_str() -> String {
    chrono::Utc::now().naive_utc().format("%Y-%m-%dT%H:%M:%S").to_string()
}
