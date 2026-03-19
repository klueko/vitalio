"""
JWT authentication, role resolution, and decorators for the VitalIO API.
"""
import hashlib
import logging
from functools import wraps
from typing import Dict, Any, Optional
from datetime import datetime, timezone
from urllib.request import urlopen
import json

from flask import request, g
from jose import jwt, JWTError

from config import AUTH0_DOMAIN, API_AUDIENCE, AUTH0_ALGORITHMS, AUTH0_ROLE_CLAIM
from database import get_identity_db
from exceptions import AuthError, DatabaseError

logger = logging.getLogger(__name__)


def get_token_auth_header() -> str:
    """Extract JWT token from Authorization header."""
    auth = request.headers.get("Authorization", None)
    if not auth:
        raise AuthError({
            "code": "authorization_header_missing",
            "message": "Authorization header is required"
        }, 401)
    parts = auth.split()
    if parts[0].lower() != "bearer":
        raise AuthError({
            "code": "invalid_header",
            "message": "Authorization header must start with 'Bearer'"
        }, 401)
    if len(parts) != 2:
        raise AuthError({
            "code": "invalid_header",
            "message": "Authorization header must be 'Bearer <token>'"
        }, 401)
    return parts[1]


def get_jwks() -> Dict[str, Any]:
    """Fetch Auth0 JWKS for JWT signature verification."""
    try:
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        jwks_response = urlopen(jwks_url)
        return json.loads(jwks_response.read())
    except Exception as e:
        raise AuthError({
            "code": "jwks_fetch_error",
            "message": f"Failed to fetch JWKS: {str(e)}"
        }, 500)


def get_rsa_key(token: str, jwks: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """Extract RSA public key from JWKS matching the token's key ID."""
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            return None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return {
                    "kty": key["kty"], "kid": key["kid"], "use": key["use"],
                    "n": key["n"], "e": key["e"],
                }
        return None
    except Exception as e:
        raise AuthError({
            "code": "key_extraction_error",
            "message": f"Failed to extract RSA key: {str(e)}"
        }, 401)


def verify_jwt(token: str) -> Dict[str, Any]:
    """Verify JWT token and return decoded payload."""
    if not AUTH0_DOMAIN or not API_AUDIENCE:
        raise AuthError({
            "code": "configuration_error",
            "message": "AUTH0_DOMAIN and AUTH0_AUDIENCE must be configured"
        }, 500)
    jwks = get_jwks()
    rsa_key = get_rsa_key(token, jwks)
    if not rsa_key:
        raise AuthError({
            "code": "invalid_header",
            "message": "Unable to find appropriate key for JWT"
        }, 401)
    try:
        payload = jwt.decode(
            token, rsa_key,
            algorithms=AUTH0_ALGORITHMS,
            audience=API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        if "sub" not in payload:
            raise AuthError({
                "code": "invalid_token",
                "message": "JWT missing 'sub' claim"
            }, 401)
        return payload
    except JWTError as e:
        raise AuthError({
            "code": "invalid_token",
            "message": f"JWT verification failed: {str(e)}"
        }, 401)


def get_or_create_user(auth0_sub: str, email: Optional[str]) -> str:
    """Resolve or create user in Vitalio_Identity.users. Returns user_id_auth."""
    if not auth0_sub:
        raise AuthError({"code": "invalid_token", "message": "Missing Auth0 subject"}, 401)
    try:
        identity_db = get_identity_db()
        if identity_db.users.find_one({"user_id_auth": auth0_sub}):
            return auth0_sub
        try:
            identity_db.users.insert_one({
                "user_id_auth": auth0_sub, "email": email, "role": "patient",
            })
        except Exception as e:
            if "duplicate key" not in str(e).lower() and "E11000" not in str(e):
                raise
        return auth0_sub
    except (AuthError, DatabaseError):
        raise
    except Exception as e:
        raise DatabaseError({
            "code": "user_resolution_error",
            "message": f"Error resolving user: {str(e)}",
        }, 500)


def get_user_role(user_id_auth: str) -> Optional[str]:
    """Return normalized role from identity.users."""
    try:
        doc = get_identity_db().users.find_one(
            {"user_id_auth": user_id_auth},
            projection={"_id": 0, "role": 1}
        )
    except Exception:
        raise DatabaseError({
            "code": "user_role_query_error",
            "message": "Failed to query user role"
        }, 500)
    if not doc:
        return None
    role = str(doc.get("role") or "").strip().lower()
    if role in ("medecin", "superuser"):
        return "doctor"
    if role == "aidant":
        return "caregiver"
    return role


def _provision_user_if_new(user_id_auth: str, jwt_payload: Dict[str, Any]) -> Optional[str]:
    """JIT provision new patient. Returns provisioned role or None. Called lazily by get_current_user_role."""
    if get_identity_db().users.find_one({"user_id_auth": user_id_auth}):
        return None

    ns = "https://vitalio.app/"
    def claim(key):
        return jwt_payload.get(f"{ns}{key}") or jwt_payload.get(key) or ""

    display_name = claim("name") or claim("email") or jwt_payload.get("nickname") or user_id_auth
    first_name = claim("given_name")[:64]
    last_name = claim("family_name")[:64]
    email = claim("email")[:256]
    picture = claim("picture")[:512]
    phone = claim("phone_number")[:32] or None
    birthdate = claim("birthdate")[:16] or None
    pathology = claim("pathology")[:64] or None
    emergency = {
        "last_name": claim("emergency_lastname")[:64] or None,
        "first_name": claim("emergency_firstname")[:64] or None,
        "phone": claim("emergency_phone")[:32] or None,
        "email": claim("emergency_email")[:256] or None,
    }
    has_emergency = any(v for v in emergency.values())

    try:
        get_identity_db().users.update_one(
            {"user_id_auth": user_id_auth},
            {"$set": {
                "user_id_auth": user_id_auth, "role": "patient",
                "display_name": str(display_name)[:128],
                "email": email, "first_name": first_name or None,
                "last_name": last_name or None, "picture": picture or None,
                "phone": phone, "birthdate": birthdate, "pathology": pathology,
                "emergency_contact": emergency if has_emergency else None,
                "created_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )
        device_id = f"SIM-PAT-{hashlib.sha256(user_id_auth.encode()).hexdigest()[:12].upper()}"
        get_identity_db().users_devices.update_one(
            {"user_id_auth": user_id_auth},
            {"$set": {"user_id_auth": user_id_auth, "device_id": device_id}},
            upsert=True,
        )
        logger.info("JIT provisioned patient: %s -> %s", user_id_auth, device_id)

        if has_emergency and emergency.get("email"):
            from services.invitation_service import invite_emergency_contact_if_needed
            patient_name = display_name if display_name != user_id_auth else "Un patient VitalIO"
            invite_emergency_contact_if_needed(user_id_auth, emergency["email"], patient_name)

        return "patient"
    except Exception as e:
        logger.warning("JIT provisioning failed for %s: %s", user_id_auth, e)
        return None


def get_current_user_role() -> str:
    """Extract normalized user role. DB is source of truth; JIT-provisions new users."""
    payload = getattr(g, "jwt_payload", {}) or {}
    current_user_id_auth = getattr(g, "user_id_auth", None)

    if current_user_id_auth:
        db_role = get_user_role(current_user_id_auth)
        if db_role:
            return db_role
        provisioned = _provision_user_if_new(current_user_id_auth, payload)
        if provisioned:
            return provisioned

    role_raw = payload.get(AUTH0_ROLE_CLAIM) or payload.get("role") or payload.get("roles") or payload.get("https://vitalio.app/roles")
    if isinstance(role_raw, list):
        role_raw = role_raw[0] if role_raw else ""
    role = str(role_raw or "").strip().lower()
    if role in ("medecin", "médecin", "superuser"):
        return "doctor"
    if role in ("aidant", "family"):
        return "caregiver"
    if role == "user":
        return "patient"
    return role or "patient"


def requires_auth(f):
    """Decorator to protect routes requiring JWT authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == "OPTIONS":
            return ("", 200)
        token = get_token_auth_header()
        payload = verify_jwt(token)
        auth0_sub = payload.get("sub")
        user_email = payload.get("email")
        if not auth0_sub:
            raise AuthError({
                "code": "invalid_token",
                "message": "JWT missing user identifier in 'sub' claim"
            }, 401)
        user_id = get_or_create_user(auth0_sub, user_email)
        g.user_id_auth = auth0_sub
        g.user_id = user_id
        g.user_email = user_email
        g.jwt_payload = payload
        return f(*args, **kwargs)
    return decorated


def requires_role(*allowed_roles):
    """Decorator that enforces user role from validated JWT claims."""
    normalized_allowed = {str(role).strip().lower() for role in allowed_roles}

    def decorator(f):
        @wraps(f)
        def wrapped(*args, **kwargs):
            role = get_current_user_role()
            if role not in normalized_allowed:
                raise AuthError({
                    "code": "forbidden",
                    "message": f"Role '{role or 'unknown'}' does not have access"
                }, 403)
            g.current_role = role
            return f(*args, **kwargs)
        return wrapped
    return decorator
