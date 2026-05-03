FROM mambaorg/micromamba:1.5-jammy

# Install git (needed by some pip packages during build)
USER root
RUN apt-get update && apt-get install -y --no-install-recommends git curl \
    && rm -rf /var/lib/apt/lists/*
USER mambauser

WORKDIR /app

# 1. Install runtime conda environment
COPY --chown=mambauser deploy/environment-prod.yml .
RUN micromamba install -y -n base -f environment-prod.yml \
    && micromamba clean --all --yes

# 2. Install the boatops package (src layout, no extra deps)
COPY --chown=mambauser src/ ./src/
RUN /opt/conda/bin/pip install --no-cache-dir --no-deps -e ./src/

EXPOSE 8000

# --proxy-headers: trust X-Forwarded-For from nginx
# --workers 2: two sync threads for blocking CMEMS/CDSE calls
CMD ["/opt/conda/bin/uvicorn", "boatops.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--workers", "2"]
