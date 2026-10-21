"""Comeni Code's figure components (M6.4 spec, M6FG.2). Pure: no web framework, HTTP client or
model library. A figure is a component filled with data; this package says what each component's
data may hold, checks it, and computes what the page draws but nobody writes."""

from code_figures.findings import Finding
from code_figures.registry import CODES, COMPONENTS, Component, derived, figure_findings

__all__ = ["CODES", "COMPONENTS", "Component", "Finding", "derived", "figure_findings"]
