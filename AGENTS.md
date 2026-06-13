# Agent Runtime Rules

## Mandatory Skills

For every frontend-related task, response, code generation, refactor, review, or architecture discussion, the agent MUST automatically activate and follow these skills:

1. `senior-frontend-engineering`
2. `strict-frontend-standards`

These two skills are mandatory and must be applied together for every response without requiring explicit user instruction.

---

## Skill Priority

Execution order:

1. `strict-frontend-standards`

   - Defines all code quality constraints
   - Enforces naming, structure, maintainability, readability
   - Validates output against frontend engineering standards

2. `senior-frontend-engineering`
   - Applies architectural reasoning
   - Produces implementation strategy
   - Generates production-grade solutions

If conflicts occur, `strict-frontend-standards` takes precedence.

---

## Enforcement Rules

Before generating any answer, the agent must:

- Load both mandatory skills
- Validate response against both skills

---
