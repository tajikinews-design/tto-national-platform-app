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
  for x in ["liveTariffWrites:false","serverSideTariffDraftPersistence:process.env.TTO_PH12_TARIFF_DRAFT_INTAKE_ENABLED",
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
  self.assertIn('typeof data.serverSideTariffDraftPersistence!=="boolean"',page)
  self.assertIn('disabled={!gate||busy}',page)
  self.assertIn('<form onSubmit={e=>void addDraft(e)}',page)
  self.assertIn("setDrafts(old=>[...old",page)
  self.assertNotIn("localStorage",page)
  self.assertNotIn("sessionStorage",page)
  self.assertIn('"/share-market/tariff-drafts"',page)
  self.assertIn('SELF_PREPARED_NOT_SUBMITTED',page)
 def test_persistent_draft_store_does_not_grant_live_fee_authority(self):
  source=(ROOT/"database/migrations/0047_ph12_tariff_drafts_private.sql").read_text("utf-8")
  bff=(ROOT/"apps/cooperative-management/app/api/tenants/[tenantId]/share-market/tariff-drafts/route.ts").read_text("utf-8")
  nest=(ROOT/"services/api/src/module.ts").read_text("utf-8")
  for field in ["DRAFT_UNVERIFIED","FORCE ROW LEVEL SECURITY","ph12_tariff_draft_immutable",
    "has_verified_authority","ph12_create_tariff_draft","ph12_list_tariff_drafts",
    "REVOKE ALL ON tto.ph12_tariff_drafts FROM PUBLIC,tto_app"]:
   self.assertIn(field,source)
  for field in ["TTO_PH12_TARIFF_DRAFT_INTAKE_ENABLED","trustedBackendHeaders",
   '"/v1/me/tenant-options"','roleManagementAuthority===true',
   'req.headers.get("origin")',"DRAFT_UNVERIFIED","feeActivated!==false",
   "realPaymentConfirmed!==false","legalShareTransfer!==false"]:
   self.assertIn(field,bff)
  self.assertNotIn("LAB_TEST_ATTESTED",source)
  self.assertIn("Ph12TariffDraftController",nest)
  self.assertIn("PH12_TARIFF_DRAFT_INTAKE_DISABLED",nest)
  self.assertIn("feeActivated:false",nest)
 def test_board_document_case_requires_verified_file_and_independent_reviewer(self):
  sql=(ROOT/"database/migrations/0048_ph12_tariff_board_document_review.sql").read_text("utf-8")
  proxy=(ROOT/"apps/cooperative-management/lib/ph12-board-case-proxy.ts").read_text("utf-8")
  nest=(ROOT/"services/api/src/module.ts").read_text("utf-8")
  ui=(ROOT/"apps/cooperative-management/app/share-market/board-review/page.tsx").read_text("utf-8")
  for x in ["FORCE ROW LEVEL SECURITY","ph12_tariff_board_evidence_cases",
   "ph12_tariff_board_review_events","document_versions","file_objects",
   "scan_status='CLEAN'","file_sha256","DOCUMENT_REVIEWER",
   "METADATA_CHECKED_SIGNER_AUTHORITY_UNVERIFIED",
   "DOCUMENT_INTAKE_AUTHORITY_UNVERIFIED","PH12_BOARD_FOUR_EYES_REQUIRED",
   "PH12_BOARD_EVIDENCE_APPEND_ONLY"]:
   self.assertIn(x,sql)
  self.assertNotIn("'ACTIVE'",sql)
  self.assertIn("Ph12TariffBoardDocumentController",nest)
  for x in ["signerIdentityAuthenticated:false","signerAuthorityAuthenticated:false",
   "boardLegallyApproved:false","tariffActivated:false"]:
   self.assertIn(x,nest)
  for x in ['req.headers.get("origin")',"tto_session",
   "BOARD_DOCUMENT_REVIEW_NOT_RELEASED","signerAuthorityAuthenticated!==false",
   "tariffActivated!==false","trustedBackendHeaders(req)"]:
   self.assertIn(x,proxy)
  self.assertIn("بررسی مستندات هیئت‌مدیره",ui)
  self.assertIn("اختیار هیئت‌مدیره هنوز تأیید نشده",ui)
 def test_product_controls_versioning_board_refs_and_two_signers(self):
  page=PAGE.read_text("utf-8");lab=LAB.read_text("utf-8");home=HOME.read_text("utf-8")
  for x in ["boardResolutionReference","boardEvidenceReference",
   "legalBasisReference","version","feeId","validFrom","validUntil",
   "buyerPercent","sellerPercent","CUSTOM_APPROVED_BASE"]:
   self.assertIn(x,page)
  dashboard=(ROOT/"packages/ui/src/approved-dashboard.tsx").read_text("utf-8")
  self.assertIn('"/share-market/tariffs"',dashboard)
  self.assertIn('PortalSessionGate surface="cooperative"',home)
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
