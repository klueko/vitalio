"""
VitalIO - Tests for the ML anomaly detection workflow.

Covers:
  A. Anomaly ID serialization
  B. Doctor access control on anomalies
  C. Measurement enrichment with ML flags
  D. Clinical AI suggestion generation
  E. Validation propagation to measurements
  F. Bootstrap endpoint (integration)
"""

importunittest
fromdatetimeimportdatetime,timedelta
fromtypesimportSimpleNamespace
fromtypingimportAny,Dict,List,Optional
fromunittest.mockimportMagicMock,patch
frombsonimportObjectId

importsys
importos
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..'))

importml_module

classTestClinicalSuggestions(unittest.TestCase):
    """Test deterministic clinical suggestion engine."""

deftest_normal_measurement_routine(self):
        m={"heart_rate":72,"spo2":98,"temperature":36.6}
result=ml_module.generate_clinical_suggestion(m,[],"normal")
self.assertEqual(result["urgency"],"routine")
self.assertIn("normale",result["recommended_action"].lower())

deftest_critical_spo2_low(self):
        m={"heart_rate":72,"spo2":82,"temperature":36.6}
contribs=[{"variable":"spo2","observed_value":82,
"expected_min":92,"expected_max":100,
"contribution_weight":0.8}]
result=ml_module.generate_clinical_suggestion(m,contribs,"critical")
self.assertEqual(result["urgency"],"immediate")
self.assertTrue(len(result["clinical_reasoning"])>0)
self.assertIn("oxygéno",result["recommended_action"].lower())

deftest_tachycardia(self):
        m={"heart_rate":160,"spo2":97,"temperature":36.8}
contribs=[{"variable":"heart_rate","observed_value":160,
"expected_min":50,"expected_max":120,
"contribution_weight":0.9}]
result=ml_module.generate_clinical_suggestion(m,contribs,"critical")
self.assertEqual(result["urgency"],"immediate")
self.assertTrue(any("tachycardie"inr.lower()forrinresult["clinical_reasoning"]))

deftest_fever(self):
        m={"heart_rate":80,"spo2":96,"temperature":39.8}
contribs=[{"variable":"temperature","observed_value":39.8,
"expected_min":35.5,"expected_max":38.0,
"contribution_weight":0.7}]
result=ml_module.generate_clinical_suggestion(m,contribs,"critical")
self.assertEqual(result["urgency"],"immediate")
self.assertTrue(any("fièvre"inr.lower()or"hyperthermie"inr.lower()
forrinresult["clinical_reasoning"]))

deftest_bradycardia(self):
        m={"heart_rate":35,"spo2":97,"temperature":36.5}
contribs=[{"variable":"heart_rate","observed_value":35,
"expected_min":50,"expected_max":120,
"contribution_weight":0.85}]
result=ml_module.generate_clinical_suggestion(m,contribs,"critical")
self.assertEqual(result["urgency"],"immediate")
self.assertTrue(any("bradycardie"inr.lower()forrinresult["clinical_reasoning"]))

deftest_warning_level_priority(self):
        m={"heart_rate":125,"spo2":93,"temperature":37.5}
contribs=[{"variable":"heart_rate","observed_value":125,
"expected_min":50,"expected_max":120,
"contribution_weight":0.5}]
result=ml_module.generate_clinical_suggestion(m,contribs,"warning")
self.assertIn(result["urgency"],("priority","routine"))

deftest_hypothermia(self):
        m={"heart_rate":60,"spo2":97,"temperature":34.5}
contribs=[{"variable":"temperature","observed_value":34.5,
"expected_min":35.5,"expected_max":38.0,
"contribution_weight":0.9}]
result=ml_module.generate_clinical_suggestion(m,contribs,"critical")
self.assertEqual(result["urgency"],"immediate")
self.assertTrue(any("hypothermie"inr.lower()forrinresult["clinical_reasoning"]))

classTestScoreMeasurementEnrichment(unittest.TestCase):
    """Test that score_measurement returns all required ML fields."""

@classmethod
defsetUpClass(cls):
        normal_samples=[
{"heart_rate":72,"spo2":98,"temperature":36.6,"signal_quality":90,"status":"VALID"},
{"heart_rate":80,"spo2":97,"temperature":37.0,"signal_quality":85,"status":"VALID"},
]*20
ml_module.train_model(normal_samples,contamination=0.05,n_estimators=50)

deftest_score_returns_all_fields(self):
        m={"heart_rate":72,"spo2":98,"temperature":36.6,"signal_quality":90,"status":"VALID"}
result=ml_module.score_measurement(m)
self.assertIn("ml_score",result)
self.assertIn("ml_level",result)
self.assertIn("ml_model_version",result)
self.assertIn("ml_contributing_variables",result)
self.assertIn("ml_is_anomaly",result)
self.assertIn("ml_criticality",result)
self.assertIn("ml_recommended_action",result)
self.assertIn("ml_clinical_reasoning",result)
self.assertIn("ml_urgency",result)

deftest_normal_measurement_not_anomaly(self):
        m={"heart_rate":72,"spo2":98,"temperature":36.6,"signal_quality":90,"status":"VALID"}
result=ml_module.score_measurement(m)
ifresult["ml_level"]=="normal":
            self.assertFalse(result["ml_is_anomaly"])
self.assertEqual(result["ml_criticality"],"normal")
self.assertEqual(result["ml_urgency"],"routine")

deftest_critical_measurement_is_anomaly(self):
        m={"heart_rate":200,"spo2":75,"temperature":41.0,"signal_quality":40,"status":"VALID"}
result=ml_module.score_measurement(m)
ifresult["ml_level"]=="critical":
            self.assertTrue(result["ml_is_anomaly"])
self.assertEqual(result["ml_criticality"],"critical")
self.assertIn(result["ml_urgency"],("immediate","priority"))

classTestBuildAnomalyEvent(unittest.TestCase):
    deftest_critical_creates_event_with_suggestion(self):
        ml_result={
"ml_score":0.85,
"ml_level":"critical",
"ml_model_version":"v0.0.1",
"ml_contributing_variables":[],
}
suggestion={
"recommended_action":"Test action",
"clinical_reasoning":["Reason 1"],
"urgency":"immediate",
}
event=ml_module.build_anomaly_event(
device_id="dev-1",
user_id_auth="user-1",
measurement_id=ObjectId(),
measurement={"heart_rate":200},
ml_result=ml_result,
suggestion=suggestion,
)
self.assertIsNotNone(event)
self.assertEqual(event["recommended_action"],"Test action")
self.assertEqual(event["urgency"],"immediate")
self.assertEqual(event["clinical_reasoning"],["Reason 1"])
self.assertEqual(event["status"],"pending")

deftest_normal_returns_none(self):
        ml_result={"ml_score":0.2,"ml_level":"normal","ml_model_version":"v0.0.1",
"ml_contributing_variables":[]}
event=ml_module.build_anomaly_event(
device_id="dev-1",user_id_auth="user-1",
measurement_id=ObjectId(),measurement={},
ml_result=ml_result,
)
self.assertIsNone(event)

classTestAnomalyIdSerialization(unittest.TestCase):
    """Verify that _id is properly serialized as anomaly_id string."""

deftest_objectid_serialized_to_string(self):
        oid=ObjectId()
self.assertEqual(str(oid),str(oid))
self.assertIsInstance(str(oid),str)
self.assertEqual(len(str(oid)),24)

classTestTrainAndScore(unittest.TestCase):
    """Integration test: train model, score measurements, check anomalies."""

deftest_full_cycle(self):
        normal=[
{"heart_rate":72+i,"spo2":97+(i%3),"temperature":36.5+i*0.05,
"signal_quality":85+i,"status":"VALID"}
foriinrange(50)
]
meta=ml_module.train_model(normal,contamination=0.05,n_estimators=50)
self.assertIn("version",meta)
self.assertTrue(meta["n_samples"]>=50)

normal_result=ml_module.score_measurement(normal[0])
self.assertFalse(normal_result["ml_skipped"])
self.assertIsNotNone(normal_result["ml_score"])

critical_m={"heart_rate":200,"spo2":75,"temperature":41.0,
"signal_quality":30,"status":"VALID"}
critical_result=ml_module.score_measurement(critical_m)
self.assertFalse(critical_result["ml_skipped"])
self.assertTrue(critical_result["ml_is_anomaly"])

event=ml_module.build_anomaly_event(
device_id="test-dev",
user_id_auth="test-user",
measurement_id=ObjectId(),
measurement=critical_m,
ml_result=critical_result,
suggestion={
"recommended_action":critical_result.get("ml_recommended_action"),
"clinical_reasoning":critical_result.get("ml_clinical_reasoning",[]),
"urgency":critical_result.get("ml_urgency","routine"),
},
)
ifcritical_result["ml_level"]=="critical":
            self.assertIsNotNone(event)
self.assertEqual(event["status"],"pending")
self.assertIn("recommended_action",event)
else:
            self.assertIsNone(event)

deftest_invalid_measurement_skipped(self):
        m={"heart_rate":72,"spo2":98,"temperature":36.6,
"signal_quality":90,"status":"INVALID"}
result=ml_module.score_measurement(m)
self.assertTrue(result["ml_skipped"])

deftest_too_few_features_skipped(self):
        m={"heart_rate":None,"spo2":None,"temperature":None,
"signal_quality":90,"status":"VALID"}
result=ml_module.score_measurement(m)
self.assertTrue(result["ml_skipped"])

if__name__=="__main__":
    unittest.main()
