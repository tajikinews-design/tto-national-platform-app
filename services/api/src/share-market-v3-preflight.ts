/**
 * TTO-SHARE-MARKET-SPEC v3.0 §§8–9,13,15–17,23–28,51.
 * Pure, non-authoritative engineering preflight; NOT wired to HTTP, SQL,
 * live market orders, payments, share register or finalization.
 *
 * The legally authoritative register belongs to each cooperative.
 * Every input must eventually originate from a verified, versioned source,
 * not from a browser or caller-provided claims. There is intentionally NO
 * method to change state/ownership or to authorize live trading here.
 */
export type VerifiedRuleState = "VALID" | "INVALID" | "UNKNOWN";
export type ShareBuyerType =
  | "MEMBER"
  | "NON_MEMBER_SHAREHOLDER"
  | "MEMBERSHIP_APPLICANT"
  | "NON_MEMBER_APPLICANT"
  | "NOT_ELIGIBLE";

export interface SellerPreflightFacts {
  readonly saleMode: string;
  readonly sellerStatus: string;
  readonly requestedQuantity: bigint;
  readonly availableShares: bigint;
  readonly ownershipSourceVerified: boolean;
  readonly noConflictingLock: boolean;
  readonly noLegalHold: boolean;
  readonly noActiveConflictingTrade: boolean;
  readonly shareSaleEligibility: VerifiedRuleState;
  readonly unpaidCapitalCommitment: boolean;
  readonly pricingRuleVerified: boolean;
}

export interface BuyerPreflightFacts {
  readonly buyerType: ShareBuyerType;
  readonly identityVerified: boolean;
  readonly classificationSourceVerified: boolean;
  readonly buyerEligibilityRule: VerifiedRuleState;
  readonly buyerCapRuleVerified: boolean;
  readonly currentShares: bigint;
  readonly pendingAcquisitions: bigint;
  readonly requestedShares: bigint;
  readonly maximumAllowedShares: bigint;
  readonly noLegalHold: boolean;
  readonly noActiveDispute: boolean;
  readonly offerStillValid: boolean;
}

export interface FinalizationEvidenceFacts {
  readonly boardApprovalValid: boolean;
  readonly buyerEligibilityValid: boolean;
  readonly sellerPaymentConfirmed: boolean;
  readonly mandatoryFeesResolved: boolean;
  readonly officialRegisterEntryVerified: boolean;
  readonly officialRegisterReference: string | null;
  readonly registeredAt: string | null;
  readonly noOpenDispute: boolean;
  readonly lockedShares: bigint;
  readonly tradeQuantity: bigint;
}

/**
 * An eligibility report is not an executable business authorization.
 * No booleans may be sourced from user-input assertions in a live implementation.
 */
export interface PreflightReport {
  readonly prerequisitesSatisfied: boolean;
  readonly blockers: readonly string[];
  readonly liveOrderAuthorized: false;
  readonly liveOwnershipTransferAuthorized: false;
  readonly sourceAuthority: "OFFICIAL_COOPERATIVE_SHARE_REGISTER_ONLY";
}

function validNonnegativeQuantity(value: unknown): value is bigint {
  return typeof value === "bigint" && value >= 0n;
}
function validPositiveQuantity(value: unknown): value is bigint {
  return typeof value === "bigint" && value > 0n;
}
function report(blockers: string[]): PreflightReport {
  return {
    prerequisitesSatisfied: blockers.length === 0,
    blockers,
    liveOrderAuthorized: false,
    liveOwnershipTransferAuthorized: false,
    sourceAuthority: "OFFICIAL_COOPERATIVE_SHARE_REGISTER_ONLY",
  };
}

export function reviewSellerPreflight(facts: SellerPreflightFacts): PreflightReport {
  const blockers: string[] = [];
  if (facts.saleMode !== "FULL_OFFER") blockers.push("MVP_FULL_OFFER_ONLY");
  if (facts.sellerStatus !== "ACTIVE") blockers.push("SELLER_NOT_ACTIVE");
  if (!validPositiveQuantity(facts.requestedQuantity) ||
      !validNonnegativeQuantity(facts.availableShares) ||
      facts.requestedQuantity > facts.availableShares) {
    blockers.push("INSUFFICIENT_OR_UNVERIFIED_FREE_SHARES");
  }
  if (facts.ownershipSourceVerified !== true) blockers.push("OFFICIAL_HOLDINGS_SOURCE_UNVERIFIED");
  if (facts.noConflictingLock !== true) blockers.push("CONFLICTING_SHARE_LOCK");
  if (facts.noLegalHold !== true) blockers.push("LEGAL_HOLD_OR_UNKNOWN");
  if (facts.noActiveConflictingTrade !== true) blockers.push("ACTIVE_CONFLICTING_TRADE");
  if (facts.shareSaleEligibility !== "VALID") blockers.push("SALE_ELIGIBILITY_RULE_NOT_VALID");
  // Spec §8: unpaid capital commitment triggers REVIEW, never a computed automatic allocation.
  if (facts.unpaidCapitalCommitment !== false) blockers.push("UNPAID_COMMITMENT_LEGAL_REVIEW");
  if (facts.pricingRuleVerified !== true) blockers.push("ACTIVE_PRICING_RULE_NOT_VERIFIED");
  return report(blockers);
}

export function reviewBuyerPreflight(facts: BuyerPreflightFacts): PreflightReport {
  const blockers: string[] = [];
  if (facts.identityVerified !== true) blockers.push("BUYER_IDENTITY_UNVERIFIED");
  if (facts.classificationSourceVerified !== true ||
      facts.buyerType === "NOT_ELIGIBLE" ||
      !["MEMBER", "NON_MEMBER_SHAREHOLDER", "MEMBERSHIP_APPLICANT", "NON_MEMBER_APPLICANT"].includes(facts.buyerType)) {
    blockers.push("BUYER_CLASSIFICATION_NOT_APPROVED");
  }
  if (facts.buyerEligibilityRule !== "VALID") blockers.push("BUYER_ELIGIBILITY_RULE_NOT_VALID");
  if (facts.buyerCapRuleVerified !== true) blockers.push("ACTIVE_CAP_RULE_UNVERIFIED");
  if (!validNonnegativeQuantity(facts.currentShares) ||
      !validNonnegativeQuantity(facts.pendingAcquisitions) ||
      !validPositiveQuantity(facts.requestedShares) ||
      !validNonnegativeQuantity(facts.maximumAllowedShares)) {
    blockers.push("BUYER_QUANTITIES_INVALID");
  } else if (facts.currentShares + facts.pendingAcquisitions + facts.requestedShares >
             facts.maximumAllowedShares) {
    blockers.push("BUYER_ACTIVE_LEGAL_CAP_EXCEEDED");
  }
  if (facts.noLegalHold !== true) blockers.push("BUYER_LEGAL_HOLD_OR_UNKNOWN");
  if (facts.noActiveDispute !== true) blockers.push("TRADE_DISPUTE_OR_UNKNOWN");
  if (facts.offerStillValid !== true) blockers.push("OFFER_INVALID_OR_EXPIRED");
  return report(blockers);
}

export function reviewOfficialRegisterFinalization(facts: FinalizationEvidenceFacts): PreflightReport {
  const blockers: string[] = [];
  if (facts.boardApprovalValid !== true) blockers.push("BOARD_APPROVAL_NOT_VALID");
  if (facts.buyerEligibilityValid !== true) blockers.push("BUYER_ELIGIBILITY_NOT_VALID");
  if (facts.sellerPaymentConfirmed !== true) blockers.push("SELLER_PAYMENT_NOT_CONFIRMED");
  if (facts.mandatoryFeesResolved !== true) blockers.push("COOPERATIVE_FEES_NOT_RESOLVED");
  if (facts.officialRegisterEntryVerified !== true ||
      typeof facts.officialRegisterReference !== "string" ||
      facts.officialRegisterReference.trim().length === 0 ||
      typeof facts.registeredAt !== "string" ||
      Number.isNaN(Date.parse(facts.registeredAt))) {
    blockers.push("OFFICIAL_COOPERATIVE_REGISTER_NOT_VERIFIED");
  }
  if (facts.noOpenDispute !== true) blockers.push("OPEN_DISPUTE_OR_UNKNOWN");
  if (!validPositiveQuantity(facts.tradeQuantity) ||
      !validNonnegativeQuantity(facts.lockedShares) ||
      facts.lockedShares < facts.tradeQuantity) {
    blockers.push("INSUFFICIENT_LOCKED_SHARES");
  }
  // Even with a fully populated fictional fixture this check never authorizes
  // legal finalization. Only a future separately approved source-bound backend
  // command may mirror a verified official register event atomically.
  return report(blockers);
}

/** Share Market v3 §51: all eight RelistGuard predicates are conjunctive.
 * This is a source-verification checklist ONLY; no transition is performed.
 * Unknown/missing/stale authority facts must fail closed. Payment disputes
 * preserve share locks and prevent re-publication until legally resolved.
 */
export interface RelistGuardFacts {
  readonly noUnresolvedPaymentClaim: boolean;
  readonly noOpenDispute: boolean;
  readonly noLegalHold: boolean;
  readonly reservationReleasedSafely: boolean;
  readonly offerStillValid: boolean;
  readonly pricingRuleValid: boolean;
  readonly sellerContinuationOrRelistPermissionValid: boolean;
  readonly marketPolicyAllows: boolean;
}

export function reviewRelistGuard(facts: RelistGuardFacts): PreflightReport {
  const blockers: string[] = [];
  if (facts?.noUnresolvedPaymentClaim !== true) blockers.push("UNRESOLVED_PAYMENT_CLAIM");
  if (facts?.noOpenDispute !== true) blockers.push("OPEN_DISPUTE_OR_UNKNOWN");
  if (facts?.noLegalHold !== true) blockers.push("LEGAL_HOLD_OR_UNKNOWN");
  if (facts?.reservationReleasedSafely !== true) blockers.push("RESERVATION_NOT_SAFELY_RELEASED");
  if (facts?.offerStillValid !== true) blockers.push("OFFER_INVALID_OR_EXPIRED");
  if (facts?.pricingRuleValid !== true) blockers.push("ACTIVE_PRICING_RULE_NOT_VALID");
  if (facts?.sellerContinuationOrRelistPermissionValid !== true) blockers.push("SELLER_RELIST_PERMISSION_NOT_VALID");
  if (facts?.marketPolicyAllows !== true) blockers.push("MARKET_RELIST_POLICY_NOT_VALID");
  // Not an order mutation, nor permission to relist in production.
  return report(blockers);
}
