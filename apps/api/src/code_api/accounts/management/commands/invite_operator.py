"""The first operator (M4.3 spec, M4A.1): an operator invite, its link printed, nothing mailed.

The first operator signs up through the same invite path as everyone after them.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from code_api.accounts.invites import AlreadyAMember, link, mint
from code_api.accounts.roles import Role


class Command(BaseCommand):
    help = "Invite an operator and print the invite's link."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("email")

    def handle(self, *args: Any, **options: Any) -> None:
        try:
            invite, token = mint(options["email"], Role.OPERATOR, by=None)
        except AlreadyAMember as member:
            raise CommandError(f"{member} already has an account") from member
        self.stdout.write(
            f"Invited {invite.email} as operator, until {invite.expires_at:%Y-%m-%d}."
        )
        self.stdout.write(link(token))
