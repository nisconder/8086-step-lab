import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS } from '../chapters.mjs';
import { resolveSelection, selectionHref } from '../routing.mjs';

test('article links select the first demonstration in each chapter', () => {
  for (const chapter of CHAPTERS) {
    assert.deepEqual(resolveSelection('?chapter=' + chapter.id), {
      chapterId: chapter.id, demoId: chapter.demoIds[0] || null
    });
  }
});

test('demo links and legacy example links select the corresponding chapter', () => {
  for (const chapter of CHAPTERS) for (const demoId of chapter.demoIds) {
    const expected = { chapterId: chapter.id, demoId };
    assert.deepEqual(resolveSelection('?demo=' + demoId), expected);
    assert.deepEqual(resolveSelection('?example=' + demoId), expected);
    const href = selectionHref('https://example.test/lab/?ref=blog#scope', expected);
    assert.deepEqual(resolveSelection(new URL(href).search), expected);
    assert.equal(new URL(href).searchParams.get('ref'), 'blog');
    assert.equal(new URL(href).hash, '');
  }
});

test('invalid or conflicting parameters never display a different chapter demo', () => {
  assert.deepEqual(resolveSelection('?chapter=05&demo=stack'), { chapterId: '05', demoId: 'segmented-address' });
  assert.deepEqual(resolveSelection('?chapter=04&demo=stack'), { chapterId: '04', demoId: null });
  assert.deepEqual(resolveSelection('?chapter=missing&demo=bp-address'), { chapterId: '06', demoId: 'bp-address' });
  assert.deepEqual(resolveSelection('?chapter=missing&demo=missing'), { chapterId: '01', demoId: 'instruction-trace' });
  assert.throws(() => selectionHref('https://example.test/', { chapterId: '05', demoId: 'stack' }));
  assert.throws(() => selectionHref('https://example.test/', { chapterId: 'missing' }));
});

test('reading links remove stale demo parameters and preserve the chapter', () => {
  const href = selectionHref('https://example.test/?chapter=03&example=overflow&demo=overflow', { chapterId: '04', demoId: null });
  const params = new URL(href).searchParams;
  assert.equal(params.has('example'), false);
  assert.equal(params.has('demo'), false);
  assert.deepEqual(resolveSelection(params.toString()), { chapterId: '04', demoId: null });
});
