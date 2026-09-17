"""The Celery app. Worker: `celery -A code_api worker`; beat: `celery -A code_api beat`."""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "code_api.config.settings")

app = Celery("code_api")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
