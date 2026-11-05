// Admin Authentication & GitHub Actions Workflow Dispatch Utility
// Pre-configured with static password "chicken12" (update DEFAULT_ADMIN_PASSWORD below or via the UI settings drawer)

export const DEFAULT_ADMIN_PASSWORD = 'chicken12';

export const GITHUB_REPO_OWNER = 'tkengl-qwerty';
export const GITHUB_REPO_NAME = 'ai-dashboard';
export const GITHUB_WORKFLOW_FILE = 'daily-5am-refresh.yml';
export const GITHUB_BRANCH = 'main';

const STORAGE_KEY_CUSTOM_PASSWORD = 'ai_macro_admin_password_override';
const STORAGE_KEY_ENCRYPTED_TOKEN = 'ai_macro_encrypted_gh_token';
const SESSION_KEY_UNLOCKED = 'ai_macro_admin_unlocked';

// Optional build-time AES-256-GCM encrypted GitHub token (encrypted with DEFAULT_ADMIN_PASSWORD)
const BUILD_TIME_ENCRYPTED_TOKEN: string =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_ENCRYPTED_GH_TOKEN || '';

export interface WorkflowRunStatus {
  id: number;
  status: 'queued' | 'in_progress' | 'completed' | string;
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returns the active static password ("chicken12" by default, or user-updated override)
 */
export function getActiveAdminPassword(): string {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_PASSWORD);
    if (custom && custom.trim().length > 0) {
      return custom.trim();
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_ADMIN_PASSWORD;
}

/**
 * Verifies if the entered password matches the static password ("chicken12" by default)
 */
export function verifyAdminPassword(input: string): boolean {
  return input === getActiveAdminPassword();
}

/**
 * Updates the static password in localStorage (and re-encrypts any stored GitHub token with the new password)
 */
export async function updateAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  if (!verifyAdminPassword(currentPassword)) {
    return { ok: false, message: 'Current password is incorrect.' };
  }
  if (!newPassword || newPassword.trim().length < 4) {
    return { ok: false, message: 'New password must be at least 4 characters.' };
  }

  const trimmedNew = newPassword.trim();
  try {
    // If there is an encrypted token stored, re-encrypt it with the new password
    const existingEncrypted = getStoredEncryptedToken();
    if (existingEncrypted) {
      try {
        const rawToken = await decryptTokenWithPassword(existingEncrypted, currentPassword);
        const reEncrypted = await encryptTokenWithPassword(rawToken, trimmedNew);
        localStorage.setItem(STORAGE_KEY_ENCRYPTED_TOKEN, reEncrypted);
      } catch {
        // Token couldn't be decrypted with old password, leave as is
      }
    }

    if (trimmedNew === DEFAULT_ADMIN_PASSWORD) {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_PASSWORD);
    } else {
      localStorage.setItem(STORAGE_KEY_CUSTOM_PASSWORD, trimmedNew);
    }
    sessionStorage.setItem(SESSION_KEY_UNLOCKED, 'true');
    return { ok: true, message: 'Admin password updated.' };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Failed to update password.',
    };
  }
}

export function isSessionUnlocked(): boolean {
  try {
    return sessionStorage.getItem(SESSION_KEY_UNLOCKED) === 'true';
  } catch {
    return false;
  }
}

export function setSessionUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) {
      sessionStorage.setItem(SESSION_KEY_UNLOCKED, 'true');
    } else {
      sessionStorage.removeItem(SESSION_KEY_UNLOCKED);
    }
  } catch {
    // ignore
  }
}

export function getStoredEncryptedToken(): string {
  try {
    const local = localStorage.getItem(STORAGE_KEY_ENCRYPTED_TOKEN);
    if (local && local.trim().length > 0) {
      return local.trim();
    }
  } catch {
    // ignore
  }
  return BUILD_TIME_ENCRYPTED_TOKEN;
}

export function hasConfiguredGitHubToken(): boolean {
  return getStoredEncryptedToken().length > 0;
}

// --- Web Crypto API (PBKDF2 + AES-256-GCM) ---

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a GitHub PAT with the admin password using AES-256-GCM
 */
export async function encryptTokenWithPassword(token: string, password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);

  const enc = new TextEncoder();
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    enc.encode(token.trim())
  );

  const cipherBytes = new Uint8Array(cipherBuffer);
  const combined = new Uint8Array(salt.length + iv.length + cipherBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(cipherBytes, salt.length + iv.length);

  return bytesToBase64(combined);
}

/**
 * Decrypts the AES-256-GCM encrypted GitHub PAT in browser memory using the admin password
 */
export async function decryptTokenWithPassword(
  encryptedBase64: string,
  password: string
): Promise<string> {
  const combined = base64ToBytes(encryptedBase64.trim());
  if (combined.length < 29) {
    throw new Error('Invalid encrypted token format.');
  }

  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const cipherBytes = combined.slice(28);

  const key = await deriveAesKey(password, salt);
  const plainBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    cipherBytes as unknown as BufferSource
  );

  return new TextDecoder().decode(plainBuffer);
}

/**
 * Saves and encrypts a GitHub Personal Access Token using the current admin password
 */
export async function saveAndEncryptGitHubToken(
  rawToken: string,
  password: string
): Promise<{ ok: boolean; encrypted: string; message: string }> {
  if (!verifyAdminPassword(password)) {
    return { ok: false, encrypted: '', message: 'Incorrect admin password.' };
  }
  if (!rawToken || rawToken.trim().length < 10) {
    return { ok: false, encrypted: '', message: 'Please enter a valid GitHub Personal Access Token.' };
  }

  const encrypted = await encryptTokenWithPassword(rawToken.trim(), password);
  localStorage.setItem(STORAGE_KEY_ENCRYPTED_TOKEN, encrypted);
  return {
    ok: true,
    encrypted,
    message: 'GitHub token encrypted with your password and saved.',
  };
}

/**
 * Triggers the GitHub Actions workflow (`daily-5am-refresh.yml`) via GitHub REST API
 */
export async function triggerGitHubRefreshWorkflow(
  password: string,
  oneTimeRawToken?: string
): Promise<{ ok: boolean; needsToken?: boolean; message: string; actionsUrl: string }> {
  const actionsUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_WORKFLOW_FILE}`;

  if (!verifyAdminPassword(password)) {
    return {
      ok: false,
      message: 'Incorrect password. Only the dashboard owner can trigger a refresh.',
      actionsUrl,
    };
  }

  setSessionUnlocked(true);

  let githubToken = '';

  if (oneTimeRawToken && oneTimeRawToken.trim().length > 0) {
    githubToken = oneTimeRawToken.trim();
    // Automatically encrypt & save it with the verified password for future 1-click refreshes
    try {
      const encrypted = await encryptTokenWithPassword(githubToken, password);
      localStorage.setItem(STORAGE_KEY_ENCRYPTED_TOKEN, encrypted);
    } catch {
      // ignore storage failure
    }
  } else {
    const encrypted = getStoredEncryptedToken();
    if (!encrypted) {
      return {
        ok: false,
        needsToken: true,
        message:
          'Password verified! Paste your GitHub Actions token once below to enable direct one-click triggers from this browser.',
        actionsUrl,
      };
    }

    try {
      githubToken = await decryptTokenWithPassword(encrypted, password);
    } catch {
      return {
        ok: false,
        needsToken: true,
        message:
          'Stored token could not be decrypted with the current password. Please re-enter your GitHub token below.',
        actionsUrl,
      };
    }
  }

  const dispatchUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_WORKFLOW_FILE}/dispatches`;

  try {
    const response = await fetch(dispatchUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: GITHUB_BRANCH,
      }),
    });

    if (response.status === 204 || response.ok) {
      return {
        ok: true,
        message:
          'GitHub Action (daily-5am-refresh.yml) triggered! Fetching latest market data & macro news and rebuilding Porkbun static site (~60s).',
        actionsUrl,
      };
    }

    let errDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.message) {
        errDetail = errJson.message;
      }
    } catch {
      // ignore
    }

    return {
      ok: false,
      needsToken: response.status === 401 || response.status === 403 || response.status === 404,
      message: `GitHub API returned ${errDetail}. Ensure your token has "Actions: Read and write" permission on ${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}.`,
      actionsUrl,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Network error contacting GitHub API: ${err.message}`
          : 'Network error contacting GitHub API.',
      actionsUrl,
    };
  }
}

/**
 * Fetches the latest workflow run status for `daily-5am-refresh.yml`
 */
export async function fetchLatestWorkflowRun(password?: string): Promise<WorkflowRunStatus | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/actions/workflows/${GITHUB_WORKFLOW_FILE}/runs?per_page=1`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Attach token if available so private repos or rate-limited IPs work smoothly
  const encrypted = getStoredEncryptedToken();
  if (encrypted && password) {
    try {
      const token = await decryptTokenWithPassword(encrypted, password);
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // fallback to unauthenticated check
    }
  }

  try {
    const res = await fetch(`${url}&_t=${Date.now()}`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    const run = data?.workflow_runs?.[0];
    if (!run) return null;
    return {
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      htmlUrl: run.html_url,
      createdAt: run.created_at,
      updatedAt: run.updated_at,
    };
  } catch {
    return null;
  }
}
