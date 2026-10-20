---
name: task-file
description: Write or update a task file in .claude/tasks/ before any code. Use when starting a build step, when the owner asks for a plan or "the task", or when a step's status changes.
---

# Task files

One file per build step: `.claude/tasks/NNN_name.md`, NNN = the step number in the RFC's Build order, name in kebab-case. The RFC is the what and why; the task file is the how. Written before code, reviewed by the owner, then built.

## Shape

```markdown
# Task NNN — Title

**Status: planned YYYY-MM-DD, waiting on the owner's review.**

## The goal
One or two lines. Link the RFC section / Build order step.

## The plan
Numbered steps. Files and commands named exactly.

## Owner's part
What only the owner can click (Cloudflare, Infisical, Supabase, dashboards). Never assume it was done.

## Open questions
Only if a decision is needed. Otherwise leave the section out.

## Done when
Checks anyone can verify.

## Not in this task
What belongs to a later step.
```

## Rules

- **Short.** Plain sentences, no padding. Only what is needed to review and build it.
- **The status line is always current:** planned → approved → in progress → done (date, PR, what was verified). Update it as work moves.
- **Never invent scope.** Anything the owner did not ask for is marked as a suggestion they can strike out.
- **Found something mid-build?** Add it to the file and tell the owner before changing course.
- When a step is done, tick it in the RFC's Build order with the date.
