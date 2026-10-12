# Nova

Your personal AI sidekick for goals big and small. Nova keeps track of your long-term goals, the short-term goals and steps that get you there, and how far along you are. Chat with Nova (powered by Claude) and it updates your goals for you.

## Getting started

Requires Node.js 20.9 or newer.

```bash
npm install
echo "ANTHROPIC_API_KEY=your-key" > .env.local   # from console.anthropic.com
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The database is created and migrated automatically on first run, as a local SQLite file at `data/nova.db`. That file holds your personal data and is never committed.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Apply migrations and start the dev server |
| `npm test` | Run the unit tests (uses a throwaway database) |
| `npm run lint` / `npm run typecheck` | Lint and type-check |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:studio` | Browse the database in Drizzle Studio |

## How it's built

- **Next.js 16** (App Router, Cache Components) + TypeScript + Tailwind CSS
- **SQLite via libSQL + Drizzle ORM**: a local file now, and the same code works with a hosted Turso database later
- **Claude Opus 5.5** via the Anthropic SDK: streamed replies, with tools that create and update goals
- `src/lib/goals.ts` holds all the goal logic (validation, progress, history). Both the UI and Nova's tools go through it.

```
src/
  app/            pages and server actions
  components/     shared UI
  db/             schema and database client
  lib/            goal logic, progress maths, date helpers
  lib/nova/       Nova: the chat loop, tools, system prompt
drizzle/          SQL migrations
```

## Roadmap

1. ✅ **Foundation**: goals, steps, progress bars, history
2. ✅ **Nova chat**: talk to Nova (Claude), which manages your goals for you
3. **Progress & context**: progress charts, and goal changes like a new due date or word count
4. **Memory**: Nova remembers things about you
5. **Deploy**: sign in with Google, use it from your phone
6. **Google Calendar**: deadlines and work sessions on your calendar
