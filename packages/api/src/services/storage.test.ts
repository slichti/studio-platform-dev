
import { describe, it, expect, vi } from 'vitest'; // Assuming vitest
import { StorageService } from './storage';

describe('StorageService', () => {
    it('should delete objects recursively with pagination', async () => {
        // Mock R2Bucket
        const mockBucket: any = {
            list: vi.fn(),
            delete: vi.fn()
        };

        // Page 1: 2 items, truncated
        mockBucket.list.mockResolvedValueOnce({
            objects: [{ key: 'p/1' }, { key: 'p/2' }],
            truncated: true,
            cursor: 'c1'
        });

        // Page 2: 1 item, finished
        mockBucket.list.mockResolvedValueOnce({
            objects: [{ key: 'p/3' }],
            truncated: false,
            cursor: undefined
        });

        const service = new StorageService(mockBucket);
        await service.deleteDirectory('p/');

        expect(mockBucket.list).toHaveBeenCalledTimes(2);
        expect(mockBucket.list).toHaveBeenNthCalledWith(1, { prefix: 'p/', limit: 1000, cursor: undefined });
        expect(mockBucket.list).toHaveBeenNthCalledWith(2, { prefix: 'p/', limit: 1000, cursor: 'c1' });

        expect(mockBucket.delete).toHaveBeenCalledTimes(2);
        expect(mockBucket.delete).toHaveBeenNthCalledWith(1, ['p/1', 'p/2']);
        expect(mockBucket.delete).toHaveBeenNthCalledWith(2, ['p/3']);
    });

    it('should normalize prefix with slash', async () => {
        const mockBucket: any = {
            list: vi.fn().mockResolvedValue({ objects: [], truncated: false, cursor: undefined }),
            delete: vi.fn()
        };
        const service = new StorageService(mockBucket);
        await service.deleteDirectory('my-folder'); // No slash

        expect(mockBucket.list).toHaveBeenCalledWith({ prefix: 'my-folder/', limit: 1000, cursor: undefined });
    });

    it('should throw on root deletion', async () => {
        const service = new StorageService({} as any);
        await expect(service.deleteDirectory('/')).rejects.toThrow();
        await expect(service.deleteDirectory('')).rejects.toThrow();
    });
});
