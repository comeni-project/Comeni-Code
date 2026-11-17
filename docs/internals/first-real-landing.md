# First real landing (#324)

M4 closes when a node written or reviewed by the operator goes through Studio's draft, checks,
review and landing flow, then appears to learners through the content follower. M6 and M5 supply
the required editors and AI drafting. This is an acceptance walk with real content.

## Setup

1. Select an operator-authored or operator-reviewed draft. Record its node ID and draft ID.
   Existing walk drafts and fixture nodes are not evidence of reviewed content.
2. Restore local configuration in the ignored `.env`, using `.env.example` for setting names.
   Preserve the database's existing secret and settings encryption keys. Set the three
   `CODE_GITHUB_APP_*` settings together and verify `CODE_CONTENT_REPOSITORY`. Keep secrets out
   of the journal and command output.
3. Rebuild the stack from the M5.5 branch (which contains the complete M5 implementation):

   ```sh
   docker compose up -d --build --wait
   ```

   Confirm that API, worker and beat use the new API image and migrations have completed.
   The application PRs remain open under the current instruction; using their branch locally
   does not require merging them.
4. In Studio Models, verify the drafting and assistant configuration with a real model. Live
   ChatGPT sign-in remains waived; another configured connection can supply the model.
5. Follow the real content repository before authoring against its index:

   ```sh
   docker compose exec api python apps/api/manage.py rebuild_index
   ```

   Confirm Studio's index source and commit refer to the real content repository. Record the
   commit. Do not use a fixture folder for this walk.

## Walk

1. Open the chosen draft in Studio and inspect the teaching content, supported blocks, resources,
   figures and questions that the page needs. Exercise AI drafting and compare its proposal;
   record a human Keep or Discard. Generated text needs human review before publication.
2. Run the draft checks and resolve errors through the normal editors. Follow the rules in
   [walking.md](walking.md) for defects or rules that block the scenario.
3. Submit the current revision. Complete Review, including the required question answers and
   verdicts. Use a separate reviewer, or the supported operator self-approval with an explicit
   reason. Record the approved revision and reviewer decision.
4. In Land, inspect the selected draft's files and dependency requirements. Include every
   required approved draft in the batch. Confirm the operator has reviewed the exact content
   about to reach the real content repository.
5. Start the landing through Studio. Record its ID, content pull request URL and commit.
   Studio requests auto-merge for content PRs; initiating this action can publish the content.
6. Wait for the content PR to merge and the follower to apply its commit. Studio must show the
   landing as landed and the index at a commit containing it. If beat is unavailable, the
   `rebuild_index` command above invokes the same follower once.
7. Open `/node/<node-id>` as a signed-out learner and confirm the reviewed page appears. Exercise
   its resources, interactive blocks and questions, and confirm search and a route can find it.

## Evidence and completion

Record the application commit, node/draft IDs, reviewed revision, AI proposal outcome, review
decision, landing ID, content PR, merged commit, applied index commit and learner URL in a journal
entry. Include browser width/theme and any findings. Close #324 and its remaining parent gates
only after the real learner-visible result is observed.

## Read-only preflight on 2026-11-16

- The stack at `http://127.0.0.1:8090` is healthy but uses images from before M5 completion.
- The API reports no GitHub App configured. The workspace has no `.env`; `.env.walk-aside` was
  left untouched.
- The latest applied index has 26 nodes, source `folder`, and an empty commit: fixture state.
- Existing drafts include walk/test records and an approved TPM draft. No draft has been
  selected by the operator as the real landing candidate.
- Execution awaits the operator's content choice and restored landing configuration.
