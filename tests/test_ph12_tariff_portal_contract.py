"""PH12 tariff draft portal safeguards: static contract checks only; NOT human QA."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/"apps/cooperative-management/app/share-market/tariffs/page.tsx"
GATE=ROOT/"apps/cooperative-management/app/api/tenants/[tenantId]/share-market/tariff-draft-readiness/route.ts"
HOME=ROOT/"apps/cooperative-management/app/page.tsx"
LAB=ROOT/"services/api/src/market-v3-disposable-tariff-admin.ts"

class TariffPortalContract(unittest.TestCase):
 def test_real_session_cookie_converted_to_bearer_and_real_tenant_context(self):
  code=GATE.read_text("utf-8")
  for x in ['req.cookies.get("tto_session")',
   '"/v1/tenants/"+tenantId+"/context"','Authorization:"Bearer "+token',
   'scoped.tenant_id!==tenantId','scoped.status!=="ACTIVE"',
   'trustedBackendHeaders(req)','redirect:"error"','cache:"no-store"']:
   self.assertIn(x,code)
  self.assertIn('return denied(403,"TENANT_ACCESS_DENIED")',code)
  self.assertNotIn('export async function POST',code)
  self.assertNotIn("next/headers",code)
 def test_no_real_trade_fee_activation_or_legal_board_claim(self):
  gate=GATE.read_text("utf-8")
  for x in ["liveTariffWrites:false","serverSideTariffDraftPersistence:false",
   "officialTariffActivation:false","boardResolutionVerified:false",
   "financeAndCeoMandatesVerified:false","officialFeePaid:false",
   "ownershipTransferEnabled:false","appointmentEnabled:false"]:
   self.assertIn(x,gate)
  for x in ["INSERT INTO","UPDATE ","DELETE FROM","LAB_TEST_ATTESTED"]:
   self.assertNotIn(x,gate)
 def test_portal_requires_verified_manager_and_tenant_scope(self):
  page=PAGE.read_text("utf-8")
  for x in ['"/api/me/tenant-options"','t.evidenceStatus==="ROLE_AUTHORITY_EVIDENCE"',
   ]:
   self.assertIn(x,page)
  self.assertIn('tenantContextVerified!==true',page)
  self.assertIn('data.liveTariffWrites!==false',page)
  self.assertIn('data.serverSideTariffDraftPersistence!==false',page)
  self.assertIn('disabled={!gate}',page)
  self.assertIn('<form onSubmit={addDraft}',page)
  self.assertIn("setDrafts(old=>[...old",page)
  self.assertNotIn("localStorage",page)
  self.assertNotIn("sessionStorage",page)
  self.assertNotIn('fetch("/api/tenants/"+encodeURIComponent(tenantId),{method:"POST"',page)
  self.assertIn('SELF_PREPARED_NOT_SUBMITTED',page)
 def test_product_controls_versioning_board_refs_and_two_signers(self):
  page=PAGE.read_text("utf-8");lab=LAB.read_text("utf-8");home=HOME.read_text("utf-8")
  for x in ["boardResolutionReference","boardEvidenceReference",
   "legalBasisReference","version","feeId","validFrom","validUntil",
   "buyerPercent","sellerPercent","CUSTOM_APPROVED_BASE"]:
   self.assertIn(x,page)
  self.assertIn('href="/share-market/tariffs"',home)
  for x in ["COOP_FINANCE_OPERATOR","COOP_CEO","LAB_DUAL_REVIEW_COMPLETE_NOT_LEGAL_PAID",
   "TARIFF_VERSION_MUST_INCREASE"]:
   self.assertIn(x,lab)
 def test_qa_requires_documents_and_remains_unaccepted(self):
  page=PAGE.read_text("utf-8")
  for x in ["COOPERATIVE_BOARD_RESOLUTION","FINANCE_OFFICER_BOARD_MANDATE",
   "CEO_OFFICIAL_MANDATE","AUTHENTICATED_COOPERATIVE_BANK_SETTLEMENT",
   "independentQA:false","officialFeePaid:false","tradeEnabled:false"]:
   self.assertIn(x,page)

if __name__=="__main__": unittest.main()
