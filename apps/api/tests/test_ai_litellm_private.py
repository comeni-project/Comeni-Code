"""The LiteLLM private methods and constants the ChatGPT sign-in drives (M5.1 spec, M5G.4). Any
release may change them, so LiteLLM is pinned and this test fails first when one is gone or
changes its shape: an upgrade is a reviewed change."""

import inspect

from litellm.llms.chatgpt import authenticator, common_utils


def test_the_methods_the_sign_in_drives_are_there() -> None:
    auth = authenticator.Authenticator
    for name, parameters in (
        ("_request_device_code", ["self"]),
        ("_exchange_code_for_tokens", ["self", "code_data"]),
        ("_build_auth_record", ["self", "tokens"]),
    ):
        method = getattr(auth, name)
        assert list(inspect.signature(method).parameters) == parameters, name


def test_the_constants_it_reads_are_there() -> None:
    assert common_utils.CHATGPT_DEVICE_VERIFY_URL == "https://auth.openai.com/codex/device"
    assert common_utils.CHATGPT_DEVICE_TOKEN_URL.startswith("https://auth.openai.com/")
    assert common_utils.CHATGPT_OAUTH_TOKEN_URL.startswith("https://auth.openai.com/")
    assert common_utils.CHATGPT_CLIENT_ID


def test_the_device_code_answer_has_the_fields_the_page_shows() -> None:
    source = inspect.getsource(authenticator.Authenticator._request_device_code)
    for field in ('"device_auth_id"', '"user_code"', '"interval"'):
        assert field in source
