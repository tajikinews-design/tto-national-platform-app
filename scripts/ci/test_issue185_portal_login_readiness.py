"""No safe login bypass when matching Preview API or legal identity is missing."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def src(x):return (R/x).read_text()
API=src("services/api/src/module.ts")
BFF=src("apps/cooperative-management/app/api/auth/password/login/route.ts")
UI=src("packages/ui/src/portal-password-login.tsx")
class PreviewLogin(unittest.TestCase):
 def test_staging_gates_retained(self):
  self.assertIn('TTO_PORTAL_PASSWORD_LOGIN_ENABLED!=="true"',API)
  self.assertIn('TTO_SECURE_REAL_DATA_STAGING_ENABLED!=="true"',API)
  self.assertIn('PORTAL_PASSWORD_ATTEMPT_SECRET',API)
  self.assertIn('reservePortalPasswordAttempt',API)
  self.assertIn('credential.must_rotate',API)
  self.assertIn('issuePortalPasswordSession',API)
 def test_frontend_reports_missing_staging_without_fake_login(self):
  self.assertIn('"PORTAL_STAGING_NOT_ENABLED"',BFF)
  self.assertIn('"PORTAL_SECURITY_CONFIG_MISSING"',BFF)
  self.assertIn('"PASSWORD_LOGIN_STAGING_NOT_READY"',BFF)
  self.assertIn("ورود امن در محیط آزمایش هنوز فعال نشده است",UI)
  self.assertIn('response.status===401',UI)
  self.assertIn('response.status===403',UI)
  self.assertIn('if(response.status!==200)',UI)
  self.assertIn('data.accessToken',BFF)
  self.assertIn('d.authenticated!==true',UI)
  self.assertIn('httpOnly:true,secure:true,sameSite:"lax"',BFF)
if __name__=="__main__":unittest.main()
