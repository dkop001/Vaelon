// ── Agent Roles ───────────────────────────────────────────────────────────
// Only the Planner remains. CodeGen, Reviewer, and Observer are removed:
//   - CodeGen: merged into Planner (planner includes content in action)
//   - Reviewer: replaced by verifier.rs (build/test/lint/typecheck)
//   - Observer: merged into Worker (observations are ToolCall records in WorldState)

pub mod planner;
