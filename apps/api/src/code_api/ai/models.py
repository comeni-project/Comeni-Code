"""Connections, a setting per call site, and the record of every call (M5.1 spec, M5G.3–M5G.6)."""

from django.conf import settings
from django.db import models
from django.db.models import Q


class Connection(models.Model):
    """Where models come from. One ChatGPT plan per installation: LiteLLM keeps one token file per
    folder, and the folder is process-wide (M5G.4)."""

    KINDS = [
        ("chatgpt", "ChatGPT plan"),
        ("self-hosted", "Self-hosted"),
        ("hosted", "A hosted provider"),
    ]

    name = models.TextField(unique=True)
    kind = models.TextField(choices=KINDS)
    endpoint = models.TextField(blank=True, default="")  # self-hosted
    key_sealed = models.BinaryField(null=True, blank=True)  # hosted; Fernet (secrets.py)
    key_last4 = models.TextField(blank=True, default="")
    models_listed = models.JSONField(default=list)  # the last Test's model list
    tested_at = models.DateTimeField(null=True, blank=True)
    test_outcome = models.TextField(blank=True, default="")  # "" untested, "ok", or the refusal
    ran_out = models.BooleanField(default=False)  # a ChatGPT sign-in whose refresh failed

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["kind"], condition=Q(kind="chatgpt"), name="ai_one_chatgpt_connection"
            )
        ]


class SiteSetting(models.Model):
    """A call site's model, cap and call settings; no row means the site's defaults (M5G.5)."""

    site = models.TextField(primary_key=True)
    same_as_default = models.BooleanField(default=True)
    connection = models.ForeignKey(Connection, null=True, blank=True, on_delete=models.SET_NULL)
    model = models.TextField(blank=True, default="")
    cap = models.PositiveIntegerField(null=True, blank=True)  # calls a day
    temperature = models.FloatField(null=True, blank=True)
    reasoning_effort = models.TextField(blank=True, default="")
    timeout = models.PositiveIntegerField(null=True, blank=True)  # seconds


class AICall(models.Model):
    """One call, append-only; no prompt or reply text (M5G.6). A learner's call keeps no person."""

    OUTCOMES = [
        ("answered", "answered"),
        ("refused", "refused"),
        ("capped", "capped"),
        ("failed", "failed"),
    ]

    site = models.TextField()
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    connection_name = models.TextField(blank=True, default="")
    model = models.TextField(blank=True, default="")
    prompt_id = models.TextField(blank=True, default="")
    tokens_in = models.PositiveIntegerField(default=0)
    tokens_out = models.PositiveIntegerField(default=0)
    cost = models.DecimalField(max_digits=12, decimal_places=6, null=True, blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    outcome = models.TextField(choices=OUTCOMES)
    code = models.TextField(blank=True, default="")
    draft = models.UUIDField(null=True, blank=True)
    at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["site", "at"])]
