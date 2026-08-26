# -*- coding: utf-8 -*-
"""Backoff exponencial simple para ingestion."""


class Backoff:
    """Tras `threshold` fallos consecutivos duplica el intervalo de espera.

    Ejemplo (base 60s): 60 → 120 → 240 → cap 600s.
    """

    def __init__(self, base: float = 60, cap: float = 600, factor: float = 2, threshold: int = 3):
        self.base = base
        self.cap = cap
        self.factor = factor
        self.threshold = threshold
        self.consecutive = 0
        self.delay = base

    def success(self) -> float:
        """Registro de éxito: se restablece el intervalo base."""
        self.consecutive = 0
        self.delay = self.base
        return self.delay

    def failure(self) -> float:
        """Registro de fallo: aumenta el intervalo (con tope)."""
        self.consecutive += 1
        if self.consecutive >= self.threshold:
            self.delay = min(self.delay * self.factor, self.cap)
        return self.delay