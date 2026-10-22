/**
 * Anonymous-only Vercel Preview protection smoke test.
 * Intentionally uses no credentials, bypass tokens, cookies or authorization headers.
 * Never prints response bodies, redirect query strings or sensitive headers.
 */
import { readFileSync } from 'node:fs';

export const PREVIEW_ROWS = [
  { label: 'Shareholder', hostPrefix: 'tto-shareholder-preview-' },
  { label: 'Cooperative management', hostPrefix: 'tto-cooperative-preview-' },
  { label: 'National admin', hostPrefix: 'tto-national-preview-' },
];

export function extractPreviewUrls(document) {
  return PREVIEW_ROWS.map(({ label, hostPrefix }) => {
    const lines = document.split(/\r?\n/).filter((line) =>
      line.startsWith('|') && line.includes('| ' + label + ' |'),
    );
    if (lines.length !== 1) throw new Error('PREVIEW_ROW_MISSING_OR_DUPLICATED: ' + label);
    const matches = [...lines[0].matchAll(/https:\/\/[^\s|]+/g)];
    if (matches.length !== 1) throw new Error('PREVIEW_URL_AMBIGUOUS: ' + label);
    const url = new URL(matches[0][0]);
    if (url.protocol !== 'https:' || !url.hostname.startsWith(hostPrefix) ||
        !url.hostname.endsWith('.vercel.app') || url.pathname !== '/' ||
        url.search || url.hash || url.username || url.password) {
      throw new Error('PREVIEW_URL_NOT_TRUSTED: ' + label);
    }
    return { label, url: url.toString() };
  });
}

export function evaluateAnonymousResponse({ status, location, body = '', requestUrl }) {
  // Do not confuse an application-generated 401 with Vercel SSO.
  const authMarker = /Vercel Authentication|Authentication Required|Vercel Security Checkpoint|_vercel\/sso-api|vercel\.com\/sso-api|Deployment Protection/i.test(body);
  if (status === 401 || status === 403) {
    return authMarker
      ? { pass: true, reason: 'VERCEL_AUTH_CHALLENGE' }
      : { pass: false, reason: 'DENIAL_NOT_ATTRIBUTABLE_TO_VERCEL_SSO' };
  }
  if ([301, 302, 303, 307, 308].includes(status) && location) {
    let dest;
    try { dest = new URL(location, requestUrl); }
    catch { return { pass: false, reason: 'INVALID_REDIRECT' }; }
    const recognized = dest.protocol === 'https:' && (
      dest.hostname === 'vercel.com' && /sso|login|auth/i.test(dest.pathname) ||
      dest.hostname.endsWith('.vercel.com') && /sso|login|auth/i.test(dest.pathname) ||
      dest.hostname.endsWith('.vercel.app') && /\/_vercel\/sso-api/.test(dest.pathname)
    );
    return recognized
      ? { pass: true, reason: 'VERCEL_SSO_REDIRECT' }
      : { pass: false, reason: 'UNRECOGNIZED_REDIRECT' };
  }
  return { pass: false, reason: 'UNPROVEN_PROTECTION_HTTP_' + status };
}

export async function probePreview(label, url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method: 'GET', redirect: 'manual',
    headers: { 'User-Agent': 'TTO-Anonymous-Preview-Security-Gate/1.0', 'Accept': 'text/html' },
    signal: AbortSignal.timeout(12000),
  });
  const body = (await response.text()).slice(0, 30000);
  const result = evaluateAnonymousResponse({
    status: response.status,
    location: response.headers.get('location'),
    body, requestUrl: url,
  });
  console.log(label + ': status=' + response.status + ' result=' + result.reason + ' gate=' + (result.pass ? 'PASS' : 'FAIL'));
  return result.pass;
}

const isDirectInvocation = process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href;
if (isDirectInvocation) {
  const doc = readFileSync('docs/deployment/VERCEL_NEXT_VAZIRMATN_OTP_2026-10-22.md', 'utf8');
  const targets = extractPreviewUrls(doc);
  let failed = false;
  for (const { label, url } of targets) {
    try {
      if (!await probePreview(label, url)) failed = true;
    } catch (error) {
      console.error(label + ': result=NETWORK_OR_GATE_ERROR gate=FAIL reason=' + (error?.name ?? 'unknown'));
      failed = true;
    }
  }
  if (failed) {
    console.error('PREVIEW_ANONYMOUS_VERCEL_SSO_ACCEPTANCE_NOT_PROVEN');
    process.exitCode = 1;
  } else {
    console.log('PREVIEW_ANONYMOUS_VERCEL_SSO_ACCEPTANCE_PASS_3_OF_3');
  }
}
