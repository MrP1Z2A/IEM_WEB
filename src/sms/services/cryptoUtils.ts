/**
 * Shared utility for cryptographic operations.
 */

/**
 * Hashes a string using SHA-256.
 * Matches the algorithm used in CreateSchoolPage.tsx.
 */
export const hashPassword = async (value: string): Promise<string> => {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
