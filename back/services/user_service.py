"""
User, device, and relationship helpers.
"""
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone
from pymongo.errors import PyMongoError

from flask import g
from database import get_identity_db, get_medical_db
from exceptions import AuthError, DatabaseError
from api_auth import get_current_user_role, get_user_role


def get_device_ids(user_id_auth: str) -> List[str]:
    """Query users_devices for device IDs mapped to user."""
    try:
        cursor = get_identity_db().users_devices.find(
            {"user_id_auth": user_id_auth},
            projection={"device_id": 1, "_id": 0}
        )
        ids = []
        for doc in cursor:
            device_id = doc.get("device_id")
            if device_id:
                ids.append(str(device_id))
        seen = set()
        ordered = []
        for device_id in ids:
            if device_id not in seen:
                seen.add(device_id)
                ordered.append(device_id)
        return ordered
    except PyMongoError as e:
        raise DatabaseError({
            "code": "correspondence_query_error",
            "message": f"Failed to query identity database: {str(e)}"
        }, 500)


def get_device_id(user_id_auth: str) -> Optional[str]:
    """Return the first mapped device ID for a user."""
    ids = get_device_ids(user_id_auth)
    return ids[0] if ids else None


def get_device_measurements(device_id: str) -> List[Dict[str, Any]]:
    """Query Vitalio_Medical.measurements for vital measurements of a device."""
    try:
        cursor = get_medical_db().measurements.find(
            {"device_id": device_id}
        ).sort("measured_at", -1).limit(100)
        rows = []
        for doc in cursor:
            doc.pop("_id", None)
            ts = doc.get("measured_at")
            timestamp = datetime_to_iso_utc(ts) if isinstance(ts, datetime) else (ts if ts is not None else "")
            rows.append({
                "timestamp": timestamp,
                "heart_rate": doc.get("heart_rate"),
                "spo2": doc.get("spo2"),
                "temperature": doc.get("temperature"),
            })
        return rows
    except PyMongoError as e:
        raise DatabaseError({
            "code": "medical_query_error",
            "message": f"Failed to query medical database: {str(e)}"
        }, 500)


def get_assigned_patient_ids_for_doctor(doctor_user_id_auth: str) -> List[str]:
    """Return patient Auth0 IDs assigned to a doctor."""
    try:
        cursor = get_identity_db().doctor_patients.find(
            {"doctor_user_id_auth": doctor_user_id_auth},
            projection={"_id": 0, "patient_user_id_auth": 1}
        )
        return [doc.get("patient_user_id_auth") for doc in cursor if doc.get("patient_user_id_auth")]
    except PyMongoError as e:
        raise DatabaseError({
            "code": "doctor_assignments_query_error",
            "message": f"Failed to query doctor assignments: {str(e)}"
        }, 500)


def get_assigned_patient_ids_for_caregiver(caregiver_user_id_auth: str) -> List[str]:
    """Return patient Auth0 IDs assigned to a caregiver."""
    try:
        cursor = get_identity_db().caregiver_patients.find(
            {"caregiver_user_id_auth": caregiver_user_id_auth},
            projection={"_id": 0, "patient_user_id_auth": 1}
        )
        return [doc.get("patient_user_id_auth") for doc in cursor if doc.get("patient_user_id_auth")]
    except PyMongoError as e:
        raise DatabaseError({
            "code": "caregiver_assignments_query_error",
            "message": f"Failed to query caregiver assignments: {str(e)}"
        }, 500)


def get_assigned_doctor_ids_for_patient(patient_user_id_auth: str) -> List[str]:
    """Return doctor Auth0 IDs assigned to a patient."""
    try:
        cursor = get_identity_db().doctor_patients.find(
            {"patient_user_id_auth": patient_user_id_auth},
            projection={"_id": 0, "doctor_user_id_auth": 1}
        )
        return [doc.get("doctor_user_id_auth") for doc in cursor if doc.get("doctor_user_id_auth")]
    except PyMongoError as e:
        raise DatabaseError({
            "code": "doctor_assignments_query_error",
            "message": f"Failed to query doctor assignments for patient: {str(e)}"
        }, 500)


def relationship_exists(relationship_type: str, user_id_auth: str, patient_user_id_auth: str) -> bool:
    """Check if relationship exists between doctor/caregiver and patient."""
    identity_db = get_identity_db()
    if relationship_type == "doctor":
        query = {"doctor_user_id_auth": user_id_auth, "patient_user_id_auth": patient_user_id_auth}
        return identity_db.doctor_patients.find_one(query, projection={"_id": 1}) is not None
    if relationship_type == "caregiver":
        query = {"caregiver_user_id_auth": user_id_auth, "patient_user_id_auth": patient_user_id_auth}
        return identity_db.caregiver_patients.find_one(query, projection={"_id": 1}) is not None
    return False


def ensure_patient_access_or_403(patient_user_id_auth: str):
    """Enforce patient data access by role + relationship."""
    current_user_id_auth = g.user_id_auth
    role = get_current_user_role()
    if not role or role == "unknown":
        role = get_user_role(current_user_id_auth) or role

    if current_user_id_auth == patient_user_id_auth:
        return
    if role == "admin":
        return
    if role == "patient":
        raise AuthError({
            "code": "forbidden",
            "message": "Patient users can only access their own data"
        }, 403)
    if role == "doctor":
        if not relationship_exists("doctor", current_user_id_auth, patient_user_id_auth):
            raise AuthError({
                "code": "patient_not_assigned",
                "message": "This patient is not assigned to the authenticated doctor"
            }, 403)
        return
    if role == "caregiver":
        if not relationship_exists("caregiver", current_user_id_auth, patient_user_id_auth):
            raise AuthError({
                "code": "patient_not_assigned",
                "message": "This patient is not assigned to the authenticated caregiver"
            }, 403)
        return
    raise AuthError({
        "code": "forbidden",
        "message": f"Role '{role or 'unknown'}' cannot access patient resources"
    }, 403)


def datetime_to_iso_utc(dt: Any) -> str:
    """
    Serialize datetime to ISO string with explicit UTC timezone (+00:00 or Z).
    MongoDB/PyMongo returns naive datetimes that represent UTC; without timezone
    info, JavaScript's Date() interprets them as local time, causing 1h offset
    for users in UTC+1 (e.g. France).
    """
    if dt is None:
        return ""
    if not isinstance(dt, datetime):
        return str(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_iso_datetime(value: Optional[str], field_name: str) -> Optional[datetime]:
    """Parse ISO date/time query parameter into datetime (UTC-naive)."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.replace(tzinfo=None)
        return parsed
    except Exception:
        raise ValueError(f"Invalid datetime format for '{field_name}', expected ISO-8601")


def normalize_user_id_auth(value: Any, field_name: str) -> str:
    """Normalize Auth0 subject identifier."""
    normalized = str(value or "").strip()
    if not normalized:
        raise ValueError(f"{field_name} is required")
    return normalized


def get_user_profile(user_id_auth: str) -> Dict[str, Any]:
    """Get profile display data for one user."""
    try:
        profile = get_identity_db().users.find_one(
            {"user_id_auth": user_id_auth},
            projection={
                "_id": 0, "display_name": 1, "email": 1,
                "first_name": 1, "last_name": 1, "age": 1, "sex": 1,
                "contact": 1, "picture": 1, "emergency_contact": 1,
            }
        )
        return profile or {}
    except PyMongoError as e:
        raise DatabaseError({
            "code": "user_profile_query_error",
            "message": f"Failed to query user profile: {str(e)}"
        }, 500)


def _split_display_name(display_name: str) -> tuple:
    """Split 'Dr. Jean Dupont' into (first_name, last_name)."""
    if not display_name or not isinstance(display_name, str):
        return ("", "")
    parts = str(display_name).strip().split(None, 2)
    if len(parts) >= 3:
        return (parts[1], parts[2])
    if len(parts) == 2:
        return (parts[0], parts[1])
    if len(parts) == 1:
        return (parts[0], "")
    return ("", "")
