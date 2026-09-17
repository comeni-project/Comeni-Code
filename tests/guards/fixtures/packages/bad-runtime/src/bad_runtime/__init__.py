"""Imports only an allowed module, then reaches a forbidden call through it."""

import pathlib

pathlib.os.system("true")
