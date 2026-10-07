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
        LANDED = "landed"  # final: its landing merged and the index holds it (M4F.3)
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
    """One reviewer's answers to the questions of one submission (M4.5 spec, M4R.4). Keyed on the
    submission, its `submitted` event, not the revision: a revision submitted again after a
    rejection or a send back is a new submission, and its review starts empty (#188)."""

    draft = models.ForeignKey(Draft, on_delete=models.CASCADE, related_name="reviews")
    submission = models.ForeignKey("DraftEvent", on_delete=models.CASCADE, related_name="reviews")
    number = models.PositiveIntegerField()  # the revision reviewed
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    answers = models.JSONField(default=dict)  # question id → what was given
    started_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["submission", "reviewer"], name="studio_one_review_per_reviewer"
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
        LANDING = "landing"
        LANDED = "landed"

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
    # The batch the draft went out in, on a `landing` event (M4.6 spec, M4L.3).
    landing = models.ForeignKey(
        "Landing", null=True, blank=True, on_delete=models.PROTECT, related_name="events"
    )

    def __str__(self) -> str:
        return f"{self.kind} {self.draft.node_id}"


class Landing(models.Model):
    """One batch of approved drafts, landed as one commit and one pull request (M4.6, M4L.3)."""

    class State(models.TextChoices):
        PENDING = "pending"
        REFUSED = "refused"
        OPEN = "open"
        FAILED = "failed"
        MERGED = "merged"
        CLOSED = "closed"

    # A landing in one of these holds its drafts: a failed one can still merge on a re-run, so its
    # drafts wait until an operator closes it (plan ruling, Review Focus 1).
    LIVE: ClassVar = (State.PENDING, State.OPEN, State.FAILED, State.MERGED)

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+"
    )
    started_at = models.DateTimeField(default=timezone.now)
    state = models.CharField(max_length=16, choices=State.choices, default=State.PENDING)
    main_head = models.TextField(blank=True)  # the commit the landing was built on
    branch = models.TextField(blank=True)
    pull_number = models.PositiveIntegerField(null=True, blank=True)
    pull_url = models.TextField(blank=True)
    # GitHub's merge commit, once merged: a build containing it lands the drafts (M4F.3).
    merge_commit = models.TextField(blank=True)
    reason = models.TextField(blank=True)  # why it was refused or failed, in words
    # When a worker took it; a landing claimed long ago and still pending was interrupted (#203).
    claimed_at = models.DateTimeField(null=True, blank=True)
    # Whether GitHub turned auto-merge on; without it a failed landing never goes back to open.
    auto_merge = models.BooleanField(default=False)

    def __str__(self) -> str:
        return f"landing {self.public_id} ({self.state})"


class LandingDraft(models.Model):
    """One draft in a landing, at the revision it lands at. `live` while the landing holds it."""

    landing = models.ForeignKey(Landing, on_delete=models.CASCADE, related_name="entries")
    draft = models.ForeignKey(Draft, on_delete=models.PROTECT, related_name="landings")
    revision = models.PositiveIntegerField()
    live = models.BooleanField(default=True)
    dropped_code = models.CharField(max_length=6, blank=True)
    dropped_reason = models.TextField(blank=True)

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(
                fields=["draft"], condition=Q(live=True), name="studio_one_live_landing_per_draft"
            )
        ]

    def __str__(self) -> str:
        return f"{self.draft.node_id} r{self.revision} in {self.landing.public_id}"
