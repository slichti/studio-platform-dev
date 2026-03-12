import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { sendBackupAlert } from './backup-alert';

const DB_NAME = 'studio-platform-db';
const BACKUP_RETENTION_DAYS = 90;

interface Env {
    R2: any; // R2Bucket type from @cloudflare/workers-types
    /** Optional: Slack incoming webhook or PagerDuty etc. POST URL; on backup failure we send a JSON payload. */
    BACKUP_ALERT_WEBHOOK_URL?: string;
}

/**
 * Automated Database Backup Script
 * 
 * Exports D1 database to SQL and uploads to R2 for disaster recovery.
 * Retention: 90 days
 * Schedule: Daily at 2 AM UTC (via cron)
 */
export async function backupDatabase(env: Env, isLocal: boolean = false): Promise<void> {
    try {
        const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const filename = `backup-${timestamp}.sql`;
        const localPath = path.join('/tmp', filename);

        console.log(`📦 Starting database backup: ${filename}`);
        console.log(`   Mode: ${isLocal ? 'LOCAL' : 'REMOTE'}`);

        // Step 1: Export D1 database to SQL file
        console.log('⏳ Exporting database...');
        const exportCommand = `npx wrangler d1 export ${DB_NAME} ${isLocal ? '--local' : '--remote'} --output ${localPath}`;

        execSync(exportCommand, {
            encoding: 'utf-8',
            stdio: 'pipe'
        });

        console.log(`   ✓ Database exported to ${localPath}`);

        // Step 2: Read file and upload to R2
        console.log('☁️  Uploading to R2...');
        const fileContent = fs.readFileSync(localPath);
        const sizeBytes = fileContent.byteLength;

        await env.R2.put(`backups/${filename}`, fileContent, {
            customMetadata: {
                createdAt: new Date().toISOString(),
                sizeBytes: String(sizeBytes),
                databaseName: DB_NAME,
                mode: isLocal ? 'local' : 'remote'
            }
        });

        console.log(`   ✓ Uploaded to R2: backups/${filename} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);

        // Step 3: Clean up local file
        fs.unlinkSync(localPath);

        // Step 4: Clean up old backups (keep only last 90 days)
        if (!isLocal) {
            console.log('🧹 Cleaning up old backups...');
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);

            const list = await env.R2.list({ prefix: 'backups/' });
            let deletedCount = 0;

            for (const object of list.objects) {
                const uploadDate = new Date(object.uploaded);
                if (uploadDate < cutoffDate) {
                    await env.R2.delete(object.key);
                    console.log(`   Deleted old backup: ${object.key}`);
                    deletedCount++;
                }
            }

            if (deletedCount === 0) {
                console.log('   No old backups to delete');
            } else {
                console.log(`   ✓ Deleted ${deletedCount} old backup(s)`);
            }
        }

        console.log(`✅ Backup completed successfully: ${filename}`);
    } catch (error: any) {
        console.error('❌ Backup failed:', error.message);
        if (error.stdout) console.error('stdout:', error.stdout.toString());
        if (error.stderr) console.error('stderr:', error.stderr.toString());

        await sendBackupAlert(env, 'failure', `🚨 Database backup failed: ${error.message}`, {
            error: error.message,
            databaseName: DB_NAME,
        });
        throw error;
    }
}
