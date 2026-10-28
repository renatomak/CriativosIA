<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls go through `src/lib/ai.server.ts` (Claude via Lovable AI Gateway, JSON-schema output) and are invoked only from authenticated server functions in `src/lib/creatives.functions.ts`; every call is logged to `ai_usage` and checked against the monthly budget — why: keep keys server-side and track cost per creative.
