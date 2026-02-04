
/**
 * Verifies an HMAC-SHA256 signature.
 * @param payload - The raw request body as a string.
 * @param secret - The shared secret.
 * @param signature - The signature received in headers.
 * @returns boolean - True if valid.
 */
export async function verifyHmacSignature(payload: string, secret: string, signature: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    const sigData = new Uint8Array(
        signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
    );

    return await crypto.subtle.verify('HMAC', key, sigData, encoder.encode(payload));
}
