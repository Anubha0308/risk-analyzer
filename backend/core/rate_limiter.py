from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address)

def setup_rate_limiter(app):

    # attach limiter
    app.state.limiter = limiter

    # IMPORTANT MIDDLEWARE
    app.add_middleware(SlowAPIMiddleware)

    # exception handler
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request, exc):
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Try again later."}
        )
