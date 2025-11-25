/**
 * HMAC Request Signer
 * 
 * Generates HMAC-SHA256 signatures for outgoing requests (agent → backend).
 * Implements signature format from details.txt:
 * 
 * Headers:
 * - X-HMAC-KeyId: <key-id>
 * - X-HMAC-Ts: <ISO8601>
 * - X-HMAC-Nonce: <uuid-v4>
 * - X-HMAC-Signature: hex(hmac-sha256(key, method|path|ts|nonce|body))
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface HMACHeaders {
  'X-HMAC-KeyId': string;
  'X-HMAC-Ts': string;
  'X-HMAC-Nonce': string;
  'X-HMAC-Signature': string;
}

/**
 * Sign an outgoing request with HMAC-SHA256
 * 
 * @param method HTTP method (GET, POST, etc.)
 * @param path Request path (e.g., /api/jobs)
 * @param body Request body (string or object)
 * @param keyId Key identifier for key rotation support
 * @returns HMAC headers to add to request
 * 
 * @example
 * const headers = signRequest('POST', '/api/jobs', { job_type: 'test' });
 * fetch('/api/jobs', {
 *   method: 'POST',
 *   headers: { ...headers, 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ job_type: 'test' })
 * });
 */
export function signRequest(
  method: string,
  path: string,
  body: string | object,
  keyId: string = 'default'
): HMACHeaders {
  // Get HMAC secret from environment
  const secret = getHMACSecret(keyId);
  
  // Generate timestamp and nonce
  const timestamp = new Date().toISOString();
  const nonce = uuidv4();
  
  // Normalize body to string
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  
  // Create canonical string: METHOD|PATH|TIMESTAMP|NONCE|BODY
  const canonical = `${method.toUpperCase()}|${path}|${timestamp}|${nonce}|${bodyString}`;
  
  // Generate HMAC-SHA256 signature
  const signature = crypto
    .createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');
  
  return {
    'X-HMAC-KeyId': keyId,
    'X-HMAC-Ts': timestamp,
    'X-HMAC-Nonce': nonce,
    'X-HMAC-Signature': signature,
  };
}

/**
 * Get HMAC secret from environment
 * 
 * Supports multiple keys for rotation:
 * - HMAC_SECRET_DEFAULT (primary)
 * - HMAC_SECRET_V1, HMAC_SECRET_V2, etc. (versioned)
 * 
 * @param keyId Key identifier (e.g., 'default', 'v1')
 * @returns HMAC secret key
 * @throws Error if secret not found
 */
function getHMACSecret(keyId: string): string {
  const envKey = `HMAC_SECRET_${keyId.toUpperCase()}`;
  const secret = process.env[envKey];
  
  if (!secret) {
    throw new Error(
      `HMAC secret not found for key-id: ${keyId}. ` +
      `Set environment variable: ${envKey}`
    );
  }
  
  // Validate secret length (minimum 32 bytes = 64 hex chars)
  if (secret.length < 64) {
    throw new Error(
      `HMAC secret for ${keyId} is too short (${secret.length} chars). ` +
      `Minimum 64 hex characters (32 bytes) required.`
    );
  }
  
  return secret;
}

/**
 * Verify HMAC signature (for testing/validation)
 * 
 * Not used in production (see verifier.ts), but useful for testing signer.
 */
export function verifySignature(
  method: string,
  path: string,
  body: string,
  headers: HMACHeaders
): boolean {
  try {
    const secret = getHMACSecret(headers['X-HMAC-KeyId']);
    const canonical = `${method.toUpperCase()}|${path}|${headers['X-HMAC-Ts']}|${headers['X-HMAC-Nonce']}|${body}`;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(canonical)
      .digest('hex');
    
    return headers['X-HMAC-Signature'] === expectedSignature;
  } catch {
    return false;
  }
}

/**
 * Default export
 */
export default {
  signRequest,
  verifySignature,
};
