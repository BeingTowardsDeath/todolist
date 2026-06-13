---
name: strict-frontend-standards
description: >-
  Enforces strict TypeScript, React, state management, styling, structure,
  error handling, and import rules for frontend work. Use when writing or
  reviewing React or Next.js UI, components, hooks, or when the user invokes
  frontend standards or mentions TanStack Query, Zustand, Tailwind, strict TS,
  or accessibility for interactive elements.
---

# Strict Frontend Coding Standards

You must follow strict frontend coding standards.

---

## 1. Language Standards
- Use TypeScript (strict mode enabled)
- Use ES2022+ features
- Prefer async/await over Promise chains
- Avoid var and legacy JavaScript patterns

Allowed patterns:
- arrow functions
- destructuring
- optional chaining
- nullish coalescing

---

## 2. React Standards
- Only functional components (Use standard `function` declarations for components, avoid `React.FC`)
- Prefer Named Exports over Default Exports for better refactoring.
- Hooks-based architecture only
- Extract business logic into custom hooks (Keep components UI-focused)
- Avoid unnecessary useEffect usage
  - DO NOT use useEffect for derived state or data transformations.

---

## 3. State Management Rules
- Server state → TanStack Query
- Client state → Zustand
- Avoid mixing concerns
- Avoid prop drilling beyond 2 levels

---

## 4. TypeScript Rules
- Strict mode required
- No `any` usage (unless explicitly justified with a comment)
- Prefer type inference where obvious
- Use `interface` for component Props and object shapes.
- Use `type` for unions and primitives.

---

## 5. Styling & HTML Rules
- Tailwind CSS is default styling system
- Use a utility like `clsx`/`tailwind-merge` (e.g., a `cn()` utility) for conditional class names instead of raw template literals.
- Avoid inline styles and hardcoded magic values.
- **Accessibility**: Use semantic HTML tags (`<button>`, `<nav>`, `<article>`) instead of generic `<div>`s, and ensure interactive elements are accessible.

---

## 6. Code Structure Rules
- Each file should have a single responsibility
- Functions should be small (< 40 lines preferred)
- Avoid deep nesting (> 3 levels discouraged)
- Keep components modular and composable

---

## 7. Error Handling Rules
- All async operations must handle errors explicitly
- UI must always account for 3 distinct states:
  - Loading state
  - Error state
  - Empty state

---

## 8. Import Rules
- Use path alias (@/)
- Group imports strictly in this order:
  1. React/External libraries
  2. Internal modules (@/...)
  3. Relative imports (./, ../)
- Avoid circular dependencies
