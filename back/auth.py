importjson
importos
fromurllib.requestimporturlopen
fromfunctoolsimportwraps
fromflaskimportFlask,request,jsonify,g
fromjoseimportjwt
fromdotenvimportload_dotenv

load_dotenv()

app=Flask(__name__)

AUTH0_DOMAIN=os.getenv("AUTH0_DOMAIN")
API_AUDIENCE=os.getenv("AUTH0_AUDIENCE")
ALGORITHMS=["RS256"]

classAuthError(Exception):
    def__init__(self,error,status_code):
        self.error=error
self.status_code=status_code

@app.errorhandler(AuthError)
defhandle_auth_error(ex):
    returnjsonify(ex.error),ex.status_code

defget_token_auth_header():
    auth=request.headers.get("Authorization",None)
ifnotauth:
        raiseAuthError({"code":"authorization_header_missing"},401)

parts=auth.split()
ifparts[0].lower()!="bearer":
        raiseAuthError({"code":"invalid_header"},401)
iflen(parts)!=2:
        raiseAuthError({"code":"invalid_header"},401)

returnparts[1]

defrequires_auth(f):
    @wraps(f)
defdecorated(*args,**kwargs):
        token=get_token_auth_header()

jwks=json.loads(
urlopen(f"https://{AUTH0_DOMAIN}/.well-known/jwks.json").read()
)

unverified_header=jwt.get_unverified_header(token)
rsa_key=next(
(
{
"kty":key["kty"],
"kid":key["kid"],
"use":key["use"],
"n":key["n"],
"e":key["e"],
}
forkeyinjwks["keys"]
ifkey["kid"]==unverified_header["kid"]
),
None,
)

ifnotrsa_key:
            raiseAuthError({"code":"invalid_header"},401)

payload=jwt.decode(
token,
rsa_key,
algorithms=ALGORITHMS,
audience=API_AUDIENCE,
issuer=f"https://{AUTH0_DOMAIN}/"
)

g.current_user=payload
returnf(*args,**kwargs)

returndecorated

@app.route("/api/public")
defpublic():
    returnjsonify(message="Public endpoint")

@app.route("/api/private")
@requires_auth
defprivate():
    returnjsonify(
message="Protected endpoint",
user=g.current_user["sub"]
)

if__name__=="__main__":
    app.run(debug=True,port=5000)
