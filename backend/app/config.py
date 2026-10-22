from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from the environment or backend/.env.

    The Anthropic SDK reads ANTHROPIC_API_KEY itself, so it is not duplicated here.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_model: str = "claude-opus-5-5"
    # Extraction is a short classification-style task, so low effort is enough.
    llm_effort: str = "low"
    llm_max_tokens: int = 4096
    cors_origins: list[str] = ["*"]

    # Constellations (shared groups) are stored in Upstash Redis. Vercel's
    # Upstash integration sets the KV_* names; Upstash's own console uses UPSTASH_*.
    kv_rest_api_url: str | None = None
    kv_rest_api_token: str | None = None
    upstash_redis_rest_url: str | None = None
    upstash_redis_rest_token: str | None = None
    # Local development only: keep groups in memory (lost on restart).
    groups_in_memory: bool = False

    @property
    def redis_rest(self) -> tuple[str, str] | None:
        url = self.kv_rest_api_url or self.upstash_redis_rest_url
        token = self.kv_rest_api_token or self.upstash_redis_rest_token
        return (url, token) if url and token else None

    @field_validator("llm_model")
    @classmethod
    def _strip_provider_prefix(cls, v: str) -> str:
        # Accept LiteLLM-style ids ("anthropic/claude-…") left over from the old provider layer.
        return v.removeprefix("anthropic/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
