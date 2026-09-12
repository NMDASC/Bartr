from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Everything here has a default so the API boots with no .env at all.
    # That is deliberate: hour-0 work must not be blocked on key collection.
    env: str = "dev"
    demo_auth: bool = True

    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "jb"

    xai_api_key: str = ""
    xai_base_url: str = "https://api.x.ai/v1"
    xai_model: str = "grok-4.6"

    ifm_api_key: str = ""
    ifm_base_url: str = ""
    ifm_model: str = ""

    querit_api_key: str = ""
    google_places_api_key: str = ""

    # Auth0 is not wired yet (see docs/DECISIONS.md 002). These exist so the
    # env surface does not change when it is.
    auth0_domain: str = ""
    auth0_audience: str = ""

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
