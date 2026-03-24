from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    # App settings
    app_name: str = "PlatformAI"
    host: str = "0.0.0.0"
    port: int = 8000
    
    # Google Cloud settings
    google_cloud_project: str
    google_cloud_location: str = "us-central1"
    gemini_api_key: str
    
    # GitHub settings
    github_token: str
    github_repo_name: str = "sheetalkubsad/terraform_agent1"
    
    # CORS settings
    cors_origins: list[str] = ["http://localhost:8080"]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()
