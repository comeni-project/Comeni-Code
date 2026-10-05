"""Django settings. Values that differ between environments come from `Env`; nothing else does.

M0 part 2 spec, P2.3.
"""

from code_api.config.auth import github_providers, mailers
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
    # Accounts (M4.3 spec, M4A.3): allauth, headless, with GitHub as its one provider.
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.github",
    "allauth.headless",
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
    "allauth.account.middleware.AccountMiddleware",
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
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

# allauth, headless and browser-only (M4A.3): its JSON API at /_allauth/browser/v1/, none of its
# HTML pages, and redirects back to the web app, whose screens arrive in M4.8.
HEADLESS_ONLY = True
HEADLESS_CLIENTS = ("browser",)
HEADLESS_FRONTEND_URLS = {
    "account_signup": f"{ENV.web_origin}/join",
    "socialaccount_login_error": f"{ENV.web_origin}/sign-in/error",
}
# Where invite links point (M4A.2).
CODE_WEB_ORIGIN = ENV.web_origin
# Sign-up only through an invite (M4A.2); the invite's link proved the address, so no second
# verification mail is sent.
ACCOUNT_ADAPTER = "code_api.accounts.adapter.AccountAdapter"
ACCOUNT_EMAIL_VERIFICATION = "none"
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*"]
SOCIALACCOUNT_PROVIDERS = github_providers(ENV)

# The session and CSRF cookies (M4A.3): HttpOnly, Lax, two weeks; Secure on a hosted stack.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_AGE = 14 * 24 * 60 * 60
CSRF_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = ENV.secure_cookies
CSRF_COOKIE_SECURE = ENV.secure_cookies
CSRF_TRUSTED_ORIGINS = [ENV.web_origin]

# Mail: the console unless an SMTP host is set.
MAILERS = mailers(ENV)
DEFAULT_FROM_EMAIL = ENV.email_from
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

# The content folder `manage.py rebuild_index` reads; `--root` overrides it (M1P6.2).
CODE_CONTENT_ROOT = ENV.content_root

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
