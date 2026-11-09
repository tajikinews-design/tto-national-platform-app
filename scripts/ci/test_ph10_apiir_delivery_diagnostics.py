"""Static regression for privacy-safe API.ir OTP delivery diagnostics.

Does not send real SMS. The only logged fields are provider outcome category
and request duration; no OTP, mobile, credential or response payload.
"""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
class SmsOtpProviderObservability(unittest.TestCase):
 def test_provider_records_latency_and_bounded_error_class(self):
  s=(ROOT/"services/api/src/apiir-provider.ts").read_text(encoding="utf-8")
  for phrase in (
   "TTO_SMSOTP_PROVIDER_METRIC",
   "elapsedMs:Math.max(0,Date.now()-startedAt)",
   "outcome=controller.signal.aborted?",
   "PROVIDER_REJECTED",
   "HTTP_4XX",
   "HTTP_5XX",
   "TIMEOUT",
   "TRANSPORT_OR_FORMAT_ERROR",
   "return json?.success===true"
  ):
   if phrase=="return json?.success===true":
    self.assertNotIn(phrase,s)
   else:self.assertIn(phrase,s)
  self.assertIn('const accepted=json?.success===true && json?.data===true',s)
  self.assertIn('setTimeout(()=>controller.abort(),8000)',s)
  self.assertIn('console.info("TTO_SMSOTP_PROVIDER_METRIC",JSON.stringify({\n        outcome,elapsedMs:',s)
  self.assertNotIn("JSON.stringify({mobile",s[s.index('console.info("TTO_SMSOTP_PROVIDER_METRIC"'):])
  self.assertNotIn("console.error",s)
  self.assertEqual(s.count('https://s.api.ir/api/sw1/SmsOTP'),1)
 def test_otp_window_and_approved_visuals_are_unchanged(self):
  api=(ROOT/"services/api/src/module.ts").read_text(encoding="utf-8")
  self.assertGreaterEqual(api.count('otpStartedAt+60000-Date.now()'),2)
  frame=(ROOT/"docs/design/TTO-AUTH-UI-V1-FREEZE.json").read_text(encoding="utf-8")
  self.assertIn('"UI_GREEN_APPROVED_FROZEN"',frame)

if __name__=="__main__":unittest.main()
