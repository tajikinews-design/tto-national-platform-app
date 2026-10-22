import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPreviewUrls, evaluateAnonymousResponse, probePreview } from './verify-vercel-preview-protection.mjs';

const previewDocument = [
  '| App | URL | ID | Framework |',
  '| --- | --- | --- | --- |',
  '| Shareholder | https://tto-shareholder-preview-example.vercel.app | abc | Next |',
  '| Cooperative management | https://tto-cooperative-preview-example.vercel.app | def | Next |',
  '| National admin | https://tto-national-preview-example.vercel.app | ghi | Next |',
].join('\n');
const requestUrl = 'https://tto-shareholder-preview-example.vercel.app/';

test('extract all three exact protected preview URLs', () => {
  const targets = extractPreviewUrls(previewDocument);
  assert.deepEqual(targets.map(t => t.label), ['Shareholder', 'Cooperative management', 'National admin']);
  assert.equal(targets[0].url, requestUrl);
});

test('reject missing/duplicated rows and spoofed hosts', () => {
  assert.throws(() => extractPreviewUrls(previewDocument.replace('Cooperative management', 'Other')));
  assert.throws(() => extractPreviewUrls(previewDocument + previewDocument));
  assert.throws(() => extractPreviewUrls(previewDocument.replace('tto-national-preview-example.vercel.app', 'tto-national-preview-evil.example.com')));
});

test('public HTML 200 must fail even when it resembles a login', () => {
  assert.equal(evaluateAnonymousResponse({status: 200, body: '<h1>login</h1>', requestUrl}).pass, false);
});

test('application 401 without Vercel SSO evidence is insufficient', () => {
  assert.equal(evaluateAnonymousResponse({status: 401, body: 'unauthorized', requestUrl}).pass, false);
});

test('Vercel auth challenge and recognizable SSO redirect pass', () => {
  assert.equal(evaluateAnonymousResponse({status: 401, body: '<title>Authentication Required</title>', requestUrl}).pass, true);
  assert.equal(evaluateAnonymousResponse({status: 302, location: 'https://vercel.com/sso-api?token=redacted', requestUrl}).pass, true);
});

test('unexpected redirects/404/500 fail closed', () => {
  for (const status of [404, 500]) assert.equal(evaluateAnonymousResponse({status, requestUrl}).pass, false);
  assert.equal(evaluateAnonymousResponse({status: 302, location: '/login', requestUrl}).pass, false);
  assert.equal(evaluateAnonymousResponse({status: 302, location: 'https://evil.example/login', requestUrl}).pass, false);
});

test('probe sends no auth or bypass and never follows redirects', async () => {
  let call;
  const fakeFetch = async (url, options) => {
    call = {url, options};
    return {status: 401, headers: {get: () => null}, text: async () => 'Vercel Authentication'};
  };
  assert.equal(await probePreview('Test', requestUrl, fakeFetch), true);
  assert.equal(call.options.redirect, 'manual');
  assert.equal(call.options.headers.Authorization, undefined);
  assert.equal(call.options.headers['x-vercel-protection-bypass'], undefined);
});
