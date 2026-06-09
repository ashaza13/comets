import sys
import os

# Make `app.*` imports resolve from the backend package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.main import app as _backend_app  # noqa: E402


class _StripApiPrefix:
    """Mirrors the Vite dev-proxy rewrite: strips /api before FastAPI sees the path."""

    def __init__(self, asgi_app, prefix: str = "/api"):
        self.app = asgi_app
        self.prefix = prefix
        self.prefix_bytes = prefix.encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] in ("http", "websocket"):
            path = scope.get("path", "")
            if path.startswith(self.prefix):
                scope = {
                    **scope,
                    "path": path[len(self.prefix):] or "/",
                    "raw_path": (
                        scope.get("raw_path", b"")[len(self.prefix_bytes):] or b"/"
                    ),
                }
        await self.app(scope, receive, send)


# Vercel looks for an `app` variable that is an ASGI callable
app = _StripApiPrefix(_backend_app)
