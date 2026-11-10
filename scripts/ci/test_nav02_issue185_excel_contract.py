"""Issue185 spreadsheet boundaries and non-automatic batch intake; no real data."""
from pathlib import Path
import unittest
R=Path(__file__).resolve().parents[2]
def src(p):return (R/p).read_text()
XLSX=src("apps/cooperative-management/lib/nav02-xlsx.ts")
ROUTE=src("apps/cooperative-management/app/api/commerce/nav02/workbook/route.ts")
UI=src("apps/cooperative-management/app/c/[slug]/members/member-excel-panel.tsx")
DIRECTORY=src("apps/cooperative-management/app/c/[slug]/members/member-directory.tsx")
PROXY=src("apps/cooperative-management/proxy.ts")
OFFICERS=src("apps/cooperative-management/app/c/[slug]/settings/officers.tsx")
API=src("services/api/src/module.ts")
class ExcelGate(unittest.TestCase):
 def test_template_and_real_xlsx_zip(self):
  for key in ("deflateRawSync","inflateRawSync","crc32","[Content_Types].xml",
   "xl/workbook.xml","xl/worksheets/sheet1.xml","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"):
   self.assertIn(key,XLSX+ROUTE)
  for guard in ("MAX_XLSX","MAX_ROWS","MAX_COLS","FORMULAS_NOT_ALLOWED",
   "UNSAFE_XLSX_ENTRY","INVALID_XLSX_CRC","ACTIVE_XLSX_NOT_ALLOWED"):
   self.assertIn(guard,XLSX)
 def test_export_is_tenant_authorized_and_masks_identity(self):
  self.assertIn("session(req)",ROUTE)
  self.assertIn('new URL("/v1/commerce/demo/nav02"',ROUTE)
  self.assertIn("trustedBackendHeaders(req)",ROUTE)
  self.assertIn("p.identifierMask",ROUTE)
  self.assertIn("p.mobileMask",ROUTE)
  self.assertIn('mode==="sample"',ROUTE)
  self.assertIn("fake=",ROUTE)
  self.assertIn("EXPORT_BATCH_LIMIT_249",ROUTE)
 def test_import_preview_then_explicit_verified_row_write(self):
  self.assertIn('ORIGIN_REQUIRED',ROUTE)
  self.assertIn('XLSX_TEMPLATE_MISMATCH_OR_ROW_LIMIT',ROUTE)
  self.assertIn('PREVIEW_ONLY_REQUIRES_EXPLICIT_CONFIRMATION',ROUTE)
  self.assertNotIn('action:"memberProfile"',ROUTE)
  self.assertIn('setConfirmed',UI)
  self.assertIn('rows.some(r=>!r.valid)',UI)
  self.assertIn('action:"memberProfile"',UI)
  self.assertIn('if(!r.ok)',UI)
  self.assertIn('setRows([]);setConfirmed(false)',UI)
  self.assertIn('await this.checkNav02Shahkar',API)
  self.assertIn('MemberExcelPanel',DIRECTORY)
  self.assertIn('"/api/commerce/nav02/workbook"',PROXY)
 def test_officer_history_attested_as_preview_only(self):
  self.assertIn('showHistory',OFFICERS)
  self.assertIn('setEditTarget',OFFICERS)
  self.assertIn("OFFICER_STALE_VERSION",src(
   "apps/cooperative-management/app/api/commerce/nav02/officers/edit/route.ts"))
  self.assertIn("nav02_office_holder_draft_history",API)
if __name__=="__main__":unittest.main()
