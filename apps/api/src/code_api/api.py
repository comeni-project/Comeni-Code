"""The JSON API: one NinjaAPI, mounted at /api/ (M0 part 3 spec, P3.2).

Each Django app adds its own Router here. The schema is at /api/openapi.json and the docs page at
/api/docs, in every environment.
"""

from ninja import NinjaAPI

from code_api.accounts.access import install_access_handlers
from code_api.accounts.api import router as accounts_router
from code_api.content.api import router as content_router
from code_api.content.routes import router as routes_router
from code_api.content.search import router as search_router
from code_api.health.api import router as health_router
from code_api.studio.api import router as studio_router
from code_api.studio.landing_api import router as landing_router

api = NinjaAPI(title="Comeni Code API", version="0.1.0")
install_access_handlers(api)
api.add_router("", accounts_router)
api.add_router("/health", health_router)
api.add_router("/nodes", content_router)
api.add_router("/routes", routes_router)
api.add_router("/search", search_router)
api.add_router("/studio/drafts", studio_router)
api.add_router("/studio/landings", landing_router)
