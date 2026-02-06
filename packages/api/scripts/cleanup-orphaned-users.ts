#!/usr/bin/env node
/**
 * One-time cleanup script to remove orphaned users from the global users table.
 * 
 * This script identifies and removes users who:
 * 1. Have NO tenant memberships
 * 2. Are NOT platform admins
 * 
 * Usage:
 *   npx tsx scripts/cleanup-orphaned-users.ts --remote
 * 
 * Options:
 *   --remote: Run against remote D1 database (REQUIRED)
 *   --dry-run: Show what would be deleted without actually deleting
 */

import { execSync } from 'child_process';

const isDryRun = process.argv.includes('--dry-run');
const isRemote = process.argv.includes('--remote');
const DB_NAME = 'studio-platform-db';

function executeSQL(sql: string): any[] {
    const remoteFlag = isRemote ? '--remote' : '--local';
    const command = `npx wrangler d1 execute ${DB_NAME} ${remoteFlag} --command "${sql.replace(/"/g, '\\"')}"`;

    try {
        const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

        // Find the JSON output (starts with [)
        const lines = output.split('\n');
        const jsonStartIdx = lines.findIndex(line => line.trim() === '[');

        if (jsonStartIdx === -1) {
            console.error('No JSON found in output:', output);
            return [];
        }

        // Join all lines from [ to the end to get complete JSON
        const jsonText = lines.slice(jsonStartIdx).join('\n');
        const parsed = JSON.parse(jsonText);

        // Wrangler returns an array with one object containing results
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].results) {
            return parsed[0].results;
        }

        return [];
    } catch (error: any) {
        console.error('SQL Error:', error.message);
        throw error;
    }
}


async function cleanupOrphanedUsers() {
    console.log('🧹 Starting orphaned user cleanup...\n');
    console.log(`Mode: ${isDryRun ? '🔍 DRY RUN' : '⚠️  LIVE'}`);
    console.log(`Database: ${isRemote ? '☁️  REMOTE' : '💻 LOCAL'}\n`);

    if (!isRemote) {
        console.error('❌ Error: Must specify --remote');
        console.error('   This script only works with the remote database');
        process.exit(1);
    }

    // Step 1: Get all users
    console.log('📊 Fetching all users...');
    const allUsers = executeSQL('SELECT id, email, role, is_platform_admin FROM users');
    console.log(`   Found ${allUsers.length} total users\n`);

    // Step 2: Get all users who have tenant memberships
    console.log('🔗 Identifying users with tenant memberships...');
    const usersWithMemberships = executeSQL('SELECT DISTINCT user_id FROM tenant_members');
    const usersWithMembershipsSet = new Set(usersWithMemberships.map(r => r.user_id));
    console.log(`   Found ${usersWithMembershipsSet.size} users with active memberships\n`);

    // Step 3: Identify platform admins
    console.log('👑 Identifying platform administrators...');
    const platformAdmins = allUsers.filter(u =>
        u.is_platform_admin === 1 || u.role === 'admin' || u.role === 'owner'
    );
    const platformAdminIds = new Set(platformAdmins.map(a => a.id));
    console.log(`   Found ${platformAdminIds.size} platform admins:`);
    platformAdmins.forEach(admin => {
        console.log(`   - ${admin.email} (${admin.role || 'user'}${admin.is_platform_admin ? ', isPlatformAdmin=true' : ''})`);
    });
    console.log();

    // Step 4: Find orphaned users (no memberships AND not platform admin)
    const orphanedUsers = allUsers.filter(u =>
        !usersWithMembershipsSet.has(u.id) && !platformAdminIds.has(u.id)
    );

    console.log(`📋 Summary:`);
    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   Users with memberships: ${usersWithMembershipsSet.size}`);
    console.log(`   Platform admins: ${platformAdminIds.size}`);
    console.log(`   Orphaned users to delete: ${orphanedUsers.length}\n`);

    if (orphanedUsers.length === 0) {
        console.log('✅ No orphaned users found. Database is clean!');
        return;
    }

    // Show sample of orphaned users
    console.log('🗑️  Orphaned users (showing first 20):');
    orphanedUsers.slice(0, 20).forEach((user, idx) => {
        console.log(`   ${idx + 1}. ${user.email}`);
    });
    if (orphanedUsers.length > 20) {
        console.log(`   ... and ${orphanedUsers.length - 20} more\n`);
    } else {
        console.log();
    }

    if (isDryRun) {
        console.log('🔍 DRY RUN - No changes made');
        console.log(`   Would delete ${orphanedUsers.length} orphaned users\n`);

        // Show the SQL that would be executed
        const orphanedUserIds = orphanedUsers.map(u => `'${u.id}'`).join(', ');
        console.log('SQL commands that would be executed:');
        console.log(`1. DELETE FROM user_relationships WHERE parent_user_id IN (${orphanedUserIds.substring(0, 100)}...) OR child_user_id IN (...);`);
        console.log(`2. DELETE FROM users WHERE id IN (${orphanedUserIds.substring(0, 100)}...);`);
        return;
    }

    // Step 5: Delete orphaned users and their relationships
    const orphanedUserIds = orphanedUsers.map(u => `'${u.id}'`).join(', ');

    console.log('🔄 Deleting user relationships...');
    executeSQL(`DELETE FROM user_relationships WHERE parent_user_id IN (${orphanedUserIds}) OR child_user_id IN (${orphanedUserIds})`);
    console.log('   ✓ User relationships deleted\n');

    console.log('🗑️  Deleting orphaned users...');
    executeSQL(`DELETE FROM users WHERE id IN (${orphanedUserIds})`);
    console.log(`   ✓ Deleted ${orphanedUsers.length} users\n`);

    console.log('✅ Cleanup complete!');
    console.log(`   Removed ${orphanedUsers.length} orphaned users from the database`);
}

cleanupOrphanedUsers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    });
