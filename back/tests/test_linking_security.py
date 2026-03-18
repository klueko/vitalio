importunittest
fromdatetimeimportdatetime,timedelta
fromtypesimportSimpleNamespace
fromunittest.mockimportpatch

importapi

classFakeDoctorPatientsCollection:
    def__init__(self,already_exists=False):
        self.already_exists=already_exists

defupdate_one(self,*_args,**_kwargs):
        returnSimpleNamespace(upserted_id=Noneifself.already_existselse"new-id")

classFakeIdentityDB:
    def__init__(self,invite_doc=None,already_exists=False):
        self._invite_doc=invite_doc
self.doctor_patients=FakeDoctorPatientsCollection(already_exists=already_exists)

@property
defdoctor_invites(self):
        returnself

deffind_one(self,query):
        ifnotself._invite_doc:
            returnNone
ifquery.get("token_hash")==self._invite_doc.get("token_hash")andquery.get("mode")==self._invite_doc.get("mode"):
            returnself._invite_doc
returnNone

classLinkingSecurityTests(unittest.TestCase):
    deftest_hash_secret_token_stable(self):
        token="sample-token"
self.assertEqual(api.hash_secret_token(token),api.hash_secret_token(token))
self.assertNotEqual(api.hash_secret_token(token),api.hash_secret_token("other-token"))

deftest_get_invite_document_or_404_not_found(self):
        withpatch.object(api,"get_identity_db",return_value=FakeIdentityDB(invite_doc=None)):
            withself.assertRaises(api.AuthError)ascm:
                api.get_invite_document_or_404("missing",mode="invite_link")
self.assertEqual(cm.exception.status_code,404)

deftest_get_invite_document_or_404_used(self):
        invite={
"token_hash":api.hash_secret_token("abc"),
"mode":"invite_link",
"used_at":datetime.utcnow(),
"expires_at":datetime.utcnow()+timedelta(hours=1),
}
withpatch.object(api,"get_identity_db",return_value=FakeIdentityDB(invite_doc=invite)):
            withself.assertRaises(api.AuthError)ascm:
                api.get_invite_document_or_404("abc",mode="invite_link")
self.assertEqual(cm.exception.status_code,409)

deftest_get_invite_document_or_404_expired(self):
        invite={
"token_hash":api.hash_secret_token("abc"),
"mode":"invite_link",
"used_at":None,
"expires_at":datetime.utcnow()-timedelta(minutes=1),
}
withpatch.object(api,"get_identity_db",return_value=FakeIdentityDB(invite_doc=invite)):
            withself.assertRaises(api.AuthError)ascm:
                api.get_invite_document_or_404("abc",mode="invite_link")
self.assertEqual(cm.exception.status_code,410)

deftest_create_doctor_patient_link_success(self):
        withpatch.object(api,"get_identity_db",return_value=FakeIdentityDB(already_exists=False)):
            created=api.create_doctor_patient_link(
doctor_user_id_auth="auth0|doctor",
patient_user_id_auth="auth0|patient",
linked_by="admin",
linked_by_user_id_auth="auth0|admin",
)
self.assertTrue(created)

deftest_create_doctor_patient_link_duplicate(self):
        withpatch.object(api,"get_identity_db",return_value=FakeIdentityDB(already_exists=True)):
            created=api.create_doctor_patient_link(
doctor_user_id_auth="auth0|doctor",
patient_user_id_auth="auth0|patient",
linked_by="admin",
linked_by_user_id_auth="auth0|admin",
)
self.assertFalse(created)

if__name__=="__main__":
    unittest.main()
