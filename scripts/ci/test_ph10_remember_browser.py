"""Ensure remembered national login is bounded, revocable, and optional."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
def load(p):return (ROOT/p).read_text(encoding="utf-8")
class NationalRememberBrowser(unittest.TestCase):
 def test_database_session_expires_and_requires_rotated_account(self):
  s=load("database/migrations/9999k_ph10_national_root_remember_browser.sql")
  for needle in ["interval '7 days'","interval '15 minutes'","v_changed IS FALSE","v_password_ready IS TRUE","credentials_version","p_remember_device IS NULL","REVOKE ALL ON FUNCTION"]:
   self.assertIn(needle,s)
 def test_server_and_cookie_agree(self):
  api=load("services/api/src/module.ts")
  bff=load("apps/national-admin/app/api/national-login/route.ts")
  for n in ['sessionMaxAgeSeconds:persistent?604800:900','state.must_change_credentials===false','issueNationalRootSession(tokenHash,state.credentials_version,persistent)']:
   self.assertIn(n,api)
  for n in ['rememberDevice=remember===true','![900,604800].includes','maxAge:data.sessionMaxAgeSeconds as number','httpOnly:true','secure:true','sameSite:"lax"']:
   self.assertIn(n,bff)
 def test_ui_opt_in_and_revoke_persist(self):
  ui=load("apps/national-admin/app/national-root-login.tsx")
  logout=load("apps/national-admin/app/api/auth/logout/route.ts")
  self.assertIn("setRememberDevice]=useState(true)",ui)
  self.assertIn("مرا در این مرورگر به خاطر بسپار",ui)
  self.assertIn("rememberDevice})",ui)
  self.assertIn('"/api/auth/logout"',ui)
  self.assertIn('"/v1/auth/logout"',logout)
if __name__=="__main__":unittest.main()
