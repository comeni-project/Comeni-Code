"""URL routes. Part 3 mounts the API here."""

from django.urls import URLPattern, URLResolver, path

from code_api.api import api

urlpatterns: list[URLPattern | URLResolver] = [path("api/", api.urls)]
