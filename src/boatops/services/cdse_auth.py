"""CDSE OAuth2 token management.

Tokens are cached for 5 minutes (well inside the ~10-minute CDSE expiry window).
"""
import cachetools
import httpx

from boatops.cache import make_cache

_cache, _lock = make_cache(ttl_seconds=300, maxsize=4)

_TOKEN_URL = (
    "https://identity.dataspace.copernicus.eu"
    "/auth/realms/CDSE/protocol/openid-connect/token"
)


@cachetools.cached(cache=_cache, lock=_lock,
                   key=lambda email, password: cachetools.keys.hashkey(email))
def get_token(email: str, password: str) -> str:
    resp = httpx.post(
        _TOKEN_URL,
        data={
            "client_id": "cdse-public",
            "username": email,
            "password": password,
            "grant_type": "password",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def auth_header(email: str, password: str) -> dict:
    return {"Authorization": f"Bearer {get_token(email, password)}"}
