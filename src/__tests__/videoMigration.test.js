/**
 * Legacy Video -> Canonical Post Migration & Rollback Contract Tests.
 *
 * Verifies:
 *  - Admin authorization (`assertAdmin`) and server audit trail (`writeAudit`)
 *    on both `migrateLegacyVideosToPosts` and `rollbackLegacyVideoMigration`.
 *  - Idempotent `video_migration_map` guard, checkpoint cursor progression & reset,
 *    dry-run non-mutating behavior, and structural preservation (no coin/XP/notification writes).
 *  - Client admin UI wiring in `AdminSystemHealthScreen.jsx` via `callableService.js`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const migrationSrc = read('functions/videoMigration.js');
const callableSrc = read('src/services/callableService.js');
const adminHealthSrc = read('src/screens/Admin/AdminSystemHealthScreen.jsx');
const functionsIndexSrc = read('functions/index.js');

describe('videoMigration.js server safety & resumability', () => {
  test('enforces assertAdmin and writeAudit on migrateLegacyVideosToPosts and rollbackLegacyVideoMigration', () => {
    const migrateBlock = migrationSrc.slice(
      migrationSrc.indexOf('exports.migrateLegacyVideosToPosts'),
      migrationSrc.indexOf('exports.rollbackLegacyVideoMigration'),
    );
    const rollbackBlock = migrationSrc.slice(
      migrationSrc.indexOf('exports.rollbackLegacyVideoMigration'),
    );

    expect(migrateBlock).toContain('await assertAdmin(context)');
    expect(migrateBlock).toContain("await writeAudit(");
    expect(migrateBlock).toContain("'migrate_legacy_videos_to_posts'");
    expect(migrateBlock).toContain('dryRun');
    expect(migrateBlock).toContain('resetCursor');
    expect(migrateBlock).toContain("db.collection('migration_checkpoints')");

    expect(rollbackBlock).toContain('await assertAdmin(context)');
    expect(rollbackBlock).toContain("await writeAudit(");
    expect(rollbackBlock).toContain("'rollback_legacy_video_migration'");
    expect(rollbackBlock).toContain("db.collection('video_migration_map')");
  });

  test('preserves original stats/timestamps idempotently and never writes coins, XP, or notifications', () => {
    expect(migrationSrc).toContain("db.collection('video_migration_map').doc(legacyId)");
    expect(migrationSrc).toContain("status: 'already_migrated'");
    expect(migrationSrc).toContain("status: 'would_migrate'");
    expect(migrationSrc).toContain('copySubcollectionPaged(videoDoc.ref, postRef, \'likes\'');
    expect(migrationSrc).toContain('copySubcollectionPaged(videoDoc.ref, postRef, \'saved_by\'');
    expect(migrationSrc).toContain('copySubcollectionPaged(videoDoc.ref, postRef, \'viewers\'');

    // Structural migration must never grant rewards or send notifications
    expect(migrationSrc).not.toContain('awardXp');
    expect(migrationSrc).not.toContain('addCoins');
    expect(migrationSrc).not.toContain('writeNotification');
    expect(migrationSrc).not.toContain('enqueuePush');
  });

  test('exports both migration callables from functions/index.js via merge', () => {
    expect(functionsIndexSrc).toContain("merge(require('./videoMigration.js'))");
    expect(migrationSrc).toContain('exports.migrateLegacyVideosToPosts =');
    expect(migrationSrc).toContain('exports.rollbackLegacyVideoMigration =');
  });
});

describe('AdminSystemHealthScreen legacy video migration UI wiring', () => {
  test('registers and calls MIGRATE_LEGACY_VIDEOS_TO_POSTS and ROLLBACK_LEGACY_VIDEO_MIGRATION via callableService', () => {
    expect(callableSrc).toContain("MIGRATE_LEGACY_VIDEOS_TO_POSTS: 'migrateLegacyVideosToPosts'");
    expect(callableSrc).toContain("ROLLBACK_LEGACY_VIDEO_MIGRATION: 'rollbackLegacyVideoMigration'");

    expect(adminHealthSrc).toContain('FUNCTIONS.MIGRATE_LEGACY_VIDEOS_TO_POSTS');
    expect(adminHealthSrc).toContain('FUNCTIONS.ROLLBACK_LEGACY_VIDEO_MIGRATION');
    expect(adminHealthSrc).toContain('runVideoMigration(true)');
    expect(adminHealthSrc).toContain('runVideoMigration(false)');
    expect(adminHealthSrc).toContain('runVideoMigrationRollback');
  });
});
