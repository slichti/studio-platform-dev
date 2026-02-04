
export class StorageService {
    constructor(private bucket: R2Bucket) { }

    /**
     * Recursively deletes all objects with the given prefix.
     * R2 list limit is 1000, so we paginate.
     * R2 delete limit is 1000 per batch.
     */
    async deleteDirectory(prefix: string): Promise<void> {
        if (!prefix || prefix === '/') {
            throw new Error("Refusing to delete root or empty prefix");
        }
        if (!prefix.endsWith('/')) prefix += '/';

        let truncated = true;
        let cursor: string | undefined;

        while (truncated) {
            const list = await this.bucket.list({ prefix, limit: 1000, cursor });
            truncated = list.truncated;
            cursor = (list as any).cursor;

            if (list.objects.length > 0) {
                const keys = list.objects.map(o => o.key);
                await this.bucket.delete(keys);
                console.log(`Deleted ${keys.length} files from ${prefix}`);
            }
        }
    }
}
