import {randomBytes} from "node:crypto";

/** A user enters the Persian (or Latin) cooperative name, never a host slug.
 * The backend generates a unique-looking, DNS-safe slug, then Postgres'
 * UNIQUE constraint remains the final collision arbiter. No name is reserved
 * until the atomic, OTP-authenticated demo transaction succeeds.
 */
const persian:Record<string,string>={
 "آ":"a","ا":"a","أ":"a","إ":"a","ب":"b","پ":"p","ت":"t",
 "ث":"s","ج":"j","چ":"ch","ح":"h","خ":"kh","د":"d","ذ":"z",
 "ر":"r","ز":"z","ژ":"zh","س":"s","ش":"sh","ص":"s","ض":"z",
 "ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"gh","ک":"k",
 "گ":"g","ل":"l","م":"m","ن":"n","و":"v","ه":"h","ی":"y",
 "ئ":"y","ؤ":"v","ء":"","ة":"h"
};
export function generateDemoWorkspaceSlug(name:string):string{
 const normalized=name.normalize("NFKC").replace(/ي/g,"ی").replace(/ك/g,"ک")
  .replace(/[\u064b-\u065f\u0670\u200c]/g," ");
 const roman=Array.from(normalized).map(ch=>persian[ch]??ch).join("");
 const stem=roman.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")
  .slice(0,24).replace(/-+$/g,"")||"coop";
 // 56 random bits: practically unique even when multiple users choose the
 // same name simultaneously. No incrementing or enumerating tenant IDs.
 return stem+"-"+randomBytes(7).toString("hex");
}
