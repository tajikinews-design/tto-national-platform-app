"""OTP 60-second expiry and UI countdown contract regression.

Server TTL is authoritative; UI countdown uses time deltas (not decrement-in-state).
"""
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def read(path):return (ROOT/path).read_text(encoding="utf-8")
class OtpSixtySecondContract(unittest.TestCase):
 def test_server_enforces_expiry_for_registration_and_login(self):
  s=read("services/api/src/module.ts")
  self.assertIn("begin_mobile_registration($1,$2,$3,clock_timestamp()+interval '60 seconds')",s)
  self.assertIn("begin_smsotp_login($1,$2,$3,clock_timestamp()+interval '60 seconds')",s)
  self.assertNotIn("begin_mobile_registration($1,$2,$3,clock_timestamp()+interval '4 minutes')",s)
  self.assertNotIn("begin_smsotp_login($1,$2,$3,clock_timestamp()+interval '4 minutes')",s)
  self.assertIn("expiresInSeconds:created?",s)
  self.assertIn("otpStartedAt+60000-Date.now()",s)
 def test_gateway_propagates_remaining_ttl(self):
  for path in (
   "apps/cooperative-management/app/api/commerce/register/route.ts",
   "apps/cooperative-management/app/api/auth/otp/request/route.ts",
   "apps/shareholder/app/api/auth/otp/request/route.ts"
  ):
   s=read(path)
   self.assertIn("expiresInSeconds",s)
   self.assertIn("<=60",s)
 def test_countdown_uses_real_clock_and_disables_expired_confirmation(self):
  for path in ("apps/cooperative-management/app/customer-register/page.tsx",
               "packages/ui/src/otp-login.tsx"):
   s=read(path)
   self.assertIn("Date.now()",s)
   self.assertIn("setInterval",s)
   self.assertIn('role="timer"',s)
   self.assertIn('toLocaleString("fa-IR")',s)
   self.assertIn("دریافت مجدد کد",s)
   self.assertIn("<=0",s)
if __name__=="__main__":
 unittest.main()
