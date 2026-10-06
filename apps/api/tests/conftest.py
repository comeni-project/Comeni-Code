"""Shared for the API's tests."""

from collections.abc import Callable, Iterator

import pytest
from django.core.cache import cache
from django.test import override_settings

from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.studio import drafts
from code_api.studio.models import Draft
from code_schema import Level, Resource
from code_schema.edits import set_resources

LOCAL_CACHE = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}


@pytest.fixture(autouse=True)
def _a_cache_per_test() -> Iterator[None]:
    """allauth's rate limits live in the cache. Settings put it in Redis, shared by every worker
    (#161); a test gets its own empty one, so no run's counts reach another."""
    with override_settings(CACHES=LOCAL_CACHE):
        cache.clear()
        yield


# ── Review (M4.5): three members and a draft ready to submit ─────────────────────────────────────


@pytest.fixture
def ada() -> User:
    return User.objects.create_user("ada@example.org", role=Role.AUTHOR)


@pytest.fixture
def grace() -> User:
    return User.objects.create_user("grace@example.org", role=Role.REVIEWER)


@pytest.fixture
def otto() -> User:
    return User.objects.create_user("otto@example.org", role=Role.OPERATOR)


READING = Resource(
    kind="reading",
    provider="openstax",
    url="https://openstax.org/books/biology-2e/pages/17-1",
    covers="How fragments are read from transcripts.",
    licence="CC BY 4.0",
    display="link",
    level=Level.FOUNDATIONS,
)


@pytest.fixture
def ready() -> Callable[[User], Draft]:
    """TPM's draft at revision 2, with a resource, so its checklist passes; TPM's index must be
    built. Its questions are TPM's exam pool of four, and no try questions."""

    def make(by: User) -> Draft:
        draft = drafts.open_existing("tpm", by=by)
        drafts.save(
            draft, based_on=1, edit=lambda n: set_resources(n, [READING]), by=by, change="r"
        )
        return draft

    return make
