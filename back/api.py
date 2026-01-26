import json
import os
import threading
from urllib.request import urlopen
from functools import wraps
from typing import Dict, List, Optional, Any
from datetime import datetime
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from jose import jwt, JWTError
from jose.constants import ALGORITHMS
from dotenv import load_dotenv
from supabase import create_client, Client
import paho.mqtt.client as mqtt

env_path = '.env'
if not os.path.exists(env_path):
    env_path = '../.env'
load_dotenv(env_path)

app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# ============================================================================
# CONFIGURATION
# ============================================================================

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
API_AUDIENCE = os.getenv("AUTH0_AUDIENCE")
ALGORITHMS = ["RS256"]

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "8883"))  # TLS port (8883), not unencrypted (1883)
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "vitalio/dev/+/measurements")
MQTT_USERNAME = os.getenv("MQTT_USERNAME", "")  # Required for authentication
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD", "")  # Required for authentication
MQTT_CA_CERT = os.getenv("MQTT_CA_CERT", "./mosquitto/certs/ca.crt")  # CA certificate for TLS verification

_supabase_client: Optional[Client] = None

_mqtt_client: Optional[mqtt.Client] = None
_mqtt_thread: Optional[threading.Thread] = None


def get_supabase_client() -> Optional[Client]:
    """
    Get or create Supabase client instance.
    Initializes client lazily to allow API to start without valid credentials.
    
    Returns:
        Client: Supabase client if credentials are valid, None otherwise
        
    Raises:
        DatabaseError: If credentials are provided but invalid
    """
    global _supabase_client
    
    if _supabase_client is not None:
        return _supabase_client
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    
    try:
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {str(e)}")
        print("API will start but database operations will fail until credentials are fixed.")
        return None

# ============================================================================
# ERROR HANDLING
# ============================================================================

class AuthError(Exception):
    """Custom exception for authentication/authorization errors."""
    def __init__(self, error: Dict[str, str], status_code: int):
        self.error = error
        self.status_code = status_code


class DatabaseError(Exception):
    """Custom exception for database operation errors."""
    def __init__(self, error: Dict[str, str], status_code: int):
        self.error = error
        self.status_code = status_code


@app.errorhandler(AuthError)
def handle_auth_error(ex: AuthError):
    """Handle authentication errors."""
    return jsonify(ex.error), ex.status_code


@app.errorhandler(DatabaseError)
def handle_database_error(ex: DatabaseError):
    """Handle database errors."""
    return jsonify(ex.error), ex.status_code


@app.errorhandler(500)
def handle_internal_error(e):
    """Handle internal server errors."""
    return jsonify({
        "code": "internal_server_error",
        "message": "An internal server error occurred"
    }), 500

# ============================================================================
# JWT AUTHENTICATION (Sequence Steps 3-5)
# ============================================================================

def get_token_auth_header() -> str:
    """
    Extract JWT token from Authorization header.
    
    Sequence Step 3: Frontend calls GET /api/me/data with Authorization: Bearer <JWT>
    
    Returns:
        str: JWT token string
        
    Raises:
        AuthError: If Authorization header is missing or malformed
    """
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
    """
    Fetch Auth0 JWKS (JSON Web Key Set) for JWT signature verification.
    
    Returns:
        dict: JWKS containing public keys for JWT verification
    """
    try:
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        jwks_response = urlopen(jwks_url)
        jwks = json.loads(jwks_response.read())
        return jwks
    except Exception as e:
        raise AuthError({
            "code": "jwks_fetch_error",
            "message": f"Failed to fetch JWKS: {str(e)}"
        }, 500)


def get_rsa_key(token: str, jwks: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """
    Extract RSA public key from JWKS matching the token's key ID.
    
    Args:
        token: JWT token string
        jwks: JWKS dictionary from Auth0
        
    Returns:
        dict: RSA key dictionary with kty, kid, use, n, e fields, or None if not found
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        
        if not kid:
            return None
        
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"],
                }
        
        return None
    except Exception as e:
        raise AuthError({
            "code": "key_extraction_error",
            "message": f"Failed to extract RSA key: {str(e)}"
        }, 401)


def verify_jwt(token: str) -> Dict[str, Any]:
    """
    Verify JWT token signature, issuer, audience, and expiration.
    
    Sequence Step 4: Flask API verifies:
    - JWT signature (RS256)
    - issuer
    - audience
    - expiration
    - extracts user_id from the 'sub' claim
    
    Args:
        token: JWT token string
        
    Returns:
        dict: Decoded JWT payload containing user information
        
    Raises:
        AuthError: If JWT verification fails
    """
    if not AUTH0_DOMAIN:
        raise AuthError({
            "code": "configuration_error",
            "message": "AUTH0_DOMAIN not configured"
        }, 500)
    
    if not API_AUDIENCE:
        raise AuthError({
            "code": "configuration_error",
            "message": "AUTH0_AUDIENCE not configured"
        }, 500)
    
    # Fetch JWKS
    jwks = get_jwks()
    
    # Extract RSA key
    rsa_key = get_rsa_key(token, jwks)
    
    if not rsa_key:
        raise AuthError({
            "code": "invalid_header",
            "message": "Unable to find appropriate key for JWT"
        }, 401)
    
    # Verify and decode JWT
    try:
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        
        # Ensure 'sub' claim exists (user_id)
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
    except Exception as e:
        raise AuthError({
            "code": "token_processing_error",
            "message": f"Error processing token: {str(e)}"
        }, 401)


def requires_auth(f):
    """
    Decorator to protect routes requiring JWT authentication.
    
    Sequence Steps 3-5:
    - Extracts JWT from Authorization header
    - Verifies JWT (signature, issuer, audience, expiration)
    - Extracts user_id from 'sub' claim
    - Stores authenticated user info in Flask request context (g)
    
    Args:
        f: Route function to protect
        
    Returns:
        Decorated function that requires valid JWT
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Extract JWT token from Authorization header
        token = get_token_auth_header()
        
        # Verify JWT (signature, issuer, audience, expiration)
        payload = verify_jwt(token)
        
        # Extract user_id from 'sub' claim and store in request context
        user_id_auth = payload.get("sub")
        
        if not user_id_auth:
            raise AuthError({
                "code": "invalid_token",
                "message": "JWT missing user identifier in 'sub' claim"
            }, 401)
        
        # Store authenticated user information in Flask request context
        g.user_id_auth = user_id_auth
        g.jwt_payload = payload
        
        return f(*args, **kwargs)
    
    return decorated

# ============================================================================
# DATABASE ACCESS LAYER
# ============================================================================

def get_device_id(user_id_auth: str) -> Optional[str]:
    """
    Query correspondence database to map Auth0 user_id to device_id.
    
    Sequence Steps 6-7:
    - API queries correspondence database:
      SELECT device_id WHERE user_id_auth = <JWT sub>
    - Correspondence database returns device_id
    
    Args:
        user_id_auth: Auth0 user ID from JWT 'sub' claim
        
    Returns:
        str: device_id if found, None otherwise
        
    Raises:
        DatabaseError: If database query fails
    """
    supabase_client = get_supabase_client()
    if not supabase_client:
        raise DatabaseError({
            "code": "database_not_configured",
            "message": "Database client not initialized. Please check SUPABASE_URL and SUPABASE_KEY in .env file"
        }, 500)
    
    try:
        # Query correspondence database
        # SELECT device_id WHERE user_id_auth = <JWT sub>
        response = supabase_client.table("users_devices").select(
            "device_id"
        ).eq(
            "user_id_auth", user_id_auth
        ).execute()
        
        # Extract device_id from response
        if response.data and len(response.data) > 0:
            device_id = response.data[0].get("device_id")
            return device_id
        
        return None
        
    except Exception as e:
        raise DatabaseError({
            "code": "correspondence_query_error",
            "message": f"Failed to query correspondence database: {str(e)}"
        }, 500)


def get_device_measurements(device_id: str) -> List[Dict[str, Any]]:
    """
    Query medical database to fetch vital measurements for a device.
    
    Sequence Steps 8-9:
    - API queries medical database:
      SELECT timestamp, heart_rate, spo2, temperature WHERE device_id = ?
    - Medical database returns the vital measurements
    
    Args:
        device_id: Device ID from correspondence database (TEXT)
        
    Returns:
        list: List of measurement dictionaries containing:
            - timestamp
            - heart_rate
            - spo2
            - temperature
            
    Raises:
        DatabaseError: If database query fails
    """
    supabase_client = get_supabase_client()
    if not supabase_client:
        raise DatabaseError({
            "code": "database_not_configured",
            "message": "Database client not initialized. Please check SUPABASE_URL and SUPABASE_KEY in .env file"
        }, 500)
    
    try:
        # Query medical database
        # SELECT timestamp, heart_rate, spo2, temperature WHERE device_id = ?
        response = supabase_client.table("measurements").select(
            "timestamp, heart_rate, spo2, temperature"
        ).eq(
            "device_id", device_id
        ).order("timestamp", desc=True).limit(100).execute()
        
        # Return vital measurements
        if response.data:
            return response.data
        
        return []
        
    except Exception as e:
        raise DatabaseError({
            "code": "medical_query_error",
            "message": f"Failed to query medical database: {str(e)}"
        }, 500)

# ============================================================================
# API ROUTES
# ============================================================================

@app.route("/api/me/data", methods=["GET"])
@requires_auth
def get_patient_data():
    """
    Protected route to fetch patient medical data.
    
    Implements complete sequence (Steps 1-10):
    1. Frontend authenticates via Auth0 (handled by frontend)
    2. Auth0 returns signed JWT (handled by Auth0)
    3. Frontend calls GET /api/me/data with Authorization: Bearer <JWT> (this route)
    4. Flask API verifies JWT (handled by @requires_auth decorator)
    5. API authorizes request and identifies user as patient (handled by @requires_auth)
    6. API queries correspondence database (get_device_id)
    7. Correspondence database returns device_id
    8. API queries medical database (get_device_measurements)
    9. Medical database returns vital measurements
    10. API returns minimal device identity + medical measurements
    
    Returns:
        JSON response containing:
        - device_id: Minimal device identity (pivot ID only, TEXT)
        - measurements: List of vital measurements
        
    Raises:
        AuthError: If authentication fails
        DatabaseError: If database queries fail
    """
    # g.user_id_auth contains the Auth0 user ID from JWT 'sub' claim
    
    device_id = get_device_id(g.user_id_auth)
    
    if not device_id:
        raise DatabaseError({
            "code": "device_not_found",
            "message": "No device record found for authenticated user"
        }, 404)
    
    # Query medical database to get vital measurements
    measurements = get_device_measurements(device_id)
    
    # Return minimal device identity (device_id only) + medical measurements
    return jsonify({
        "device_id": device_id,
        "measurements": measurements,
        "measurement_count": len(measurements)
    }), 200


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for monitoring."""
    return jsonify({
        "status": "healthy",
        "service": "healthcare-api"
    }), 200


# ============================================================================
# MQTT SUBSCRIBER
# ============================================================================

def validate_measurement_payload(payload: dict) -> dict:
    """
    Validate IoT sensor payload and return validation status.
    
    Args:
        payload: Dictionary containing sensor data
        
    Returns:
        dict: Validation result with status and reasons
    """
    reasons = []
    
    sensors = payload.get("sensors", {})
    max30102 = sensors.get("MAX30102", {})
    mlx90614 = sensors.get("MLX90614", {})
    
    hr = max30102.get("heart_rate")
    spo2 = max30102.get("spo2")
    temp = mlx90614.get("object_temp")
    signal_quality = payload.get("signal_quality")
    
    # ---- Heart Rate ----
    if hr is None or hr < 30 or hr > 220:
        reasons.append("heart_rate_out_of_range")
    
    # ---- SpO2 ----
    if spo2 is None or spo2 < 70 or spo2 > 100:
        reasons.append("spo2_out_of_range")
    
    # ---- Temperature ----
    if temp is None or temp < 34 or temp > 42:
        reasons.append("temperature_out_of_range")
    
    # ---- Signal Quality ----
    if signal_quality is None or signal_quality < 50:
        reasons.append("low_signal_quality")
    
    status = "VALID" if not reasons else "INVALID"
    
    return {
        "status": status,
        "reasons": reasons,
        "validated_at": datetime.utcnow().isoformat()
    }


def on_mqtt_message(client, userdata, msg):
    """
    Handle incoming MQTT messages from IoT devices.
    Extracts device ID from topic and inserts measurements into Supabase.
    """
    try:
        payload = json.loads(msg.payload.decode())
        
        # Extract device ID from topic (e.g., "SIM-ESP32-001" from "vitalio/dev/SIM-ESP32-001/measurements")
        topic_parts = msg.topic.split('/')
        device_id = topic_parts[2] if len(topic_parts) > 2 else None
        
        if not device_id:
            print(f"Warning: Could not extract device ID from topic: {msg.topic}")
            return
        
        validation = validate_measurement_payload(payload)
        
        # Get Supabase client
        supabase_client = get_supabase_client()
        if not supabase_client:
            print("Error: Supabase client not available for MQTT subscriber")
            return
        
        # Prepare data for insertion (device_id as TEXT pivot)
        data_to_insert = {
            "device_id": device_id,  # Device ID from MQTT topic (TEXT)
            "timestamp": payload["timestamp"],
            "heart_rate": payload["sensors"]["MAX30102"]["heart_rate"],
            "spo2": payload["sensors"]["MAX30102"]["spo2"],
            "temperature": payload["sensors"]["MLX90614"]["object_temp"],
            "signal_quality": payload["signal_quality"],
            "status": validation["status"]
        }
        
        # Insert into Supabase
        try:
            response = supabase_client.table("measurements").insert(data_to_insert).execute()
            print(f"Measurement inserted for device {device_id} (status: {validation['status']})")
        except Exception as db_error:
            print(f"Error inserting measurement for device {device_id}: {str(db_error)}")
    
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON payload in MQTT message - {str(e)}")
    except KeyError as e:
        print(f"Error: Missing key in payload - {str(e)}")
    except Exception as e:
        print(f"Error processing MQTT message: {str(e)}")


def on_mqtt_connect(client, userdata, flags, rc, properties=None):
    """Callback for MQTT connection."""
    if rc == 0:
        print(f"MQTT subscriber connected to {MQTT_BROKER}:{MQTT_PORT}")
        print(f"Subscribed to topic: {MQTT_TOPIC}")
        client.subscribe(MQTT_TOPIC, qos=1)
    else:
        print(f"MQTT connection failed with code: {rc}")


def on_mqtt_subscribe(client, userdata, mid, granted_qos, properties=None):
    """Callback for MQTT subscription confirmation."""
    print(f"MQTT subscription confirmed (QoS: {granted_qos[0]})")


def start_mqtt_subscriber():
    """
    Start MQTT subscriber in a background thread.
    This allows the Flask app to run while MQTT messages are processed.
    """
    global _mqtt_client, _mqtt_thread
    
    # Check if MQTT is configured
    if not MQTT_BROKER:
        print("MQTT_BROKER not configured, skipping MQTT subscriber")
        return
    
    def mqtt_thread_function():
        """
        Thread function to run MQTT client loop with TLS encryption.
        
        Healthcare Security Requirements:
        - TLS 1.2+ encryption for all MQTT traffic
        - CA certificate validation (broker authentication)
        - Username/password authentication (client authentication)
        - No fallback to insecure connections
        """
        global _mqtt_client
        
        try:
            # Create MQTT client
            _mqtt_client = mqtt.Client(
                mqtt.CallbackAPIVersion.VERSION2,
                client_id="VitalIO_API_Subscriber"
            )
            
            # Set callbacks
            _mqtt_client.on_connect = on_mqtt_connect
            _mqtt_client.on_subscribe = on_mqtt_subscribe
            _mqtt_client.on_message = on_mqtt_message
            
            # ====================================================================
            # TLS CONFIGURATION
            # ====================================================================
            
            # Verify CA certificate path exists
            if not os.path.exists(MQTT_CA_CERT):
                raise FileNotFoundError(
                    f"CA certificate not found: {MQTT_CA_CERT}\n"
                    "Please generate certificates using: mosquitto/generate_certificates.ps1"
                )
            
            # Configure TLS
            # cafile: CA certificate to verify broker identity
            # tls_version: Enforce TLS 1.2 or higher (healthcare requirement)
            _mqtt_client.tls_set(
                ca_certs=MQTT_CA_CERT,
                certfile=None,  # Client certificate not required (using username/password)
                keyfile=None,   # Client key not required (using username/password)
                tls_version=mqtt.ssl.PROTOCOL_TLSv1_2,  # TLS 1.2 minimum
                cert_reqs=mqtt.ssl.CERT_REQUIRED,  # Require broker certificate validation
                ciphers=None  # Use default secure cipher suites
            )
            
            # Username/password authentication (required - anonymous access disabled)
            if not MQTT_USERNAME or not MQTT_PASSWORD:
                raise ValueError(
                    "MQTT_USERNAME and MQTT_PASSWORD must be set in environment variables.\n"
                    "Anonymous connections are disabled for security."
                )
            
            _mqtt_client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)
            
            # ====================================================================
            # CONNECT TO BROKER
            # ====================================================================
            
            print(f"Connecting to MQTT broker via TLS {MQTT_BROKER}:{MQTT_PORT}...")
            print(f"   CA Certificate: {MQTT_CA_CERT}")
            print(f"   Username: {MQTT_USERNAME}")
            print(f"   TLS Version: 1.2+ (enforced)")
            
            _mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            _mqtt_client.loop_forever()
            
        except FileNotFoundError as e:
            print(f"Error: {str(e)}")
        except ValueError as e:
            print(f"Error: {str(e)}")
        except Exception as e:
            print(f"Error in MQTT subscriber thread: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Start MQTT subscriber in background thread
    _mqtt_thread = threading.Thread(target=mqtt_thread_function, daemon=True)
    _mqtt_thread.start()
    print("MQTT subscriber started in background thread")

if __name__ == "__main__":
    # Start MQTT subscriber in background before starting Flask
    start_mqtt_subscriber()
    
    # Production settings
    app.run(
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "False").lower() == "true"
    )
