"""Who may use a Studio route, and what learners need (spec M4A.3, M4A.4). Needs Postgres.

The gated routes here are mounted only by this module's own URL configuration, so no throwaway
route ships in the API.
"""

from pathlib import Path

import pytest
from django.test import Client, override_settings
from django.urls import path
from ninja import NinjaAPI

from code_api.accounts.access import install_access_handlers, studio
from code_api.accounts.models import User
from code_api.accounts.roles import Role
from code_api.content.index import rebuild_index

pytestmark = pytest.mark.django_db

FIXTURES = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "salmon"

gated = NinjaAPI(urls_namespace="access-test")
install_access_handlers(gated)


@gated.get("/review", auth=studio(Role.REVIEWER))
def review_get(request: object) -> dict[str, str]:
    return {"ok": "yes"}


@gated.post("/review", auth=studio(Role.REVIEWER))
def review_post(request: object) -> dict[str, str]:
    return {"ok": "yes"}


urlpatterns = [path("gated/", gated.urls)]
on_gated_routes = override_settings(ROOT_URLCONF=__name__)


def member(role: str, email: str = "member@example.org") -> User:
    return User.objects.create_user(email, role=role)


@on_gated_routes
def test_nobody_signed_in_is_401(client: Client) -> None:
    response = client.get("/gated/review")
    assert response.status_code == 401
    assert response.json()["code"] == "CA0101"


@on_gated_routes
def test_a_lower_role_is_403(client: Client) -> None:
    client.force_login(member(Role.AUTHOR))
    response = client.get("/gated/review")
    assert response.status_code == 403
    assert response.json() == {
        "detail": "This needs the reviewer role or above; you are an author.",
        "code": "CA0102",
    }


@on_gated_routes
@pytest.mark.parametrize("role", [Role.REVIEWER, Role.OPERATOR])
def test_the_role_or_above_passes(client: Client, role: Role) -> None:
    client.force_login(member(role))
    assert client.get("/gated/review").status_code == 200


@on_gated_routes
def test_a_member_with_no_role_is_403(client: Client) -> None:
    client.force_login(member(""))
    assert client.get("/gated/review").json()["code"] == "CA0102"


@on_gated_routes
def test_a_write_needs_the_csrf_token() -> None:
    client = Client(enforce_csrf_checks=True)
    client.force_login(member(Role.REVIEWER))
    assert client.post("/gated/review").status_code == 403
    token = "a" * 32  # Django accepts a 32-character secret in the cookie and the header alike
    client.cookies["csrftoken"] = token
    assert client.post("/gated/review", headers={"X-CSRFToken": token}).status_code == 200


@on_gated_routes
def test_a_deactivated_members_session_stops_working(client: Client) -> None:
    user = member(Role.OPERATOR)
    client.force_login(user)
    assert client.get("/gated/review").status_code == 200
    user.is_active = False
    user.save()
    assert client.get("/gated/review").status_code == 401


def test_me_is_null_for_nobody(client: Client) -> None:
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"user": None}


def test_me_names_the_signed_in_member(client: Client) -> None:
    user = User.objects.create_user("ada@example.org", name="Ada", role=Role.AUTHOR)
    client.force_login(user)
    assert client.get("/api/me").json() == {
        "user": {
            "public_id": str(user.public_id),
            "email": "ada@example.org",
            "name": "Ada",
            "role": "author",
        }
    }


@pytest.mark.parametrize(
    "url",
    [
        "/api/health",
        "/api/nodes/tpm",
        "/api/routes?goal=salmon",
        "/api/search?q=tpm",
    ],
)
def test_learner_routes_need_no_account(client: Client, url: str) -> None:
    rebuild_index(FIXTURES)
    assert client.get(url).status_code not in (401, 403)


@on_gated_routes
def test_a_signed_out_write_is_401_not_a_csrf_403() -> None:
    # #161: the sign-in check comes before CSRF, so the web app reads "sign in", not "forbidden".
    response = Client(enforce_csrf_checks=True).post("/gated/review")
    assert (response.status_code, response.json()["code"]) == (401, "CA0101")


def test_the_cache_is_redis() -> None:
    # #161: allauth's rate limits count across every worker, so the cache is shared. Tests run
    # on a local-memory cache (conftest.py), so one run's rate limits never reach the next.
    from code_api.config.auth import caches
    from code_api.config.env import Env

    cache = caches(Env())["default"]
    assert cache["BACKEND"] == "django.core.cache.backends.redis.RedisCache"
    assert cache["LOCATION"] == Env().redis_url.get_secret_value()


def test_a_write_through_the_stacks_origin_passes_csrf() -> None:
    # #163: behind nginx the Host carries the port, and the browser's Origin matches it.
    client = Client(enforce_csrf_checks=True)
    client.force_login(member(Role.OPERATOR))
    client.cookies["csrftoken"] = "a" * 32
    response = client.post(
        "/api/team/invites",
        {"email": "new@example.org", "role": "author"},
        content_type="application/json",
        headers={"X-CSRFToken": "a" * 32, "Origin": "http://127.0.0.1:8090"},
        HTTP_HOST="127.0.0.1:8090",
    )
    assert response.status_code == 201


def test_https_is_read_from_the_proxy() -> None:
    from django.conf import settings

    assert settings.SECURE_PROXY_SSL_HEADER == ("HTTP_X_FORWARDED_PROTO", "https")


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("get", "/api/team/members"),
        ("get", "/api/team/invites"),
        ("post", "/api/team/invites"),
        ("patch", "/api/team/members/00000000-0000-0000-0000-000000000000"),
        ("post", "/api/team/members/00000000-0000-0000-0000-000000000000/deactivate"),
        ("delete", "/api/team/invites/00000000-0000-0000-0000-000000000000"),
    ],
)
def test_every_studio_route_is_401_signed_out(client: Client, method: str, url: str) -> None:
    # Spec M4A.5, #163.
    response = getattr(client, method)(url, content_type="application/json")
    assert (response.status_code, response.json()["code"]) == (401, "CA0101")
