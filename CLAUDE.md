@AGENTS.md

# Nova

Personal AI goal-tracking sidekick. Single user for now. See README.md for the roadmap.

## Conventions

- **All goal logic lives in `src/lib/goals.ts`.** It validates input with zod, keeps steps ordered, and writes a `progress_entries` row whenever a goal's overall % changes. Server actions and Nova's tools (`src/lib/nova/tools.ts`) both call it. Don't write to the goal tables anywhere else.
- **Reading data in pages:** do the work in an async component inside `<Suspense>` that starts with `await connection()`. Cache Components is on, so uncached reads outside Suspense fail the build.
- **Mutations:** server actions in `src/app/actions.ts` call the service, then `refresh()`. Form actions return `FormState`. Client forms use `useFormAction` so a failed submit doesn't clear what the user typed.
- **Next keeps up to 3 visited pages mounted but hidden (React Activity).** Give form ids `useId()` so they stay unique across hidden pages. Reset transient UI (open panels, editors) in a `useLayoutEffect` cleanup, and reset to the initial value, not `false`: Strict Mode runs that cleanup on mount in dev.
- **Schema changes:** edit `src/db/schema.ts`, then run `npm run db:generate`. Migrations apply automatically on `npm run dev` and `npm start`.
- **Nova (Claude) lives in `src/lib/nova/`.** `agent.ts` runs a turn (stream, run tools, loop), `tools.ts` maps each tool onto the goal service, `snapshot.ts` builds the per-turn date and goals system message, and `system-prompt.ts` holds the persona. Model `claude-opus-5-5`, effort `medium`. Use the claude-api skill before changing how the API is called.
- **Chat history is append-only.** `chat_messages` stores API content exactly as sent and received, and it's replayed verbatim. Never edit or reorder stored messages, because Claude's thinking blocks are tied to the history before them. The only removal allowed is a failed newest turn. Changing tools or the system prompt is fine (`drop_block` keeps old chats working, minus their old reasoning), but don't build them per request.
- Tests never call the real API. Use `src/lib/nova/fake-client.ts`.
- Due dates are plain `YYYY-MM-DD` strings. Use the helpers in `src/lib/dates.ts`.
- The runtime is Node 20, so avoid Node 21+ APIs (e.g. `Map.groupBy`).

## Checks

`npm test`, `npm run lint`, `npm run typecheck` and `npm run build` should all pass before committing.

## Before deploying (phase 5)

Server actions and `/api/chat` have no auth yet; they're only safe on localhost. Add sign-in and check the user in every action and route before deploying.
