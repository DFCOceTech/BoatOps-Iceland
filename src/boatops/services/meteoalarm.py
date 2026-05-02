import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import cachetools
import httpx

from boatops.cache import make_cache

_cache, _lock = make_cache(ttl_seconds=300)  # 5 min

_FEED_URL = "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{slug}"
_NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "cap": "urn:oasis:names:tc:emergency:cap:1.2",
}
_COUNTRY_SLUG = {
    "DE": "germany",
    "DK": "denmark",
    "SE": "sweden",
    "PL": "poland",
    "FI": "finland",
    "EE": "estonia",
    "LV": "latvia",
    "LT": "lithuania",
}


@cachetools.cached(cache=_cache, lock=_lock, key=cachetools.keys.hashkey)
def get_advisories(country: str = "DE") -> dict:
    slug = _COUNTRY_SLUG.get(country.upper(), country.lower())
    resp = httpx.get(_FEED_URL.format(slug=slug), timeout=15)
    resp.raise_for_status()

    root = ET.fromstring(resp.content)
    entries = root.findall("atom:entry", _NS)

    features = []
    for entry in entries:
        features.append({
            "type": "Feature",
            "geometry": None,  # Atom feed carries no polygon — text description only
            "properties": {
                "title": entry.findtext("atom:title", default="", namespaces=_NS),
                "event": entry.findtext(".//cap:event", default="unknown", namespaces=_NS),
                "severity": entry.findtext(".//cap:severity", default="unknown", namespaces=_NS),
                "urgency": entry.findtext(".//cap:urgency", default="unknown", namespaces=_NS),
                "onset": entry.findtext(".//cap:onset", default=None, namespaces=_NS),
                "expires": entry.findtext(".//cap:expires", default=None, namespaces=_NS),
                "area_description": entry.findtext(".//cap:areaDesc", default="", namespaces=_NS),
            },
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
