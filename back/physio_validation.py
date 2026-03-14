from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Optional, Dict, Any, List


class MeasurementStatus(str, Enum):
    VALID = "valid"
    WARNING = "warning"
    INVALID = "invalid"


@dataclass(frozen=True)
class MeasurementInput:
    heart_rate_bpm: Optional[float]
    spo2_percent: Optional[float]
    temp_celsius: Optional[float]
    timestamp: datetime
    signal_quality_score: Optional[int] = None  # 0–100 from device / edge
    missing_ratio: Optional[float] = None       # 0–1 (for windowed data)
    artefact_flag: Optional[bool] = None
    meta: Optional[Dict[str, Any]] = None       # extensible (device_id, raw payload, etc.)


@dataclass(frozen=True)
class ValidationResult:
    status: MeasurementStatus
    quality_score: int               # 0–100
    reasons: List[str]               # human-readable explanations
    hard_rule_violations: List[str]  # for audit / debugging


@dataclass(frozen=True)
class PhysioValidationConfig:
    # Hard physiological limits (virtually impossible -> INVALID)
    hr_min_hard: float = 20.0
    hr_max_hard: float = 260.0
    spo2_min_hard: float = 40.0
    spo2_max_hard: float = 100.0
    temp_min_hard: float = 30.0
    temp_max_hard: float = 43.0

    # Soft physiological limits (very atypical but possible -> WARNING)
    hr_min_soft: float = 35.0
    hr_max_soft: float = 200.0
    spo2_min_soft: float = 85.0
    temp_min_soft: float = 35.0
    temp_max_soft: float = 40.0

    # Acceptable timestamp skew vs server
    max_future_skew: timedelta = timedelta(minutes=5)
    max_past_skew: timedelta = timedelta(days=7)

    # Scoring penalties
    base_score: int = 100
    penalty_soft_out_of_range: int = 10
    penalty_hard_out_of_range: int = 40
    penalty_low_signal_quality: int = 20
    penalty_missing_ratio_high: int = 25
    penalty_artefact: int = 30

    # Classification thresholds
    warning_quality_threshold: int = 70


def _clamp(value: int, min_v: int = 0, max_v: int = 100) -> int:
    return max(min_v, min(max_v, value))


def _now_utc() -> datetime:
    # Isolated for easier testing / monkeypatching
    return datetime.now(timezone.utc)


def validate_measurement(
    m: MeasurementInput,
    config: PhysioValidationConfig = PhysioValidationConfig(),
) -> ValidationResult:
    """
    Pure validation function (no I/O).

    - Applies physiological rules
    - Computes a 0–100 quality score
    - Classifies as valid / warning / invalid
    """
    reasons: List[str] = []
    hard_violations: List[str] = []
    score = config.base_score

    # 1) Timestamp validation
    now = _now_utc()
    if m.timestamp > now + config.max_future_skew:
        hard_violations.append("timestamp_too_far_in_future")
        reasons.append("Timestamp is too far in the future compared to server time.")
        score -= config.penalty_hard_out_of_range

    if m.timestamp < now - config.max_past_skew:
        hard_violations.append("timestamp_too_far_in_past")
        reasons.append("Timestamp is too far in the past compared to allowed window.")
        score -= config.penalty_hard_out_of_range

    # 2) Heart rate
    if m.heart_rate_bpm is not None:
        hr = m.heart_rate_bpm
        if hr < config.hr_min_hard or hr > config.hr_max_hard:
            hard_violations.append("hr_outside_physical_limits")
            reasons.append("Heart rate outside plausible physical limits.")
            score -= config.penalty_hard_out_of_range
        elif hr < config.hr_min_soft or hr > config.hr_max_soft:
            reasons.append("Heart rate is very atypical for an adult.")
            score -= config.penalty_soft_out_of_range

    # 3) SpO2
    if m.spo2_percent is not None:
        s = m.spo2_percent
        if s < config.spo2_min_hard or s > config.spo2_max_hard:
            hard_violations.append("spo2_outside_physical_limits")
            reasons.append("SpO2 outside plausible physical limits.")
            score -= config.penalty_hard_out_of_range
        elif s < config.spo2_min_soft:
            reasons.append("SpO2 is very low; could be severe hypoxemia or artefact.")
            score -= config.penalty_soft_out_of_range

    # 4) Temperature
    if m.temp_celsius is not None:
        t = m.temp_celsius
        if t < config.temp_min_hard or t > config.temp_max_hard:
            hard_violations.append("temp_outside_physical_limits")
            reasons.append("Body temperature outside plausible physical limits.")
            score -= config.penalty_hard_out_of_range
        elif t < config.temp_min_soft or t > config.temp_max_soft:
            reasons.append("Body temperature is very atypical (marked hypo/hyperthermia).")
            score -= config.penalty_soft_out_of_range

    # 5) Signal quality (0–100 from device)
    if m.signal_quality_score is not None:
        if m.signal_quality_score < 50:
            reasons.append("Signal quality reported by device is low.")
            score -= config.penalty_low_signal_quality

    # 6) Missing data in window
    if m.missing_ratio is not None and m.missing_ratio > 0.4:
        reasons.append("High proportion of missing samples in window.")
        score -= config.penalty_missing_ratio_high

    # 7) Artefacts
    if m.artefact_flag:
        reasons.append("Artefacts detected in the window.")
        score -= config.penalty_artefact

    # Final score clamp
    score = _clamp(int(round(score)))

    # 8) Classification
    if hard_violations:
        status = MeasurementStatus.INVALID
    elif score < config.warning_quality_threshold or reasons:
        status = MeasurementStatus.WARNING
    else:
        status = MeasurementStatus.VALID

    return ValidationResult(
        status=status,
        quality_score=score,
        reasons=reasons,
        hard_rule_violations=hard_violations,
    )

