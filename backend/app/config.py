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

    @field_validator("llm_model")
    @classmethod
    def _strip_provider_prefix(cls, v: str) -> str:
        # Accept LiteLLM-style ids ("anthropic/claude-…") left over from the old provider layer.
        return v.removeprefix("anthropic/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
