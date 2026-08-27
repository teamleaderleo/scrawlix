# Agent work continuity

Scrawlix benefits from long, self-directed implementation runs once the maintainer has given a clear objective or said to continue.

Coding agents should keep advancing through useful, reviewable work for the duration of the current run instead of treating the first green test, commit, or pull request as an automatic stopping point.

Good continuation signals include:

- an open issue or release checklist still has concrete unchecked work;
- CI exposes another actionable failure or edge case;
- a completed slice naturally reveals a narrow follow-up that can be implemented and tested safely;
- documentation, browser regressions, packaging, compatibility, or release polish still lag behind implemented behavior;
- a review uncovers a reproducible race, lifecycle problem, accessibility issue, or permission problem that can be isolated into its own change.

Prefer to keep working when the next action is clear. Use focused branches, tests, issues, and pull requests to keep a long run reviewable instead of stopping merely to report progress.

A long run should stop when it reaches a genuine human decision, an unavailable credential or external action, a safety/privacy boundary that needs explicit approval, irreducible ambiguity about product intent, or a point where further work would be speculative churn.

Do not promise background or asynchronous work. This guidance applies to sustained work performed during the active agent run.
