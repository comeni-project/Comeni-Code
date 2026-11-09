"""Every problem kit, by the name a problem file gives it (M6.7 spec, M6PR.1). Adding one is a
reviewed change: a module beside these, its schema, and an entry here."""

from collections.abc import Mapping

from code_problems import count_kmers, de_bruijn_edges
from code_problems.kit import Kit

KITS: Mapping[str, Kit] = {kit.name: kit for kit in (de_bruijn_edges.KIT, count_kmers.KIT)}
