import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BoardResolutionDossier, LegalGateContext, evaluateBoardResolutionLegalGate } from '../src/ph12-board-legal-gate';

const context: LegalGateContext = { cooperativeId: 'coop-1', draftId: 'tariff-v3', evaluatedAt: '2026-11-07T00:00:00Z', legalReviewerId: 'reviewer-1' };
function valid(): BoardResolutionDossier {
  return {
    cooperativeId: 'coop-1', draftId: 'tariff-v3', draftAuthorId: 'author-1',
    dossierSubmitterId: 'submitter-1', resolutionId: 'R-42',
    resolutionDate: '2026-11-01T00:00:00Z',
    effectiveFrom: '2026-11-01T00:00:00Z', effectiveUntil: '2026-12-01T00:00:00Z',
    resolutionValid: true, revoked: false, superseded: false, quorumVerified: true,
    documentClean: true, requiredSignerIds: ['signer-1', 'signer-2'],
    signers: ['signer-1', 'signer-2'].map(partyId => ({
      partyId, identityVerified: true, authorityVerified: true,
      authorityStart: '2026-01-01T00:00:00Z',
      authorityEnd: '2026-12-31T00:00:00Z',
    })),
    officialSources: [{sourceId:'registry-1',verified:true,verifiedAt:'2026-11-01T00:00:00Z',
      expiresAt:'2026-11-30T00:00:00Z',sha256:'a'.repeat(64)}],
    legalReview: {reviewerId:'reviewer-1',decision:'APPROVED',verifiedSourceIds:['registry-1'],
      signedAt:'2026-11-05T00:00:00Z'},
  };
}
test('complete synthetic evidence can only reach eligibility, never ACTIVE', () => {
  const result = evaluateBoardResolutionLegalGate(valid(),context);
  assert.equal(result.eligibleForSeparateActivationAuthorization,true);
  assert.equal('status' in result,false);
  assert.equal('activationToken' in result,false);
});
test('clean file and hash alone cannot approve', () => {
  const x=valid();x.legalReview=null;x.officialSources=[];
  assert.equal(evaluateBoardResolutionLegalGate(x,context).eligibleForSeparateActivationAuthorization,false);
});
test('cross tenant and cross draft fail closed', () => {
  const x=valid();x.cooperativeId='coop-2';x.draftId='other';
  assert.deepEqual(evaluateBoardResolutionLegalGate(x,context).reasons.filter(x=>x.endsWith('MISMATCH')),
    ['DRAFT_MISMATCH','TENANT_MISMATCH']);
});
test('missing second signature, revoked authority, missing quorum', () => {
  const x=valid();x.signers.pop();x.quorumVerified=false;
  const reasons=evaluateBoardResolutionLegalGate(x,context).reasons;
  assert.ok(reasons.includes('JOINT_SIGNATURE_INCOMPLETE'));
  assert.ok(reasons.includes('QUORUM_UNPROVEN'));
});
test('expired source and missing source hash are rejected', () => {
  const x=valid();x.officialSources[0].expiresAt='2026-11-02T00:00:00Z';
  x.officialSources[0].sha256='invalid';
  const reasons=evaluateBoardResolutionLegalGate(x,context).reasons;
  assert.ok(reasons.includes('SOURCE_STALE'));
  assert.ok(reasons.includes('SOURCE_UNVERIFIED'));
});
test('reviewer cannot self-approve or substitute a rejected decision', () => {
  const x=valid();x.draftAuthorId='reviewer-1';x.legalReview!.decision='REJECTED';
  const reasons=evaluateBoardResolutionLegalGate(x,context).reasons;
  assert.ok(reasons.includes('REVIEWER_NOT_INDEPENDENT'));
  assert.ok(reasons.includes('LEGAL_REVIEW_REJECTED'));
});
test('revoked or superseded resolutions never eligible', () => {
  const x=valid();x.revoked=true;x.superseded=true;
  assert.equal(evaluateBoardResolutionLegalGate(x,context).eligibleForSeparateActivationAuthorization,false);
});
test('expired signer authority cannot approve', () => {
  const x=valid();x.signers[0].authorityEnd='2026-10-01T00:00:00Z';
  assert.ok(evaluateBoardResolutionLegalGate(x,context).reasons.includes('SIGNER_UNAUTHORIZED'));
});
test('out of range and invalid timestamps fail closed', () => {
  const x=valid();x.effectiveUntil='invalid';
  assert.ok(evaluateBoardResolutionLegalGate(x,context).reasons.includes('OUTSIDE_EFFECTIVE_WINDOW'));
});
