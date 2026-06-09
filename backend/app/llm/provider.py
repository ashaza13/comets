import os
import litellm
from pydantic import BaseModel

litellm.set_verbose = False


class LLMConfig(BaseModel):
    # Ollama examples:  "ollama_chat/llama3.1"  "ollama_chat/mistral"
    # Cloud examples:   "anthropic/claude-3-5-haiku-20241022"  "openai/gpt-4o-mini"
    model: str = "ollama_chat/llama3.1"
    # Required for Ollama; ignored by cloud providers
    base_url: str = "http://localhost:11434"
    temperature: float = 0.2
    max_tokens: int = 1024


def load_config() -> LLMConfig:
    return LLMConfig(
        model=os.getenv("LLM_MODEL", "ollama_chat/llama3.1"),
        base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.2")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "1024")),
    )


def complete(messages: list[dict], config: LLMConfig) -> str:
    kwargs: dict = {
        "model": config.model,
        "messages": messages,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    # Only pass api_base for local/Ollama models; cloud providers use their own routing
    if config.model.startswith("ollama"):
        kwargs["api_base"] = config.base_url

    response = litellm.completion(**kwargs)
    return response.choices[0].message.content or ""
