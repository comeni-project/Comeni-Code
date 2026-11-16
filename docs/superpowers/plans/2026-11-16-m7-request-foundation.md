# M7.1 implementation plan

1. Record the revised milestone order and M7's parts.
2. Write behavior tests for human-only decisions, version conflicts, merge/decline/snooze
   validation, terminal states and audit records.
3. Add request and decision records with public IDs and database uniqueness constraints.
4. Implement transactional intake and decision services; generate the migration.
5. Run focused tests, lint, formatting, types and migration consistency checks.
6. Journal the result and open a PR stacked on M5.5. Leave it open.

Next: specify and build M7.2's HTTP intake and S7 page against the Requests board.
