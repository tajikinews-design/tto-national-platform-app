/**
 * TTO Share Market v3 §21; arithmetic only, for ephemeral PG17 lab.
 * Integer monetary units with HALF_UP percent/split rounding.
 * Inputs must come from tenant-scoped versioned source, not the browser.
 * CUSTOM_APPROVED_BASE stays blocked pending an independently verifiable
 * custom-base source. This never creates payments or book entries.
 */
export interface LabFeePolicy {
  fee_id:string;source_version:string;calculation_mode:string;payer_mode:string;
  fixed_amount:string|null;percentage_rate_bps:number;percentage_basis:string;
  buyer_percent:number;seller_percent:number;minimum_amount:string|null;
  maximum_amount:string|null;
}
export function calculateDisposableFee(
 fee:LabFeePolicy,gross:bigint,verifiedCustomBase:bigint|null=null
):{total:bigint;buyerAmount:bigint;sellerAmount:bigint}{
  if(gross<=0n)throw Error("LAB_FEE_GROSS_INVALID");
  const mode=fee.calculation_mode,payer=fee.payer_mode;
  if(!["FIXED","PERCENTAGE","FIXED_PLUS_PERCENTAGE"].includes(mode))
    throw Error("LAB_FEE_MODE_UNSUPPORTED");
  if(!["BUYER","SELLER","SPLIT"].includes(payer))
    throw Error("LAB_FEE_PAYER_UNSUPPORTED");
  if(fee.percentage_basis!=="TRADE_GROSS_VALUE"&&fee.percentage_basis!=="SHARE_VALUE"&&
     fee.percentage_basis!=="CUSTOM_APPROVED_BASE")
    throw Error("LAB_FEE_BASIS_UNSUPPORTED");
  if(fee.percentage_basis==="CUSTOM_APPROVED_BASE"&&
     (verifiedCustomBase===null||verifiedCustomBase<=0n))
    throw Error("LAB_FEE_CUSTOM_BASE_NOT_VERIFIED");
  if(!Number.isInteger(fee.percentage_rate_bps)||fee.percentage_rate_bps<0||
     fee.percentage_rate_bps>10000)throw Error("LAB_FEE_PERCENT_INVALID");
  if(!Number.isInteger(fee.buyer_percent)||!Number.isInteger(fee.seller_percent)||
    fee.buyer_percent<0||fee.seller_percent<0||
    fee.buyer_percent+fee.seller_percent!==100)throw Error("LAB_FEE_SPLIT_INVALID");
  if((payer==="BUYER"&&fee.buyer_percent!==100)||
     (payer==="SELLER"&&fee.seller_percent!==100)||
     (payer==="SPLIT"&&(fee.buyer_percent===0||fee.seller_percent===0)))
    throw Error("LAB_FEE_PAYER_SPLIT_MISMATCH");
  const fixed=BigInt(fee.fixed_amount??"0");
  if(fixed<0n)throw Error("LAB_FEE_NEGATIVE_FIXED");
  const percentBase=fee.percentage_basis==="CUSTOM_APPROVED_BASE"?verifiedCustomBase!:gross;
  const percent=(percentBase*BigInt(fee.percentage_rate_bps)+5000n)/10000n;
  let total=(mode==="PERCENTAGE"?0n:fixed)+(mode==="FIXED"?0n:percent);
  const minimum=fee.minimum_amount==null?null:BigInt(fee.minimum_amount);
  const maximum=fee.maximum_amount==null?null:BigInt(fee.maximum_amount);
  if(minimum!==null&&total<minimum)total=minimum;
  if(maximum!==null&&total>maximum)total=maximum;
  if(total<=0n||total>BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("LAB_FEE_TOTAL_INVALID");
  const buyerAmount=(total*BigInt(fee.buyer_percent)+50n)/100n;
  const sellerAmount=total-buyerAmount;
  if(buyerAmount+sellerAmount!==total||buyerAmount<0n||sellerAmount<0n)
    throw Error("LAB_FEE_CONSERVATION_FAILED");
  return {total,buyerAmount,sellerAmount};
}
