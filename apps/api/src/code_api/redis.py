"""One Redis client for the app, with short timeouts so health fails fast (P4.3)."""

from functools import cache

from django.conf import settings
from redis import Redis


@cache
def client() -> Redis:
    return Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2, socket_timeout=2)
