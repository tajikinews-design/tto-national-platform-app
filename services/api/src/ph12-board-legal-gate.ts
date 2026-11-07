/**
 * PH12 legal evidence gate: deny by default.
 * This module NEVER activates a tariff. It only issues an advisory eligibility verdict.
 * Calling code must enforce permissions/tenant isolation and perform a separate atomic DB gate.
 */
export type LegalGateReason =
  | 'TENANT_MISMATCH' | 'DRAFT_MISMATCH' | 'SOURCE_MISSING'
  | 'SOURCE_STALE' | 'SOURCE_UNVERIFIED' | 'RESOLUTION_REVOKED'
  | 'RESOLUTION_INVALID' | 'SIGNER_UNVERIFIED' | 'SIGNER_UNAUTHORIZED'
  | 'JOINT_SIGNATURE_INCOMPLETE' | 'QUORUM_UNPROVEN'
  | 'REVIEWER_NOT_INDEPENDENT' | 'LEGAL_REVIEW_MISSING'
  | 'LEGAL_REVIEW_REJECTED' | 'DOCUMENT_NOT_CLEAN'
  | 'EVIDENCE_SUPERSEDED' | 'OUTSIDE_EFFECTIVE_WINDOW';

export interface OfficialSource {
  sourceId: string;
  verified: boolean;
  verifiedAt: string;
  expiresAt: string;
  sha256: string;
}
export interface Signer {
  partyId: string;
  identityVerified: boolean;
  authorityVerified: boolean;
  authorityStart: string;
  authorityEnd: string;
  revokedAt?: string | null;
}
export interface LegalReview {
  reviewerId: string;
  decision: 'APPROVED' | 'REJECTED';
  verifiedSourceIds: string[];
  signedAt: string;
}
export interface BoardResolutionDossier {
  cooperativeId: string;
  draftId: string;
  draftAuthorId: string;
  dossierSubmitterId: string;
  resolutionId: string;
  resolutionDate: string;
  effectiveFrom: string;
  effectiveUntil: string;
  resolutionValid: boolean;
  revoked: boolean;
  superseded: boolean;
  quorumVerified: boolean;
  documentClean: boolean;
  requiredSignerIds: string[];
  signers: Signer[];
  officialSources: OfficialSource[];
  legalReview?: LegalReview | null;
}
export interface LegalGateContext {
  cooperativeId: string;
  draftId: string;
  evaluatedAt: string;
  legalReviewerId: string;
}
export interface LegalGateVerdict {
  eligibleForSeparateActivationAuthorization: boolean;
  reasons: LegalGateReason[];
  // no ACTIVE status or activation token is ever emitted by this module
}

function validTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}
function within(at: number | null, start: string, end: string): boolean {
  const from = validTime(start), until = validTime(end);
  return at !== null && from !== null && until !== null && from <= at && at <= until;
}
const sha256Pattern = /^[a-f0-9]{64}$/i;

export function evaluateBoardResolutionLegalGate(
  dossier: BoardResolutionDossier,
  context: LegalGateContext,
): LegalGateVerdict {
  const reasons = new Set<LegalGateReason>();
  const now = validTime(context.evaluatedAt);
  const resolutionAt = validTime(dossier.resolutionDate);
  const review = dossier.legalReview;
  if (!context.cooperativeId || !dossier.cooperativeId || context.cooperativeId !== dossier.cooperativeId) reasons.add('TENANT_MISMATCH');
  if (!context.draftId || !dossier.draftId || context.draftId !== dossier.draftId) reasons.add('DRAFT_MISMATCH');
  if (dossier.revoked) reasons.add('RESOLUTION_REVOKED');
  if (dossier.superseded) reasons.add('EVIDENCE_SUPERSEDED');
  if (!dossier.resolutionValid || resolutionAt === null || !dossier.resolutionId) reasons.add('RESOLUTION_INVALID');
  if (!dossier.quorumVerified) reasons.add('QUORUM_UNPROVEN');
  if (!dossier.documentClean) reasons.add('DOCUMENT_NOT_CLEAN');
  if (!within(now, dossier.effectiveFrom, dossier.effectiveUntil) || (resolutionAt !== null && now !== null && resolutionAt > now)) reasons.add('OUTSIDE_EFFECTIVE_WINDOW');

  if (!dossier.officialSources.length) reasons.add('SOURCE_MISSING');
  const sourceIds = new Set<string>();
  for (const source of dossier.officialSources) {
    if (!source.sourceId || sourceIds.has(source.sourceId)) reasons.add('SOURCE_UNVERIFIED');
    sourceIds.add(source.sourceId);
    if (!source.verified || !sha256Pattern.test(source.sha256)) reasons.add('SOURCE_UNVERIFIED');
    if (!within(now, source.verifiedAt, source.expiresAt)) reasons.add('SOURCE_STALE');
  }
  if (!dossier.requiredSignerIds.length) reasons.add('JOINT_SIGNATURE_INCOMPLETE');
  const signerById = new Map<string, Signer>();
  for (const signer of dossier.signers) {
    if (!signer.partyId || signerById.has(signer.partyId)) reasons.add('SIGNER_UNVERIFIED');
    signerById.set(signer.partyId, signer);
  }
  for (const id of dossier.requiredSignerIds) {
    const signer = signerById.get(id);
    if (!signer) { reasons.add('JOINT_SIGNATURE_INCOMPLETE'); continue; }
    if (!signer.identityVerified) reasons.add('SIGNER_UNVERIFIED');
    if (!signer.authorityVerified || !within(resolutionAt, signer.authorityStart, signer.authorityEnd) ||
       (signer.revokedAt && validTime(signer.revokedAt) !== null && resolutionAt !== null &&
         validTime(signer.revokedAt)! <= resolutionAt)) reasons.add('SIGNER_UNAUTHORIZED');
  }
  if (!review || !review.reviewerId || review.reviewerId !== context.legalReviewerId || !validTime(review.signedAt)) {
    reasons.add('LEGAL_REVIEW_MISSING');
  } else {
    if (review.decision !== 'APPROVED') reasons.add('LEGAL_REVIEW_REJECTED');
    if (review.reviewerId === dossier.draftAuthorId ||
        review.reviewerId === dossier.dossierSubmitterId ||
        dossier.requiredSignerIds.includes(review.reviewerId)) reasons.add('REVIEWER_NOT_INDEPENDENT');
    if (!dossier.officialSources.every(s => review.verifiedSourceIds.includes(s.sourceId))) reasons.add('SOURCE_UNVERIFIED');
  }
  const failures = [...reasons].sort();
  return Object.freeze({ eligibleForSeparateActivationAuthorization: failures.length === 0, reasons: failures });
}
