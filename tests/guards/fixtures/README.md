# Purity guard fixtures

These are planted packages that the guards must reject (spec P1.4). They are never installed,
linted or type-checked, and the test process never imports them. `bad_runtime` is imported only
inside the guarded subprocess, which stops before its call runs.
