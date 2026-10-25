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

# 2. Install the boatops package (src layout, no extra deps, non-editable for production)
COPY --chown=mambauser src/ ./src/
RUN /opt/conda/bin/pip install --no-cache-dir --no-deps ./src/

EXPOSE 8000

# --proxy-headers: honour X-Forwarded-For from nginx
# --forwarded-allow-ips: trust proxy headers only from Docker network (172.16/12)
# --workers 4: each worker is a process; sync route handlers run in a threadpool,
#   so 4 workers allows ~4 concurrent blocking CDSE/Open-Meteo fetches to proceed in parallel
CMD ["/opt/conda/bin/uvicorn", "boatops.main:app", \
     "--host", "0.0.0.0", "--port", "8000", \
     "--proxy-headers", "--forwarded-allow-ips=172.16.0.0/12", \
     "--workers", "4"]
