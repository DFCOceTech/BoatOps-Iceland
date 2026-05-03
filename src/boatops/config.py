from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # CMEMS (copernicusmarine)
    copernicusmarine_service_username: str = ""
    copernicusmarine_service_password: str = ""

    # CDSE (Copernicus Data Space — Sentinel-2)
    cdse_email: str = ""
    cdse_password: str = ""

    # Anthropic (AI synthesis — nice-to-have)
    anthropic_api_key: str = ""

    # App
    cors_origins: list[str] = []  # must be set explicitly in production (e.g. CORS_ORIGINS=https://app.example.com)
    log_level: str = "info"


settings = Settings()
