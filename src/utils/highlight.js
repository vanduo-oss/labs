import { highlight } from '@vanduo-oss/vdl-cbun/code-editor/highlight';

/** DocCodeSnippet / VdCodeSnippet tab keys → tokenizer ids. */
const LANGUAGE = {
  html: 'html',
  css: 'css',
  js: 'typescript',
  shell: 'shell',
  vue: 'vue',
  json: 'json',
};

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Syntax-highlight a code string for DocCodeSnippet tabs.
 * Returns HTML-escaped markup with `vd-tk-*` token spans.
 */
export function highlightCode(code, key) {
  const language = LANGUAGE[key];
  if (!language) return escapeHtml(code);
  try {
    return highlight(code, language);
  } catch {
    return escapeHtml(code);
  }
}
