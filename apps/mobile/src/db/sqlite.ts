import type * as SQLite from 'expo-sqlite';

const DB_NAME = 'growfast_mobile.db';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'create_order_drafts_table',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS order_drafts (
          id TEXT PRIMARY KEY,
          client_draft_id TEXT UNIQUE NOT NULL,
          store_id TEXT NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          payload_json TEXT NOT NULL,
          sync_status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, PENDING_SYNC, SYNCED, FAILED
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_order_drafts_store ON order_drafts(store_id);
        CREATE INDEX IF NOT EXISTS idx_order_drafts_sync ON order_drafts(sync_status);
      `);
    },
  },
  {
    version: 2,
    name: 'create_pending_photos_table',
    up: async (db: SQLite.SQLiteDatabase) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_photos (
          id TEXT PRIMARY KEY,
          client_draft_id TEXT NOT NULL,
          garment_id TEXT,
          unit_number INTEGER,
          local_file_uri TEXT NOT NULL,
          photo_type TEXT NOT NULL DEFAULT 'FRONT',
          sync_status TEXT NOT NULL DEFAULT 'PENDING',
          created_at TEXT NOT NULL,
          FOREIGN KEY (client_draft_id) REFERENCES order_drafts(client_draft_id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_pending_photos_draft ON pending_photos(client_draft_id);
      `);
    },
  },
  {
    version: 3,
    name: 'extend_drafts_and_photos_for_sync',
    up: async (db: SQLite.SQLiteDatabase) => {
      // Helper to safely add column if not exists
      const addColumn = async (table: string, colDef: string) => {
        try {
          await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
        } catch {
          // Column may already exist in development snapshots
        }
      };

      // Extend order_drafts
      await addColumn('order_drafts', 'server_order_id TEXT');
      await addColumn('order_drafts', 'server_order_number TEXT');
      await addColumn('order_drafts', 'retry_count INTEGER NOT NULL DEFAULT 0');
      await addColumn('order_drafts', 'last_sync_attempt_at TEXT');
      await addColumn('order_drafts', 'last_error TEXT');
      await addColumn('order_drafts', 'conflict_details TEXT');
      await addColumn('order_drafts', 'workflow_type TEXT');
      await addColumn('order_drafts', "pickup_type TEXT DEFAULT 'STORE_PICKUP'");
      await addColumn('order_drafts', 'is_express INTEGER NOT NULL DEFAULT 0');
      await addColumn('order_drafts', 'notes TEXT');

      // Extend pending_photos
      await addColumn('pending_photos', 'server_photo_id TEXT');
      await addColumn('pending_photos', 'server_order_id TEXT');
      await addColumn('pending_photos', 'retry_count INTEGER NOT NULL DEFAULT 0');
      await addColumn('pending_photos', 'last_error TEXT');
      await addColumn('pending_photos', 'file_size INTEGER');
      await addColumn('pending_photos', 'mime_type TEXT');
      await addColumn('pending_photos', 'updated_at TEXT');

      // Add indexes for efficient queries
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_order_drafts_server_order ON order_drafts(server_order_id);
        CREATE INDEX IF NOT EXISTS idx_pending_photos_server_order ON pending_photos(server_order_id);
      `);
    },
  },
  {
    version: 4,
    name: 'add_piece_id_to_pending_photos',
    up: async (db: SQLite.SQLiteDatabase) => {
      const addColumn = async (table: string, colDef: string) => {
        try {
          await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${colDef};`);
        } catch {
          // Column may already exist in development snapshots
        }
      };

      await addColumn('pending_photos', 'piece_id TEXT');
      await addColumn('pending_photos', 'order_item_id TEXT');

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_pending_photos_piece ON pending_photos(piece_id);
      `);
    },
  },
];

export { MIGRATIONS };

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function setDatabaseInstance(db: SQLite.SQLiteDatabase | null): void {
  dbInstance = db;
}

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQLiteModule = await import('expo-sqlite');
  const db = await SQLiteModule.openDatabaseAsync(DB_NAME);

  // Initialize migrations tracking table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Fetch applied versions
  const rows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
  );
  const appliedVersions = new Set(rows.map((r) => r.version));

  // Run pending migrations in sequence
  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      await migration.up(db);
      await db.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [migration.version, migration.name, new Date().toISOString()],
      );
    }
  }

  dbInstance = db;
  return db;
}
