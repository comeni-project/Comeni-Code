"""The runtime purity guard, on the real packages and on a planted one (spec P1.4).

In M0 the probe only imports each package. From M2 it must also run a weave.
"""

from pathlib import Path

from guards.purity import ALLOWED, IMPURE_EXIT, import_name, import_under_hook, scan_packages

FIXTURES = Path(__file__).parent / "fixtures" / "packages"


def test_pure_packages_import_without_a_watched_event() -> None:
    result = import_under_hook([import_name(p) for p in sorted(ALLOWED)])
    assert result.returncode == 0, result.stderr


def test_rejects_a_forbidden_call_reached_through_an_allowed_module() -> None:
    result = import_under_hook(["bad_runtime"], [FIXTURES / "bad-runtime" / "src"])
    assert result.returncode == IMPURE_EXIT, result.stderr
    assert "impure: os.system while importing bad_runtime" in result.stderr


def test_the_static_guard_alone_misses_it() -> None:
    violations = scan_packages(
        FIXTURES,
        {"bad-static": frozenset({"importlib", "django"}), "bad-runtime": frozenset({"pathlib"})},
    )
    assert not [v for v in violations if "bad-runtime" in str(v.path)]
