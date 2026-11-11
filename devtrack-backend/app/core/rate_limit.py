"""Brute-force protection for the login endpoint.

A sliding-window counter of *failed* logins, keyed two ways:
- per (client IP, email): stops password guessing against one account;
- per client IP: stops one machine spraying many accounts.

A successful login clears the (IP, email) counter. State is in memory, which is right
for a single API process (our deployment). With several replicas, move the counters to
Redis so all replicas share them.
"""

import math
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable


class LoginRateLimiter:
    def __init__(
        self,
        max_failures_per_account: int = 5,
        max_failures_per_ip: int = 20,
        window_seconds: float = 15 * 60,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.max_per_account = max_failures_per_account
        self.max_per_ip = max_failures_per_ip
        self.window = window_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._failures: dict[tuple[str, ...], deque[float]] = defaultdict(deque)

    def _prune(self, key: tuple[str, ...], now: float) -> deque[float]:
        hits = self._failures[key]
        while hits and now - hits[0] >= self.window:
            hits.popleft()
        if not hits:
            del self._failures[key]  # keep memory bounded to active attackers
            return deque()
        return hits

    def retry_after(self, ip: str, email: str) -> int:
        """Seconds until this client may try again; 0 if allowed now."""
        now = self._clock()
        with self._lock:
            waits = []
            for key, limit in (((ip, email), self.max_per_account), ((ip,), self.max_per_ip)):
                hits = self._prune(key, now)
                if len(hits) >= limit:
                    waits.append(hits[0] + self.window - now)
            return math.ceil(max(waits)) if waits else 0

    def record_failure(self, ip: str, email: str) -> None:
        now = self._clock()
        with self._lock:
            self._failures[(ip, email)].append(now)
            self._failures[(ip,)].append(now)

    def record_success(self, ip: str, email: str) -> None:
        with self._lock:
            self._failures.pop((ip, email), None)

    def reset(self) -> None:
        with self._lock:
            self._failures.clear()


login_limiter = LoginRateLimiter()
