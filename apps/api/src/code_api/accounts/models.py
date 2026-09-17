from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Django's user, swappable from day one. Fields arrive with M4 (accounts)."""
