"""Drafts: a node's working copy, snapshotted per save (M4.4 spec, M4W.0, M4W.1).

A draft names its node by id, never a foreign key into the index (R1, M1P5.3), so rebuilding the
index never touches a draft. Its state is its latest revision; a revision is never changed.
"""

import uuid
from typing import ClassVar

from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Draft(models.Model):
    """One node's working copy. At most one is live per node, which Postgres holds."""

    class State(models.TextChoices):
        OPEN = "open"
        SUBMITTED = "submitted"
        APPROVED = "approved"
        DISCARDED = "discarded"

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    node_id = models.TextField()
    folder = models.TextField()
    state = models.CharField(max_length=16, choices=State.choices, default=State.OPEN)
    # The index build it started from, its base version; empty for a new node (M4W.2).
    base_digest = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["node_id"],
                condition=Q(state__in=["open", "submitted", "approved"]),
                name="studio_one_live_draft_per_node",
            )
        ]

    def __str__(self) -> str:
        return f"draft of {self.node_id} ({self.state})"


# A draft in one of these is its node's draft (M4.5 spec, M4R.3).
LIVE_STATES = (Draft.State.OPEN, Draft.State.SUBMITTED, Draft.State.APPROVED)


class Revision(models.Model):
    """One save: the node's files exactly as they would land, and who saved them."""

    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name="revisions")
    number = models.PositiveIntegerField()
    node_yaml = models.TextField()
    body_md = models.TextField(blank=True)
    exam_yaml = models.TextField(blank=True)  # empty: the node has no exam pool
    saved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    saved_at = models.DateTimeField(default=timezone.now)
    change = models.TextField()

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(fields=["draft", "number"], name="studio_revision_number")
        ]

    def __str__(self) -> str:
        return f"{self.draft.node_id} r{self.number}"


class Review(models.Model):
    """One reviewer's answers to the questions of one submitted revision (M4.5 spec, M4R.4)."""

    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name="reviews")
    number = models.PositiveIntegerField()  # the revision reviewed
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    answers = models.JSONField(default=dict)  # question id → what was given
    started_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["draft", "number", "reviewer"], name="studio_one_review_per_reviewer"
            )
        ]

    def __str__(self) -> str:
        return f"review of {self.draft.node_id} r{self.number}"


class DraftEvent(models.Model):
    """One transition, append-only, written with the state it made (M4.5 spec, M4R.5)."""

    class Kind(models.TextChoices):
        OPENED = "opened"
        SUBMITTED = "submitted"
        WITHDRAWN = "withdrawn"
        REJECTED = "rejected"
        APPROVED = "approved"
        SENT_BACK = "sent_back"
        DISCARDED = "discarded"

    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    at = models.DateTimeField(default=timezone.now)
    revision = models.PositiveIntegerField(null=True)  # the revision it concerned
    reason = models.TextField(blank=True)
    self_approved = models.BooleanField(default=False)
    # An approval's review, and how it went: how many questions answered, how many wrong.
    review = models.ForeignKey(Review, null=True, on_delete=models.SET_NULL, related_name="+")
    answered = models.PositiveIntegerField(null=True)
    wrong = models.PositiveIntegerField(null=True)

    def __str__(self) -> str:
        return f"{self.kind} {self.draft.node_id}"
