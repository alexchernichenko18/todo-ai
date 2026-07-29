# StudyPath

An AI learning planner. You keep track of what you are studying; the app breaks
learning goals into steps and suggests literature for each of them.

## Features

- Manual study tasks with subject, target date and study steps
- **AI recommendations** — next study steps derived from your history, plus a
  recommended reading list
- **Plan a goal** — a free-text learning goal becomes a structured study task
  with steps and reading; non-learning goals are declined
- **Library** — every saved book, course and article in one place, with a read
  marker
- Drag-and-drop ordering, light/dark theme, data persisted in `localStorage`

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OPENAI_API_KEY` | no | — | Enables real AI responses. Without it the app falls back to a built-in mock provider, so every feature stays demonstrable offline. |
| `OPENAI_MODEL` | no | `gpt-4o-mini` | Model used for both AI features. |

Put them in `.env.local`.

## Suggested links

AI-produced URLs are sanitized server-side in `lib/ai/resources.ts`: books never
carry a link, and every other link must be `https` on a domain from an explicit
allowlist. Anything else keeps the title and drops the link.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `@base-ui/react`,
OpenAI SDK, Vitest, Playwright.
