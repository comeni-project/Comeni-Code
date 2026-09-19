"""Django settings. Values that differ between environments come from `Env`; nothing else does.

M0 part 2 spec, P2.3.
"""

from code_api.config.env import Env, database_from_url
from code_api.health.heartbeat import HEARTBEAT_INTERVAL_SECONDS

ENV = Env()

SECRET_KEY = ENV.secret_key.get_secret_value()
DEBUG = ENV.debug
ALLOWED_HOSTS = ENV.allowed_hosts

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    # Part 3 serves the API docs page from Ninja's bundled files, which needs staticfiles.
    "django.contrib.staticfiles",
    # Ninja in INSTALLED_APPS serves the docs page from its bundled files, not a CDN (part 2, P2.5).
    "ninja",
    "code_api.accounts",
    "code_api.content",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Serves /static/ with DEBUG off, so the API docs page loads in every environment.
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "code_api.config.urls"
WSGI_APPLICATION = "code_api.config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
            ],
        },
    },
]

DATABASES = {"default": database_from_url(ENV.database_url.get_secret_value())}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = ENV.static_root

# Celery (M0 part 4 spec, P4.2). No result backend: nothing reads task results yet.
CELERY_BROKER_URL = ENV.redis_url.get_secret_value()
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
CELERY_TASK_IGNORE_RESULT = True
CELERY_TIMEZONE = TIME_ZONE
# Autodiscovery searches INSTALLED_APPS only; task modules outside a Django app are named here, or a
# worker rejects their tasks as unregistered (found by hand in the part 4 scratch build).
CELERY_IMPORTS = ("code_api.health.tasks",)
CELERY_BEAT_SCHEDULE = {
    "health-heartbeat": {
        "task": "code_api.health.tasks.heartbeat",
        "schedule": HEARTBEAT_INTERVAL_SECONDS,
    },
}
