export class EncryptionUtils {
    private secret: string;

    constructor(secret: string) {
        if (!secret || secret.length < 32) {
            throw new Error("ENCRYPTION_SECRET must be at least 32 characters long");
        }
        this.secret = secret;
    }

    private async getKey(): Promise<CryptoKey> {
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
                salt: encoder.encode("studio-platform-salt"), // Fixed salt for simplicity, ideally random per record but consistent for lookup
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
        const key = await this.getKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoder = new TextEncoder();

        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv },
            key,
            encoder.encode(text)
        );

        // Return IV + Encrypted Data as Hex String
        const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
        const encryptedHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');

        return `${ivHex}:${encryptedHex}`;
    }

    async decrypt(text: string): Promise<string> {
        const [ivHex, encryptedHex] = text.split(':');
        if (!ivHex || !encryptedHex) throw new Error("Invalid encrypted format");

        const key = await this.getKey();
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
