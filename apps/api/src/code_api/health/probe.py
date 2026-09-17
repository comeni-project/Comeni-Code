"""The api container's health check: is the server answering? (M0 part 8 spec, P8.3)

200 and 503 both count. A 503 means a check is down, which the health page reports; the API
itself is serving, and a stopped worker must not make Docker call the API unhealthy.
Run as `python -m code_api.health.probe`.
"""

import sys
import urllib.error
import urllib.request

URL = "http://127.0.0.1:8000/api/health"
SERVING = {200, 503}


def status(url: str = URL, timeout: float = 5) -> int | None:
    """The HTTP status the URL answers with, or None if nothing answers."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return int(response.status)
    except urllib.error.HTTPError as error:
        return error.code
    except OSError:  # URLError, refused connections and timeouts
        return None


def main(url: str = URL) -> int:
    return 0 if status(url) in SERVING else 1


if __name__ == "__main__":
    sys.exit(main())
