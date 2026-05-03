"""Shared raster helpers: float array → PNG bytes / data URI.

These are the canonical implementations extracted from notebooks/06_map_layers.ipynb.
The notebook helpers (_to_overlay, _to_quiver_uri) delegate to these functions.
"""
import base64
import io
import warnings

import cmocean  # noqa: F401 — imported so callers can pass cmocean colormaps
import matplotlib
import matplotlib.pyplot as plt
from matplotlib.backends.backend_agg import FigureCanvasAgg
from matplotlib.figure import Figure
import numpy as np
from PIL import Image


def to_png_bytes(arr_2d: np.ndarray, lats: np.ndarray, cmap, norm,
                 alpha: float = 0.75) -> bytes:
    """Render a 2-D float array as an RGBA PNG.

    NaN cells → fully transparent.  Ascending-latitude grids (CMEMS standard)
    are flipped to north-up before encoding.

    Returns raw PNG bytes suitable for ``Response(content=..., media_type="image/png")``.
    """
    cmap_obj = cmap if callable(cmap) else plt.get_cmap(cmap)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        fill = float(getattr(norm, "vmin", None) or 0.0)
        safe = np.where(np.isnan(arr_2d), fill, arr_2d)
        rgba = cmap_obj(norm(safe)).copy()
    rgba[np.isnan(arr_2d), 3] = 0.0
    rgba[~np.isnan(arr_2d), 3] = alpha
    img = Image.fromarray((rgba * 255).astype(np.uint8), "RGBA")
    if lats[0] < lats[-1]:
        img = img.transpose(Image.FLIP_TOP_BOTTOM)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def to_data_uri(arr_2d: np.ndarray, lats: np.ndarray, cmap, norm,
                alpha: float = 0.75) -> str:
    """Return ``to_png_bytes`` result as a base64 data URI (for notebook ImageOverlay)."""
    return "data:image/png;base64," + base64.b64encode(
        to_png_bytes(arr_2d, lats, cmap, norm, alpha)
    ).decode()


def to_quiver_png_bytes(lons: np.ndarray, lats: np.ndarray,
                        U: np.ndarray, V: np.ndarray,
                        cmap=None, speed_max: float = 0.5,
                        stride: int | None = None) -> bytes:
    """Subsampled quiver plot rendered to a transparent PNG (for ImageOverlay).

    Returns raw PNG bytes.
    """
    if cmap is None:
        cmap = cmocean.cm.speed
    if stride is None:
        stride = max(1, min(U.shape) // 15)
    sl = lons[::stride]
    ss = lats[::stride]
    sU = U[::stride, ::stride]
    sV = V[::stride, ::stride]
    sSpd = np.sqrt(sU ** 2 + sV ** 2)
    LG, AG = np.meshgrid(sl, ss)
    # Use Figure directly (not plt.figure) so this works on any thread/backend
    fig = Figure(figsize=(8, 8 * (lats.max() - lats.min()) / (lons.max() - lons.min())))
    FigureCanvasAgg(fig)
    fig.patch.set_alpha(0)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.patch.set_alpha(0)
    ax.set_xlim(lons.min(), lons.max())
    ax.set_ylim(lats.min(), lats.max())
    ax.quiver(LG, AG, sU, sV, sSpd, cmap=cmap, scale=4, width=0.005,
              headwidth=3, headlength=4, minlength=0, clim=(0, speed_max))
    ax.axis("off")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, transparent=True, bbox_inches=None)
    buf.seek(0)
    return buf.read()


def to_quiver_data_uri(lons, lats, U, V, **kwargs) -> tuple[str, np.ndarray]:
    """Return ``(data_uri_string, subsampled_speed_array)`` for notebook use."""
    stride = kwargs.get("stride") or max(1, min(U.shape) // 15)
    sSpd = np.sqrt(U[::stride, ::stride] ** 2 + V[::stride, ::stride] ** 2)
    uri = "data:image/png;base64," + base64.b64encode(
        to_quiver_png_bytes(lons, lats, U, V, **kwargs)
    ).decode()
    return uri, sSpd
