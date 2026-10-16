"""Images from Wikimedia Commons (M6.3 spec, M6IM.4), against a recorded answer: the suite never
calls Commons."""

from typing import Any

import pytest
import requests

from code_api.studio import commons
from code_api.studio.commons import CommonsError, fetch, look_up, title_of

LINK = "https://commons.wikimedia.org/wiki/File:De_Bruijn_graph-for_binary_sequence_of_order_4.svg"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def info(
    licence: str = "CC BY-SA 4.0", artist: str = '<a href="//x">Jane&nbsp;Doe</a>'
) -> dict[str, Any]:
    return {
        "query": {
            "pages": [
                {
                    "title": "File:De Bruijn graph-for binary sequence of order 4.svg",
                    "imageinfo": [
                        {
                            "thumburl": "https://upload.wikimedia.org/thumb/1600px.png",
                            "thumbmime": "image/png",
                            "mime": "image/svg+xml",
                            "url": "https://upload.wikimedia.org/original.svg",
                            "extmetadata": {
                                "Artist": {"value": artist},
                                "LicenseShortName": {"value": licence},
                            },
                        }
                    ],
                }
            ]
        }
    }


class Answer:
    def __init__(self, *, json: Any = None, content: bytes = b"", status: int = 200) -> None:
        self._json, self.content, self.status_code = json, content, status

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")

    def json(self) -> Any:
        return self._json


class Session:
    def __init__(self, *answers: Answer) -> None:
        self.answers = list(answers)
        self.asked: list[tuple[str, Any]] = []

    def get(self, url: str, params: Any = None, timeout: float = 0) -> Answer:
        assert timeout > 0
        self.asked.append((url, params))
        return self.answers.pop(0)


def test_a_file_page_link_names_its_file() -> None:
    assert title_of(LINK) == "File:De Bruijn graph-for binary sequence of order 4.svg"
    with_media = "https://commons.wikimedia.org/wiki/Main_Page#/media/File:Kmers.png"
    assert title_of(with_media) == "File:Kmers.png"
    with pytest.raises(CommonsError, match="commons.wikimedia.org"):
        title_of("https://example.org/File:x.png")


def test_the_credit_comes_from_commons() -> None:
    credit = look_up(LINK, session=Session(Answer(json=info())))  # type: ignore[arg-type]
    assert credit.author == "Jane Doe"
    assert credit.licence == "CC BY-SA 4.0"
    assert credit.source == (
        "https://commons.wikimedia.org/wiki/File:De_Bruijn_graph-for_binary_sequence_of_order_4.svg"
    )


def test_an_nc_file_is_refused_naming_its_licence() -> None:
    with pytest.raises(CommonsError, match="CC BY-NC 2.0"):
        look_up(LINK, session=Session(Answer(json=info("CC BY-NC 2.0"))))  # type: ignore[arg-type]


def test_an_svg_original_arrives_as_its_png_rendering() -> None:
    session = Session(Answer(json=info()), Answer(content=PNG))
    fetched = fetch(LINK, session=session)  # type: ignore[arg-type]
    assert fetched.data == PNG
    assert fetched.credit.file == "de-bruijn-graph-for-binary-sequence-of-order-4.png"
    assert session.asked[0][1]["iiurlwidth"] == 1600


def test_too_large_at_1600_is_fetched_again_at_1000(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(commons, "MAX_IMAGE_BYTES", 32)
    small = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
    session = Session(
        Answer(json=info()), Answer(content=PNG), Answer(json=info()), Answer(content=small)
    )
    fetched = fetch(LINK, session=session)  # type: ignore[arg-type]
    assert fetched.data == small
    assert session.asked[2][1]["iiurlwidth"] == 1000


def test_a_failure_is_said_in_words() -> None:
    session = Session(Answer(status=503))
    with pytest.raises(CommonsError, match="Commons did not answer"):
        look_up(LINK, session=session)  # type: ignore[arg-type]
