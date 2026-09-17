"""The static purity guard, on the real packages and on planted ones (spec P1.4)."""

from pathlib import Path

from guards.purity import ALLOWED, PACKAGES, scan_packages, scan_source

FIXTURES = Path(__file__).parent / "fixtures" / "packages"


def test_pure_packages_import_only_what_they_declare() -> None:
    violations = scan_packages(PACKAGES, ALLOWED)
    assert not violations, "\n".join(map(str, violations))


def test_every_package_is_declared() -> None:
    assert {p.name for p in PACKAGES.iterdir() if p.is_dir()} == set(ALLOWED)


def test_rejects_a_planted_django_import_and_dynamic_import() -> None:
    violations = scan_packages(
        FIXTURES, {"bad-static": frozenset({"importlib"}), "bad-runtime": frozenset({"pathlib"})}
    )
    found = {(v.path.name, v.line, v.what) for v in violations}
    assert found == {
        ("__init__.py", 5, "imports django"),
        ("__init__.py", 7, "calls import_module"),
    }


def test_rejects_an_undeclared_package() -> None:
    violations = scan_packages(FIXTURES, {"bad-static": frozenset({"importlib", "django"})})
    assert [str(v) for v in violations] == [
        f"{FIXTURES / 'bad-runtime'}:0: is not declared in the purity allowlist",
        f"{FIXTURES / 'bad-static'}/src/bad_static/__init__.py:7: calls import_module",
    ]


def test_allows_own_submodules_relative_imports_and_re_compile() -> None:
    source = (
        "from __future__ import annotations\n"
        "import code_schema.nodes\n"
        "from . import links\n"
        "from .links import Link\n"
        "import re\n"
        "PATTERN = re.compile('x')\n"
    )
    violations = scan_source(Path("x.py"), source, "code_schema", frozenset({"__future__", "re"}))
    assert violations == []


def test_rejects_submodule_of_an_allowed_module() -> None:
    violations = scan_source(Path("x.py"), "import os.path\n", "code_schema", frozenset({"os"}))
    assert [v.what for v in violations] == ["imports os.path"]


def test_rejects_dynamic_calls_by_bare_name() -> None:
    source = "__import__('socket')\nexec('x')\neval('1')\ncompile('1', 'f', 'eval')\n"
    violations = scan_source(Path("x.py"), source, "code_schema", frozenset())
    assert [(v.line, v.what) for v in violations] == [
        (1, "calls __import__"),
        (2, "calls exec"),
        (3, "calls eval"),
        (4, "calls compile"),
    ]
