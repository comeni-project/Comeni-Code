# M4.1.3 — refactor before exam pools

**Status: agreed 2026-10-05.** A third substep of M4.1 (#119), issue #138, done before M4.2 (exam
pools). The operator asked for a quality review of the codebase on 2026-10-05, agreed the findings
below in conversation, and handed the spec, plan and build to the agent as mechanical work; the
agent made the calls marked *ruling*. No learner-visible behaviour changes except the defects it
fixes: #137 and three minors from #134.

It decides:

- how a nested entry in `node.yaml` is read (M4R.1);
- the shape of a try question (M4R.2);
- where the body's blocks come from on a `Node` (M4R.3);
- how the content views read the index (M4R.4);
- how the web app asks the API (M4R.5).

---

## M4R.1 One reader for nested entries

`links.py`, `resources.py` and `questions.py` each read a list of mappings, and each repeats the same
work by hand. Each one checks that the field is a list and not empty, checks that every entry is a
mapping, flags unknown keys, flags missing keys, runs a value check, and finds the line to report.
`questions.py` has a fourth copy for options. M4.2 adds exam questions, which would be a fifth.

**`code_schema.records`** holds that mechanism once:

- `entries(value, …)` checks the list itself (not a list, empty, an entry that is not a mapping) and
  yields each mapping.
- `Entry` is one mapping and the problems found in it. It knows its own lines, records problems
  against its field, and flags whether it is still sound. It has a method for each step: unknown
  keys, a missing key, and a value check worded for its place.

Each parser keeps its own rules, in order, as code: which key ends an entry when it is wrong, which
kind refuses which key, a hint that gives the answer away. **Messages, codes, lines and the order of
problems do not change.** The tests that pin them are the guard.

*Ruling.* A fully declarative table (keys, checks, per-kind refusals, early stops) was the first idea
in conversation. It is rejected because the rules that differ between parsers are ordered and
conditional, and a table that holds them becomes a small language that is harder to read than the
code it replaces. Pydantic or another schema library is also rejected: it cannot report the line of
a key, and the wording of each message is part of the product (M1P1.5).

## M4R.2 A question is a choice or a number

`Question` is one class with fields that are valid only for one kind. It has `options` for a choice,
and `answer`, `unit` and `tolerance` for a number. So a choice can carry an `answer` that no one
reads. It becomes **`ChoiceQuestion | NumberQuestion`**, a union the way `Block` is, each with a
`kind` class constant, so `question.kind` still reads `"choice"` or `"number"`. Exam questions in
M4.2 extend the same union. The index row and the API's `QuestionOut` keep their flat shapes.
Those shapes are a table and a wire format, and a choice already sends `answer: null`.

## M4R.3 A node's blocks come from its body

`Node.blocks` is a field that `parse_node` fills, so a `Node` built by hand can hold blocks its body
does not have (#134). It becomes a **cached property derived from `body`**: the blocks `parse_blocks`
reads. `parse_node` refuses any body with a problem, so for every `Node` it returns, the property is
the whole truth. Equality still compares the body alone.

## M4R.4 The content views read through one module

The node, route and search views each query, assemble their answer and decide their errors in one
function. The "never built → 503, else 404" decision is written three times, and `routes.py` and
`search.py` import shared schemas from the node view's module.

- **`content/schemas.py`** holds every response schema. Views import from it, not from each other.
- **`content/reads.py`** holds the queries and the assembly: one node with its neighbours, the
  weaver's graph, and the search rows. It also holds **`unbuilt()`**, the 503 or nothing, and
  **`missing(detail)`**, the 503 or a 404.
- **Blocks have one codec, in `code_schema.blocks`**: `block_json` and `block_from_json`, inverses
  of each other. The index writes with the first; the API reads with the second, so a stored kind it
  does not know raises instead of being drawn as a callout (the old `case _:`).
- **`CalloutBlockOut.callout` is a `Literal` of the three kinds** (#134).
- **The `Node.body` column is dropped.** Since M4.1.2 it has been written and never read; `blocks`
  is the body in the index. The files keep `body.md`, and the digest still hashes it.

*Rejected:* a repository class or service objects. Plain functions in one module give M4.4 the one
place to add drafts, without ceremony.

## M4R.5 The web app asks the API in one way

- **`api/queries.ts`** has one key factory and the hooks `useNode`, `useRoute` and `useSearch`. The
  route key holds goals and known as separate lists, so two different routes never share a cache
  entry. The Start page and the Route page used key shapes that collided: Start's goals *salmon*
  and *kallisto* matched the Route page's goal *salmon* with *kallisto* known (#137). Start's preview
  is the route with nothing known, so it now shares that entry on purpose.
- **`url.ts`** holds `useRouteParams()` (goals and known, read from the URL) and `withRoute`,
  which moves out of `node/embed.ts`.
- **One error sentence**, `sentenceOf` in `api/client.ts`, replaces three copies. It is drawn by one
  `ErrorNotice` wherever the same paragraph was written out.
- **Health uses the one client.** `getJson` takes the statuses that carry a body (`503` for health),
  and `HealthUnreachable` gives way to `ApiUnreachable`. The page's sentences stay as they are.
- **`Body`'s keys say what they key**: `text:<n>`, `callout:<n>` and `try:<id>`, so a question
  whose id is `2` cannot collide with the third block's index (#134).

*Rejected:* a global store, or a generated client. TanStack Query is already the store, and three
fetchers do not justify a generator.

## Not in this part

These come from #134 and wait for the editor (M4.4): the MyST spelling variants, try-id shapes for
direct callers, Markdoc inside callouts, `splitlines` on rare separators, the missing tests, the
backticks in CS0405, and the web scanner's three edge cases. The whole-index load per request (M2P4.3)
is not touched.
