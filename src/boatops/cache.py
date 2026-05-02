import threading
from typing import Any

import cachetools


def make_cache(ttl_seconds: int, maxsize: int = 128) -> tuple[cachetools.TTLCache, threading.RLock]:
    """Return a (TTLCache, RLock) pair.

    Usage with cachetools.cached:
        _cache, _lock = make_cache(ttl_seconds=3600)

        @cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
        def expensive_fn(arg): ...
    """
    return cachetools.TTLCache(maxsize=maxsize, ttl=ttl_seconds), threading.RLock()
