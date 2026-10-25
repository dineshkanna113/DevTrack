import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import Request, Response

logger = logging.getLogger("devtrack.request")


def configure_logging(level: int = logging.INFO) -> None:
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


async def request_context_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Attach a request id to every response and log method, path, status and latency."""
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request_id
    logger.info(
        "%s %s -> %s (%.1f ms) request_id=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        request_id,
    )
    return response
