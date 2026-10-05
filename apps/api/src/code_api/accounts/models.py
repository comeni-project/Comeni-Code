"""Accounts (M4.3 spec, M4A.1): a user keyed by email and a public id, with one ranked role."""

import uuid
from typing import Any, ClassVar

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from code_api.accounts.roles import Role, can_act_as


class UserManager(BaseUserManager["User"]):
    def create_user(self, email: str, password: str | None = None, **fields: Any) -> User:
        user = self.model(email=self.normalize_email(email), **fields)
        user.set_password(password)  # None stores an unusable password: GitHub-only accounts
        user.save(using=self._db)
        return user

    def create_superuser(self, email: str, password: str | None = None, **fields: Any) -> User:
        from allauth.account.models import EmailAddress

        fields |= {"is_staff": True, "is_superuser": True, "role": Role.OPERATOR}
        user = self.create_user(email, password, **fields)
        # One verified address, as an invite's sign-up records, so the one-address rule holds
        # for an operator made from the command line too (#163).
        EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """A member of the team; from M8, a learner too (a blank role).

    `public_id` is the key for #101: what an OIDC provider would issue as `sub`, and what the API
    and anything outside the database name a user by. The integer key stays internal.
    """

    # Unique as written, for Django's sign-in check, and case-insensitively, by the constraint.
    email = models.EmailField(unique=True)
    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)

    objects: ClassVar[UserManager] = UserManager()

    USERNAME_FIELD = "email"
    EMAIL_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    class Meta:
        constraints: ClassVar = [
            models.UniqueConstraint(Lower("email"), name="accounts_user_email_ci_unique")
        ]

    def can_act_as(self, wanted: Role) -> bool:
        return can_act_as(self.role, wanted)

    def __str__(self) -> str:
        return self.email


class Invite(models.Model):
    """One invite to join the team with a role (M4A.2). Single-use; seven days.

    The token is never stored: only its SHA-256, so the table cannot be turned into sign-ups.
    `public_id` names the invite in the team API, as a user's does.
    """

    public_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    email = models.EmailField()
    role = models.CharField(max_length=16, choices=Role.choices)
    token_hash = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="invites_sent"
    )
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="invite_accepted"
    )
    revoked_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        return f"{self.email} as {self.role}"
