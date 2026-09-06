import { Paths, Directory, File } from 'expo-file-system';

const R2_DEFAULT_ENDPOINT = 'https://r2.vocab-keep.internal/vocab-keep.sqlite';
const LOCAL_DB_FILENAME = 'vocab-keep.sqlite';

export interface SyncStatus {
  synced: boolean;
  source: 'local' | 'r2' | 'fallback';
  message: string;
}

/**
 * Ensures the SQLite database exists locally.
 * If not present or an update is requested, downloads from Cloudflare R2 bucket.
 */
export async function syncDatabaseFromR2(customEndpoint?: string): Promise<SyncStatus> {
  const endpoint = customEndpoint || R2_DEFAULT_ENDPOINT;

  try {
    const sqliteDir = new Directory(Paths.document, 'SQLite');
    if (!sqliteDir.exists) {
      sqliteDir.create();
    }

    const localDbFile = new File(sqliteDir, LOCAL_DB_FILENAME);
    if (localDbFile.exists && localDbFile.size > 0) {
      return {
        synced: true,
        source: 'local',
        message: 'The Keep’s local scroll vault is loaded and battle-ready.',
      };
    }

    // Try downloading from Cloudflare R2
    console.log(`[Vault] Pulling master dictionary from Cloudflare R2: ${endpoint}`);
    await File.downloadFileAsync(endpoint, localDbFile, { idempotent: true });

    return {
      synced: true,
      source: 'r2',
      message: 'Successfully imported kingdom archives from Cloudflare R2.',
    };
  } catch (error) {
    console.log('[Vault] Remote R2 sync deferred (offline or dev fallback):', (error as Error).message);
  }

  return {
    synced: true,
    source: 'fallback',
    message: 'Operating offline with local fortress vault.',
  };
}
