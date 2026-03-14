from datetime import datetime, timezone, timedelta

import pytest

from physio_validation import (
    MeasurementInput,
    PhysioValidationConfig,
    validate_measurement,
    MeasurementStatus,
)


def _fixed_now() -> datetime:
    return datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def patch_now(monkeypatch):
    import physio_validation

    monkeypatch.setattr(physio_validation, "_now_utc", lambda: _fixed_now())
    yield


def test_valid_nominal_measurement():
    m = MeasurementInput(
        heart_rate_bpm=75,
        spo2_percent=98,
        temp_celsius=37.0,
        timestamp=_fixed_now(),
        signal_quality_score=90,
    )

    result = validate_measurement(m)

    assert result.status == MeasurementStatus.VALID
    assert result.quality_score == 100
    assert result.hard_rule_violations == []
    assert result.reasons == []


def test_warning_for_soft_out_of_range():
    m = MeasurementInput(
        heart_rate_bpm=205,  # above soft max but below hard max
        spo2_percent=90,
        temp_celsius=39.0,
        timestamp=_fixed_now(),
        signal_quality_score=90,
    )

    result = validate_measurement(m)

    assert result.status == MeasurementStatus.WARNING
    assert result.quality_score < 100
    assert any("Heart rate is very atypical" in r for r in result.reasons)


def test_invalid_for_physically_impossible_values():
    m = MeasurementInput(
        heart_rate_bpm=5,
        spo2_percent=120,
        temp_celsius=50.0,
        timestamp=_fixed_now(),
        signal_quality_score=90,
    )

    result = validate_measurement(m)

    assert result.status == MeasurementStatus.INVALID
    assert "hr_outside_physical_limits" in result.hard_rule_violations
    assert "spo2_outside_physical_limits" in result.hard_rule_violations
    assert "temp_outside_physical_limits" in result.hard_rule_violations
    assert result.quality_score < 60


def test_invalid_for_timestamp_far_in_future():
    m = MeasurementInput(
        heart_rate_bpm=75,
        spo2_percent=98,
        temp_celsius=37.0,
        timestamp=_fixed_now() + timedelta(hours=1),
        signal_quality_score=90,
    )

    result = validate_measurement(m)

    assert result.status == MeasurementStatus.INVALID
    assert "timestamp_too_far_in_future" in result.hard_rule_violations


def test_warning_for_low_quality_and_artefact():
    m = MeasurementInput(
        heart_rate_bpm=75,
        spo2_percent=98,
        temp_celsius=37.0,
        timestamp=_fixed_now(),
        signal_quality_score=40,
        missing_ratio=0.5,
        artefact_flag=True,
    )

    result = validate_measurement(m)

    assert result.status == MeasurementStatus.WARNING
    assert result.quality_score < 70
    assert any("Signal quality reported by device is low." in r for r in result.reasons)
    assert any("High proportion of missing samples" in r for r in result.reasons)
    assert any("Artefacts detected" in r for r in result.reasons)


def test_custom_config_extensibility():
    cfg = PhysioValidationConfig(
        hr_max_soft=220,
        hr_max_hard=280,
    )
    m = MeasurementInput(
        heart_rate_bpm=210,
        spo2_percent=99,
        temp_celsius=37.0,
        timestamp=_fixed_now(),
        signal_quality_score=90,
    )

    result = validate_measurement(m, cfg)

    assert result.status in (MeasurementStatus.VALID, MeasurementStatus.WARNING)
    assert "hr_outside_physical_limits" not in result.hard_rule_violations

