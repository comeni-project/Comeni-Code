"""The JSON API: one NinjaAPI, mounted at /api/ (M0 part 3 spec, P3.2).

Each Django app adds its own Router here. The schema is at /api/openapi.json and the docs page at
/api/docs, in every environment.
"""

from ninja import NinjaAPI

from code_api.health.api import router as health_router

api = NinjaAPI(title="Comeni Code API", version="0.1.0")
api.add_router("/health", health_router)
