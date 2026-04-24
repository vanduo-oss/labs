import { allow, block, normalizeText } from './core.js';

export { VD_GUARDRAILS_VERSION } from './core.js';

const SAFE_ICON_RE = /^[a-z0-9-]{1,64}$/i;
const SAFE_ROUTE_RE = /^[a-z0-9/_-]{1,240}$/i;

/**
 * @param {unknown} query
 * @param {{ maxLength?: number }=} options
 */
export function normalizeSearchQuery(query, options = {}) {
  const maxLength = options.maxLength ?? 240;
  return normalizeText(query).slice(0, maxLength);
}

/**
 * @param {unknown} query
 * @param {{ minLength?: number, maxLength?: number }=} options
 */
export function validateSearchQuery(query, options = {}) {
  const minLength = options.minLength ?? 2;
  const maxLength = options.maxLength ?? 240;
  const normalized = normalizeSearchQuery(query, { maxLength: maxLength + 64 });

  if (!normalized) {
    return block({ code: 'search.query.empty', message: 'Query cannot be empty.' });
  }
  if (normalized.length < minLength) {
    return block({
      code: 'search.query.too_short',
      message: `Query must be at least ${minLength} characters.`,
      meta: { minLength, actualLength: normalized.length },
    });
  }
  if (normalized.length > maxLength) {
    return block({
      code: 'search.query.too_long',
      message: `Query is too long (max ${maxLength} characters).`,
      meta: { maxLength, actualLength: normalized.length },
    });
  }
  if (/(.)\1{19,}/.test(normalized)) {
    return block({
      code: 'search.query.pathological',
      message: 'Query appears malformed (repeated character sequence).',
    });
  }

  return allow({ normalizedQuery: normalized });
}

/**
 * @param {unknown} value
 * @param {number} maxLen
 */
function asBoundedString(value, maxLen) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > maxLen) return null;
  return v;
}

/**
 * @param {unknown} doc
 */
export function validateSearchIndexDocument(doc) {
  if (!doc || typeof doc !== 'object') {
    return block({ code: 'search.doc.invalid_type', message: 'Document must be an object.' });
  }

  const id = asBoundedString(doc.id, 120);
  const title = asBoundedString(doc.title, 240);
  const category = asBoundedString(doc.category, 120);
  const route = asBoundedString(doc.route, 240);
  const icon = asBoundedString(doc.icon || 'ph-file-text', 64);

  if (!id) return block({ code: 'search.doc.id', message: 'Document id is missing or invalid.' });
  if (!title) return block({ code: 'search.doc.title', message: 'Document title is missing or invalid.' });
  if (!category) return block({ code: 'search.doc.category', message: 'Document category is missing or invalid.' });
  if (!route || !SAFE_ROUTE_RE.test(route) || route.startsWith('/')) {
    return block({ code: 'search.doc.route', message: 'Document route is missing or unsafe.' });
  }
  if (!icon || !SAFE_ICON_RE.test(icon)) {
    return block({ code: 'search.doc.icon', message: 'Document icon is invalid.' });
  }
  if (!Array.isArray(doc.keywords) || !Array.isArray(doc.headings) || !Array.isArray(doc.classes) || !Array.isArray(doc.chunks)) {
    return block({ code: 'search.doc.arrays', message: 'Document keywords/headings/classes/chunks must be arrays.' });
  }
  if (typeof doc.bodyText !== 'string' || doc.bodyText.length > 12000) {
    return block({ code: 'search.doc.body', message: 'Document bodyText is missing or too large.' });
  }

  return allow();
}

/**
 * @param {unknown} payload
 * @param {{ maxDocuments?: number }=} options
 */
export function validateSearchIndexPayload(payload, options = {}) {
  const maxDocuments = options.maxDocuments ?? 5000;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.documents)) {
    return block({ code: 'search.index.shape', message: 'Index payload must contain a documents array.' });
  }

  const docs = payload.documents;
  if (docs.length === 0) return block({ code: 'search.index.empty', message: 'Index documents array is empty.' });
  if (docs.length > maxDocuments) {
    return block({ code: 'search.index.too_many_docs', message: `Index has too many documents (max ${maxDocuments}).` });
  }

  const ids = new Set();
  for (const doc of docs) {
    const check = validateSearchIndexDocument(doc);
    if (!check.allowed) return check;
    if (ids.has(doc.id)) {
      return block({ code: 'search.index.duplicate_id', message: `Duplicate document id: ${doc.id}` });
    }
    ids.add(doc.id);
  }

  return allow({ documentCount: docs.length, documentIds: ids });
}

/**
 * @param {unknown} payload
 * @param {{ maxDocuments?: number, maxDimensions?: number }=} options
 */
export function validateVectorPayload(payload, options = {}) {
  const maxDocuments = options.maxDocuments ?? 5000;
  const maxDimensions = options.maxDimensions ?? 4096;

  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.documents)) {
    return block({ code: 'search.vectors.shape', message: 'Vector payload must contain a documents array.' });
  }

  const vectors = payload.documents;
  if (vectors.length === 0) return block({ code: 'search.vectors.empty', message: 'Vector documents array is empty.' });
  if (vectors.length > maxDocuments) {
    return block({ code: 'search.vectors.too_many_docs', message: `Vector payload has too many rows (max ${maxDocuments}).` });
  }

  let dimension = null;
  for (const row of vectors) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string' || !Array.isArray(row.embedding)) {
      return block({ code: 'search.vectors.row_shape', message: 'Vector row must include id and embedding array.' });
    }

    if (dimension === null) {
      dimension = row.embedding.length;
      if (dimension < 2 || dimension > maxDimensions) {
        return block({ code: 'search.vectors.dimension', message: 'Vector embedding dimension is invalid.' });
      }
    } else if (row.embedding.length !== dimension) {
      return block({ code: 'search.vectors.dimension_mismatch', message: 'Vector embedding dimensions are inconsistent.' });
    }

    for (const value of row.embedding) {
      if (!Number.isFinite(value)) {
        return block({ code: 'search.vectors.non_finite', message: `Vector for doc ${row.id} contains non-finite values.` });
      }
    }
  }

  return allow({ dimensions: dimension, count: vectors.length });
}

/**
 * @param {unknown} baseUrl
 * @param {unknown} route
 */
export function safeDocHref(baseUrl, route) {
  let safeBase = String(baseUrl || '').trim() || 'https://vanduo.dev';
  try {
    const parsed = new URL(safeBase);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      safeBase = 'https://vanduo.dev';
    }
  } catch {
    safeBase = 'https://vanduo.dev';
  }
  const safeRoute = String(route || '').trim();
  if (!SAFE_ROUTE_RE.test(safeRoute) || safeRoute.startsWith('/')) {
    return '#';
  }
  return `${safeBase.replace(/\/$/, '')}/#${safeRoute}`;
}

/**
 * @param {unknown} icon
 */
export function sanitizeIconClass(icon) {
  const value = String(icon || '').trim();
  if (!SAFE_ICON_RE.test(value)) return 'ph-file-text';
  return value;
}

export const searchGuardrails = {
  normalizeSearchQuery,
  validateSearchQuery,
  validateSearchIndexDocument,
  validateSearchIndexPayload,
  validateVectorPayload,
  safeDocHref,
  sanitizeIconClass,
};
