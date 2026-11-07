import { CHAPTERS } from './chapters.mjs';

export function resolveSelection(search) {
  const params = new URLSearchParams(search);
  const requestedDemo = params.get('demo') || params.get('example');
  const requestedChapter = CHAPTERS.find(chapter => chapter.id === params.get('chapter'));
  const inferred = CHAPTERS.find(chapter => chapter.demoIds.includes(requestedDemo));
  const chapter = requestedChapter || inferred || CHAPTERS.find(chapter => chapter.id === '01');
  const demoId = chapter.demoIds.includes(requestedDemo) ? requestedDemo : chapter.demoIds[0] || null;
  return { chapterId: chapter.id, demoId };
}

export function selectionHref(href, selection) {
  const chapter = CHAPTERS.find(item => item.id === selection.chapterId);
  if (!chapter) throw new Error('Unknown chapter');
  if (selection.demoId && !chapter.demoIds.includes(selection.demoId)) throw new Error('Demo does not belong to chapter');
  const url = new URL(href);
  url.searchParams.set('chapter', chapter.id);
  url.searchParams.delete('example');
  if (selection.demoId) url.searchParams.set('demo', selection.demoId);
  else url.searchParams.delete('demo');
  url.hash = '';
  return url.href;
}
