import { TOC_DECLINED_SESSION_KEY, TOC_STORAGE_KEY, TOC_VERSION } from '../content/disclaimer.js';

/**
 * @typedef {{ version: string, acceptedAt: string }} DisclaimerAcceptance
 */

function canUseStorage() {
  return typeof localStorage !== 'undefined';
}

function canUseSession() {
  return typeof sessionStorage !== 'undefined';
}

/** @returns {DisclaimerAcceptance | null} */
export function readDisclaimerAcceptance() {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(TOC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.version !== 'string' || typeof parsed.acceptedAt !== 'string') {
      return null;
    }
    return { version: parsed.version, acceptedAt: parsed.acceptedAt };
  } catch {
    return null;
  }
}

/** True only when stored acceptance matches the current TOC_VERSION. */
export function hasAcceptedDisclaimer(version = TOC_VERSION) {
  const current = readDisclaimerAcceptance();
  return current?.version === version;
}

/**
 * @param {string} [version]
 * @param {Date} [at]
 * @returns {DisclaimerAcceptance}
 */
export function acceptDisclaimer(version = TOC_VERSION, at = new Date()) {
  const payload = {
    version,
    acceptedAt: at.toISOString(),
  };
  if (canUseStorage()) {
    localStorage.setItem(TOC_STORAGE_KEY, JSON.stringify(payload));
  }
  if (canUseSession()) {
    sessionStorage.removeItem(TOC_DECLINED_SESSION_KEY);
  }
  return payload;
}

/** Decline must not write acceptance; session flag keeps farewell across navigations. */
export function declineDisclaimer() {
  if (canUseSession()) {
    sessionStorage.setItem(TOC_DECLINED_SESSION_KEY, TOC_VERSION);
  }
}

export function hasDeclinedDisclaimer(version = TOC_VERSION) {
  if (!canUseSession()) return false;
  return sessionStorage.getItem(TOC_DECLINED_SESSION_KEY) === version;
}

export function clearDeclinedDisclaimer() {
  if (!canUseSession()) return;
  sessionStorage.removeItem(TOC_DECLINED_SESSION_KEY);
}

export function clearDisclaimerAcceptance() {
  if (!canUseStorage()) return;
  localStorage.removeItem(TOC_STORAGE_KEY);
}
