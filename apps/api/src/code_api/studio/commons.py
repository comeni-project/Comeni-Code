"""Images from Wikimedia Commons (M6.3 spec, M6IM.4): a file page link in, the image and its
credit out, read from Commons itself so the credit is right by construction.

One outbound call site, no model: the Commons API for the file's metadata and a rendering at
most 1600 px wide (1000 px if that is over 2 MB), then the rendering. An SVG, TIFF or GIF original
arrives as Commons' PNG or JPEG rendering. Every failure is a `CommonsError` in plain words.
"""

from __future__ import annotations

import html
import re
from dataclasses import dataclass, replace
from typing import Any
from urllib.parse import unquote, urlparse

import requests

from code_schema.images import MAX_IMAGE_BYTES, NAME, licence_from_commons, sniff

API = "https://commons.wikimedia.org/w/api.php"
PAGE = "https://commons.wikimedia.org/wiki/"
WIDTHS = (1600, 1000)
TIMEOUT = 10
# Wikimedia asks every client to name itself and a way to reach its makers.
USER_AGENT = "ComeniCode/1.0 (https://github.com/comeni-project/Comeni-Code; Studio images)"
_EXTENSIONS = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}
_TAG = re.compile(r"<[^>]+>")


class CommonsError(Exception):
    """Why Commons gave no image to keep, in words for the author."""


@dataclass(frozen=True)
class Credit:
    title: str  # File:Name.ext
    author: str
    source: str  # the file's page on Commons
    licence: str  # canonical (code_schema.images)
    licences: tuple[str, ...]  # as Commons states them
    file: str  # a name for the node's images/ folder
    thumb_url: str  # Commons' rendering, for Studio to show before saving


@dataclass(frozen=True)
class Fetched:
    credit: Credit
    data: bytes


def _session() -> requests.Session:
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    return session


def title_of(link: str) -> str:
    """`File:Name.ext` from a Commons file page link (with or without a `#/media/` part)."""
    parsed = urlparse(link.strip())
    if parsed.scheme != "https" or parsed.netloc not in (
        "commons.wikimedia.org",
        "commons.m.wikimedia.org",
    ):
        raise CommonsError("Paste a link to a file page on commons.wikimedia.org.")
    path = unquote(
        parsed.fragment.removeprefix("/media/") if "File:" in parsed.fragment else parsed.path
    )
    found = re.search(r"(File:[^/?#]+)$", path)
    if found is None:
        raise CommonsError("That link is not a Commons file page (it has no File: in it).")
    return found.group(1).replace("_", " ")


def _name_for(title: str, media_type: str) -> str:
    stem = title.removeprefix("File:").rsplit(".", 1)[0].lower()
    slug = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")[:60].strip("-") or "image"
    name = f"{slug}.{_EXTENSIONS[media_type]}"
    assert NAME.match(name)
    return name


def _plain(value: object) -> str:
    return " ".join(html.unescape(_TAG.sub(" ", str(value or ""))).split())


def _info(session: requests.Session, title: str, width: int) -> dict[str, Any]:
    params: dict[str, str | int] = {
        "action": "query",
        "format": "json",
        "formatversion": 2,
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|mime|extmetadata|user",
        "iiurlwidth": width,
    }
    try:
        answer = session.get(API, params=params, timeout=TIMEOUT)
        answer.raise_for_status()
        pages = answer.json()["query"]["pages"]
    except (requests.RequestException, ValueError, KeyError) as error:
        raise CommonsError(f"Commons did not answer: {error}.") from error
    if not pages or pages[0].get("missing") or not pages[0].get("imageinfo"):
        raise CommonsError(f"Commons has no file {title}.")
    info: dict[str, Any] = pages[0]["imageinfo"][0]
    return info


def look_up(link: str, *, session: requests.Session | None = None) -> Credit:
    """The file's credit, refused when its licence is not one an image may carry."""
    return _credit(title_of(link), _info(session or _session(), title_of(link), WIDTHS[0]))


def _credit(title: str, info: dict[str, Any]) -> Credit:
    meta = info.get("extmetadata", {})
    stated = [
        _plain(meta.get(key, {}).get("value"))
        for key in ("LicenseShortName", "License")
        if meta.get(key, {}).get("value")
    ]
    licence = licence_from_commons(stated)
    if licence is None:
        said = ", ".join(dict.fromkeys(stated)) or "no licence"
        raise CommonsError(
            f"{title} is under {said}; an image here must be CC0, public domain, CC BY or CC BY-SA."
        )
    # The attribution the file asks for, else its artist, else who uploaded it: a licence that
    # requires attribution needs a name (#352).
    author = (
        _plain(meta.get("Attribution", {}).get("value"))
        or _plain(meta.get("Artist", {}).get("value"))
        or (f"{info['user']} (Wikimedia Commons user)" if info.get("user") else "")
    )
    if not author:
        raise CommonsError(f"{title} names no author or uploader to credit.")
    rendered = info.get("thumbmime") or info.get("mime") or ""
    media_type = rendered if rendered in _EXTENSIONS else "image/png"
    return Credit(
        title=title,
        author=author[:120],
        source=PAGE + title.replace(" ", "_"),
        licence=licence,
        licences=tuple(dict.fromkeys(stated)),
        file=_name_for(title, media_type),
        thumb_url=str(info.get("thumburl") or info.get("url") or ""),
    )


def fetch(link: str, *, session: requests.Session | None = None) -> Fetched:
    """The image at most 1600 px wide (1000 px if that is over 2 MB), and its credit."""
    session = session or _session()
    title = title_of(link)
    for width in WIDTHS:
        info = _info(session, title, width)
        credit = _credit(title, info)
        try:
            answer = session.get(credit.thumb_url, timeout=TIMEOUT)
            answer.raise_for_status()
        except requests.RequestException as error:
            raise CommonsError(f"Commons did not send the image: {error}.") from error
        data = answer.content
        media_type = sniff(data)
        if media_type is None:
            raise CommonsError(f"Commons sent {title} in a format this cannot keep.")
        if len(data) <= MAX_IMAGE_BYTES:
            # The name says the format of the bytes that came, whatever Commons stated.
            return Fetched(replace(credit, file=_name_for(title, media_type)), data)
    raise CommonsError(f"{title} is over 2 MB even at {WIDTHS[-1]} px wide.")
