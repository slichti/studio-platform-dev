export class EncryptionUtils {
    private secret: string;

    constructor(secret: string) {
        if (!secret || secret.length < 32) {
            throw new Error("ENCRYPTION_SECRET must be at least 32 characters long");
        }
        this.secret = secret;
    }

    private async getKey(salt: Uint8Array): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw",
            encoder.encode(this.secret),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        return crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt as BufferSource,
                iterations: 100000,
                hash: "SHA-256"
            },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    async encrypt(text: string): Promise<string> {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await this.getKey(salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(text)
        );

        // Return Salt + IV + Encrypted Data as Hex String (new format: salt:iv:ciphertext)
        const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

        return `${saltHex}:${ivHex}:${encryptedHex}`;
    }

    async decrypt(text: string): Promise<string> {
        const parts = text.split(':');

        let salt: Uint8Array;
        let ivHex: string;
        let encryptedHex: string;

        if (parts.length === 3) {
            // New format: salt:iv:ciphertext
            salt = new Uint8Array(parts[0].match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            ivHex = parts[1];
            encryptedHex = parts[2];
        } else if (parts.length === 2) {
            // Legacy format: iv:ciphertext (uses fixed salt for backward compatibility)
            salt = new TextEncoder().encode("studio-platform-salt");
            ivHex = parts[0];
            encryptedHex = parts[1];
        } else {
            throw new Error("Invalid encrypted format");
        }

        const key = await this.getKey(salt);
        const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        const encrypted = new Uint8Array(encryptedHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            encrypted
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }
}
