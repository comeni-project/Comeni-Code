"""Shared for the API's tests."""

from collections.abc import Iterator

import pytest
from django.core.cache import cache
from django.test import override_settings

LOCAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@pytest.fixture(autouse=True)
def _a_cache_per_test() -> Iterator[None]:
    """allauth's rate limits live in the cache. Settings put it in Redis, shared by every worker
    (#161); a test gets its own empty one, so no run's counts reach another."""
    with override_settings(CACHES=LOCAL_CACHE):
        cache.clear()
        yield
