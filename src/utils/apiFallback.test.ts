import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isUsingLocalBackend,
  resetBackendDetection,
  saumApi,
} from './api';

test('saumApi seamlessly falls back to local storage on static/Vercel HTTP 404 without throwing', async () => {
  resetBackendDetection();
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('/api/')) {
        return new Response('404: NOT_FOUND', {
          status: 404,
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        });
      }
      throw new Error('Unexpected fetch');
    };

    const auth = await saumApi.login('superadmin');
    assert.equal(auth.user.role, 'Super Admin');
    assert.equal(isUsingLocalBackend(), true);

    const state = await saumApi.getState();
    assert.equal(state.students.length > 0, true);
    assert.equal(state.rekapConfig.kursiPerMeja, 2);

    const updatedStudents = state.students.map((s, idx) =>
      idx === 0 ? { ...s, nomorMeja: 77 } : s
    );
    const saved = await saumApi.saveDeskNumbers(updatedStudents);
    assert.equal(saved.students[0].nomorMeja, 77);
  } finally {
    globalThis.fetch = originalFetch;
    resetBackendDetection();
  }
});

test('saumApi falls back when static host serves HTML index.html with status 200 on /api/*', async () => {
  resetBackendDetection();
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response('<!doctype html><html><body>SPA</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

    const res = await saumApi.getUsers();
    assert.equal(res.users.length > 0, true);
    assert.equal(isUsingLocalBackend(), true);
  } finally {
    globalThis.fetch = originalFetch;
    resetBackendDetection();
  }
});

test('saumApi preserves genuine domain 404 JSON errors when Express backend is alive', async () => {
  resetBackendDetection();
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url === '/api/health') {
        return new Response(JSON.stringify({ status: 'ok', service: 'saum-backend' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Arsip tidak ditemukan.' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    };

    await assert.rejects(
      () => saumApi.unlockArchive('missing-id', 'Alasan valid'),
      /Arsip tidak ditemukan\./
    );
    assert.equal(isUsingLocalBackend(), false);
  } finally {
    globalThis.fetch = originalFetch;
    resetBackendDetection();
  }
});
