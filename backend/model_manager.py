import time
import threading
from collections import deque
from typing import Optional
import google.generativeai as genai

# ─── Model Pool (only models with actual quota) ───────────────────────────────
# Ordered by preference: most quota first
MODEL_POOL = [
    {
        "key":     "gemini-3.1-flash-lite",
        "name":    "Gemini 3.1 Flash Lite",
        "rpm":     15,
        "rpd":     500,
        "tpm":     250_000,
    },
    {
        "key":     "gemini-2.5-flash-lite",  # gemini-2.5-flash-lite-preview-06-17 if needed
        "name":    "Gemini 2.5 Flash Lite",
        "rpm":     10,
        "rpd":     20,
        "tpm":     250_000,
    },
    {
        "key":     "gemini-2.5-flash",
        "name":    "Gemini 2.5 Flash",
        "rpm":     5,
        "rpd":     20,
        "tpm":     250_000,
    },
    {
        "key":     "gemini-2.0-flash",       # "Gemini 3 Flash" in the UI
        "name":    "Gemini 3 Flash",
        "rpm":     5,
        "rpd":     20,
        "tpm":     250_000,
    },
]

class ModelManager:
    """
    Tracks per-model rate limits (RPM + RPD) and automatically shuffles
    to the next available model when a limit is reached.
    Resets minute/day windows with a sliding window approach.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # For each model key: deque of UTC timestamps for recent calls
        self._minute_calls: dict[str, deque] = {m["key"]: deque() for m in MODEL_POOL}
        self._day_calls:    dict[str, deque] = {m["key"]: deque() for m in MODEL_POOL}
        # Track which models are in a cooldown (rate-limited by the API itself)
        self._cooldown_until: dict[str, float] = {m["key"]: 0.0 for m in MODEL_POOL}

    def _prune(self, dq: deque, window_seconds: int) -> None:
        """Remove timestamps outside the rolling window."""
        cutoff = time.time() - window_seconds
        while dq and dq[0] < cutoff:
            dq.popleft()

    def _is_available(self, model: dict) -> bool:
        key = model["key"]
        now = time.time()

        # Hard cooldown (e.g. after a 429)
        if now < self._cooldown_until[key]:
            return False

        self._prune(self._minute_calls[key], 60)
        self._prune(self._day_calls[key],    86_400)

        rpm_ok = len(self._minute_calls[key]) < model["rpm"]
        rpd_ok = len(self._day_calls[key])    < model["rpd"]
        return rpm_ok and rpd_ok

    def _record_call(self, key: str) -> None:
        now = time.time()
        self._minute_calls[key].append(now)
        self._day_calls[key].append(now)

    def _set_cooldown(self, key: str, seconds: int = 65) -> None:
        """Call this after receiving a 429 to pause that model."""
        self._cooldown_until[key] = time.time() + seconds
        print(f"[ModelManager] {key} in cooldown for {seconds}s")

    def get_available_model(self) -> Optional[dict]:
        """Return the first model that has remaining quota, or None."""
        with self._lock:
            for model in MODEL_POOL:
                if self._is_available(model):
                    return model
        return None

    def call_with_fallback(self, system_prompt: str) -> tuple[str, str]:
        """
        Try each model in order. On success return (response_text, model_key).
        On 429 / quota error, mark the model as cooled down and try the next.
        Raises RuntimeError if all models are exhausted.
        """
        import google.api_core.exceptions as gex

        with self._lock:
            candidates = [m for m in MODEL_POOL if self._is_available(m)]

        if not candidates:
            raise RuntimeError("All models are rate-limited. Try again later.")

        for model_info in candidates:
            key = model_info["key"]
            try:
                genai_model = genai.GenerativeModel(
                    key,
                    generation_config={"response_mime_type": "application/json"},
                )
                response = genai_model.generate_content(system_prompt)

                with self._lock:
                    self._record_call(key)

                print(f"[ModelManager] Used: {key}")
                return response.text, key

            except gex.ResourceExhausted as e:
                print(f"[ModelManager] 429 on {key}: {e}")
                with self._lock:
                    self._set_cooldown(key, seconds=65)
                continue  # try next model

            except Exception as e:
                print(f"[ModelManager] Error on {key}: {e}")
                continue  # skip broken model, try next

        raise RuntimeError("All models failed or are rate-limited.")

    def status(self) -> list[dict]:
        """Return current usage snapshot for all models (useful for /api/models endpoint)."""
        now = time.time()
        result = []
        with self._lock:
            for m in MODEL_POOL:
                key = m["key"]
                self._prune(self._minute_calls[key], 60)
                self._prune(self._day_calls[key], 86_400)
                cooldown_remaining = max(0, self._cooldown_until[key] - now)
                result.append({
                    "key":               key,
                    "name":              m["name"],
                    "rpm_limit":         m["rpm"],
                    "rpd_limit":         m["rpd"],
                    "rpm_used":          len(self._minute_calls[key]),
                    "rpd_used":          len(self._day_calls[key]),
                    "available":         self._is_available(m),
                    "cooldown_seconds":  round(cooldown_remaining),
                })
        return result


# Singleton — import this in main.py
model_manager = ModelManager()