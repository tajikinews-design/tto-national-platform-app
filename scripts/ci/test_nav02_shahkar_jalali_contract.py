"""Privacy, official API.ir contract, Jalali calendar, Vercel preview stability."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
def read(p):return (ROOT/p).read_text(encoding="utf8")
class ShahkarJalali(unittest.TestCase):
 def test_shahkar_never_uses_client_key_or_fails_open(self):
  ui=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  api=read("services/api/src/module.ts")
  bff=read("apps/cooperative-management/app/api/commerce/nav02/route.ts")
  self.assertNotIn("APIIR_TOKEN",ui)
  self.assertNotIn("s.api.ir",ui)
  for term in ("SHAHKAR_NOT_APPROVED","SHAHKAR_NOT_CONFIGURED","SHAHKAR_UNAVAILABLE",
               'TTO_NAV02_SHAHKAR_ENABLED','TTO_NAV02_REAL_PII_ENABLED',
               '"https://s.api.ir/api/sw1/Shahkar"','isCompany:false','result.success===true&&result.data===false',
               'UnprocessableEntityException("SHAHKAR_MISMATCH")'):
   self.assertIn(term,api)
  self.assertIn('await this.checkNav02Shahkar(String(fields.nationalId),String(fields.mobile))',api)
  self.assertIn('r.status===422&&data.action==="memberProfile"',bff)
  self.assertIn('r.status===422?',ui)
 def test_jalali_is_not_native_gregorian_picker(self):
  form=read("apps/cooperative-management/app/c/[slug]/members/member-draft-form.tsx")
  cal=read("apps/cooperative-management/app/c/[slug]/members/jalali-birth-picker.tsx")
  css=read("apps/cooperative-management/app/member-intake.css")
  self.assertIn("en-US-u-ca-persian",cal)
  self.assertIn("role=\"grid\"",cal)
  self.assertIn("role=\"dialog\"",cal)
  self.assertIn('key="jalali-birth-row"',form)
  self.assertIn('key==="birthPlace"?null',form)
  self.assertIn("grid-template-columns:repeat(2,minmax(0,1fr))",css)
  self.assertNotIn('type="date" value={profile.birthDate}',form)
  self.assertIn("validJalaliBirthDate",read("services/api/src/module.ts"))
  self.assertIn("jalaliToGregorianISO",cal)
  self.assertIn("gregorianISOToJalali",cal)
  self.assertIn('placeholder="انتخاب تاریخ پرداخت (شمسی)"',form)
  self.assertNotIn('<input type="date" value={capital.paymentDate}',form)
if __name__=="__main__":unittest.main()
