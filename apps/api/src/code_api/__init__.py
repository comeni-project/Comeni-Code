"""Comeni Code's Django project (architecture spec R2)."""

from code_api.celery import app as celery_app

__all__ = ["celery_app"]
