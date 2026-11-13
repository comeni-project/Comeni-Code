"""Keys kept encrypted at rest (M5.1 spec, M5G.3), Fernet-keyed by `CODE_SETTINGS_KEY`. A key is
never sent back: the page reads that one is set, and its last four characters."""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


class NoSettingsKey(Exception):
    """A key cannot be kept without `CODE_SETTINGS_KEY` (CA0402)."""


class Hidden:
    """A secret that never prints, so a traceback or a log line cannot show it."""

    __slots__ = ("_value",)

    def __init__(self, value: str) -> None:
        self._value = value

    def reveal(self) -> str:
        return self._value

    def __repr__(self) -> str:
        return "Hidden(…)"

    __str__ = __repr__


def _fernet() -> Fernet | None:
    key: str | None = settings.CODE_SETTINGS_KEY
    return None if key is None else Fernet(key.encode())


def seal(text: str) -> bytes:
    fernet = _fernet()
    if fernet is None:
        raise NoSettingsKey
    return fernet.encrypt(text.encode())


def open_(sealed: bytes) -> str | None:
    """The key, or None when it cannot be read: no settings key, or it changed since (re-enter it)."""
    fernet = _fernet()
    if fernet is None:
        return None
    try:
        return fernet.decrypt(bytes(sealed)).decode()
    except InvalidToken:
        return None
