"""The index: approved content as tables, derived from the files and never edited (spec M1P5.4).

Only `code_api.content.index` writes these models. Nothing outside the index holds a foreign key
into it — other tables name a node by its id (M1P5.3) — so a rebuild can replace it wholesale.
Strings are TextField: the validator owns every length rule, and a second copy of a rule here
would turn a clean rebuild into a database error the day the two disagree.
"""

from django.db import models

from code_schema import Level
from code_schema.questions import KINDS as QUESTION_KINDS
from code_schema.resources import DISPLAYS
from code_schema.resources import KINDS as RESOURCE_KINDS


class Region(models.Model):
    id = models.TextField(primary_key=True)
    name = models.TextField()
    # regions.yaml's order, which routes use to break ties (W3.3).
    position = models.PositiveIntegerField()


class Node(models.Model):
    id = models.TextField(primary_key=True)
    title = models.TextField()
    claim = models.TextField()
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="nodes")
    level = models.TextField(choices=[(level.value, level.value) for level in Level])
    minutes = models.PositiveIntegerField()
    body = models.TextField()
    # The node's folder, relative to the content root: for "edit on GitHub" later.
    folder = models.TextField()


class Link(models.Model):
    class Kind(models.TextChoices):
        NEEDS = "needs"
        GOES_DEEPER = "goes-deeper"
        RELATED = "related"

    source = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="links_out")
    target = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="links_in")
    kind = models.TextField(choices=Kind.choices)
    reason = models.TextField()
    # The author's order within one kind of link.
    position = models.PositiveIntegerField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["source", "kind", "target"], name="content_link_once")
        ]


class Provider(models.Model):
    """providers.yaml, as Region mirrors regions.yaml. Its licences stay in the files (M3P1.4)."""

    id = models.TextField(primary_key=True)
    name = models.TextField()
    position = models.PositiveIntegerField()


class Resource(models.Model):
    """One outside resource a node points at (M3P1.2). The Learn it section, in order."""

    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="resources")
    position = models.PositiveIntegerField()
    kind = models.TextField(choices=[(kind, kind) for kind in RESOURCE_KINDS])
    provider = models.ForeignKey(Provider, on_delete=models.PROTECT, related_name="resources")
    url = models.TextField()
    video = models.TextField(blank=True)  # player:id, for an embedded video (M3P5.3)
    part = models.TextField(blank=True)
    covers = models.TextField()
    licence = models.TextField()
    display = models.TextField(choices=[(display, display) for display in DISPLAYS])
    level = models.TextField(choices=[(level.value, level.value) for level in Level])


class Question(models.Model):
    """One try question (M3P1.3). Its options and hints are ordered lists inside the row."""

    node = models.ForeignKey(Node, on_delete=models.CASCADE, related_name="questions")
    position = models.PositiveIntegerField()
    # The author's id, unique within the node; `id` is the row's own key.
    question_id = models.TextField()
    kind = models.TextField(choices=[(kind, kind) for kind in QUESTION_KINDS])
    ask = models.TextField()
    options = models.JSONField(default=list)
    answer = models.FloatField(null=True)
    unit = models.TextField(blank=True)
    tolerance = models.FloatField(null=True)
    hints = models.JSONField(default=list)
    rationale = models.TextField()


class IndexBuild(models.Model):
    """One rebuild attempt, kept. The live index is the latest applied build (M1P5.5)."""

    class Outcome(models.TextChoices):
        APPLIED = "applied"
        REFUSED = "refused"

    created_at = models.DateTimeField(auto_now_add=True)
    outcome = models.TextField(choices=Outcome.choices)
    # SHA-256 of the files the index is made of, in hex.
    digest = models.TextField()
    # The content commit, when the caller knows it; the rebuild never runs git.
    commit = models.TextField(blank=True)
    node_count = models.PositiveIntegerField()
    # The validator's messages, exactly as it words them; empty when applied.
    problems = models.JSONField(default=list)
