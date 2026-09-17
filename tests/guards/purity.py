"""The two purity guards (M0 part 1 spec, P1.4).

Pure packages import no Django, no HTTP client and no model library. Neither guard proves that
alone. The static scan reads every line, but it cannot follow an allowed module to a forbidden
one (`pathlib.os.system`). The runtime probe catches that, but it only sees the code it runs.
The honest claim is their union.
"""

import ast
import os
import subprocess
import sys
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PACKAGES = ROOT / "packages"

# Closed allowlists: a package may import exactly these modules, plus its own submodules.
# Adding one is a reviewed change to this file.
ALLOWED: Mapping[str, frozenset[str]] = {
    "code-schema": frozenset({"__future__", "typing"}),
    "code-weaver": frozenset({"__future__", "typing"}),
}

# Called by bare name, these run code or import a module named at runtime.
_DYNAMIC_NAMES = frozenset({"__import__", "exec", "eval", "compile"})
# Called as an attribute. `compile` is left out: `re.compile` is ordinary.
_DYNAMIC_ATTRIBUTES = frozenset({"__import__", "exec", "eval", "import_module"})


@dataclass(frozen=True)
class Violation:
    path: Path
    line: int
    what: str

    def __str__(self) -> str:
        return f"{self.path}:{self.line}: {self.what}"


def import_name(package: str) -> str:
    """`code-schema` is imported as `code_schema`."""
    return package.replace("-", "_")


def scan_source(path: Path, source: str, own: str, allowed: frozenset[str]) -> list[Violation]:
    """Every import outside `allowed` and every dynamic call, in one file."""
    found: list[Violation] = []

    def check(module: str, line: int) -> None:
        if module.split(".")[0] != own and module not in allowed:
            found.append(Violation(path, line, f"imports {module}"))

    for node in ast.walk(ast.parse(source, filename=str(path))):
        if isinstance(node, ast.Import):
            for alias in node.names:
                check(alias.name, node.lineno)
        elif isinstance(node, ast.ImportFrom):
            if node.level == 0 and node.module is not None:
                check(node.module, node.lineno)
        elif isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Name) and func.id in _DYNAMIC_NAMES:
                found.append(Violation(path, node.lineno, f"calls {func.id}"))
            elif isinstance(func, ast.Attribute) and func.attr in _DYNAMIC_ATTRIBUTES:
                found.append(Violation(path, node.lineno, f"calls {func.attr}"))
    return found


def scan_packages(packages: Path, allowed: Mapping[str, frozenset[str]]) -> list[Violation]:
    """The static guard over a `packages/` directory. An undeclared package is a violation."""
    found: list[Violation] = []
    for package in sorted(p for p in packages.iterdir() if p.is_dir()):
        if package.name not in allowed:
            found.append(Violation(package, 0, "is not declared in the purity allowlist"))
            continue
        for path in sorted((package / "src").rglob("*.py")):
            found += scan_source(
                path, path.read_text(), import_name(package.name), allowed[package.name]
            )
    return found


# Audit events a pure package must never raise: network, process execution, foreign calls.
WATCHED = frozenset(
    {
        "urllib.Request",
        "subprocess.Popen",
        "os.system",
        "os.exec",
        "os.posix_spawn",
        "os.fork",
        "os.forkpty",
        "ctypes.dlopen",
        "ctypes.dlsym",
        "ctypes.call_function",
        "ctypes.cdata",
    }
)
WATCHED_PREFIXES = ("socket.",)
IMPURE_EXIT = 3

# This runs in a fresh interpreter, because an audit hook cannot be removed once installed. It
# exits with `os._exit` rather than raising, so guarded code cannot catch its way past the hook.
_PROBE = """
import os, sys
exit_code = int(sys.argv[1])
watched = frozenset(sys.argv[2].split(","))
prefixes = tuple(sys.argv[3].split(","))
current = "<start>"
def hook(event, args):
    if event in watched or event.startswith(prefixes):
        sys.stderr.write(f"impure: {event} while importing {current}\\n")
        sys.stderr.flush()
        os._exit(exit_code)
sys.addaudithook(hook)
for current in sys.argv[4:]:
    __import__(current)
"""


def import_under_hook(
    modules: Sequence[str], search_path: Sequence[Path] = ()
) -> subprocess.CompletedProcess[str]:
    """The runtime guard: import `modules` in a subprocess that exits on any watched event."""
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(str(p) for p in search_path)
    return subprocess.run(
        [
            sys.executable,
            "-c",
            _PROBE,
            str(IMPURE_EXIT),
            ",".join(sorted(WATCHED)),
            ",".join(WATCHED_PREFIXES),
            *modules,
        ],
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
        check=False,
    )
