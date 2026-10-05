"""URL routes. Part 3 mounts the API here; M4.3 mounts allauth under one prefix (M4A.3).

Everything allauth serves sits under /_allauth/, so the dev proxy and nginx forward one path: its
headless JSON API, and the provider callbacks (GitHub's) that live in `allauth.urls`.
"""

from django.urls import URLPattern, URLResolver, include, path

from code_api.api import api

urlpatterns: list[URLPattern | URLResolver] = [
    path("api/", api.urls),
    path("_allauth/accounts/", include("allauth.urls")),
    path("_allauth/", include("allauth.headless.urls")),
]
