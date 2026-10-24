/**
 * In-memory SQLite database mock for deterministic, lightning-fast Node.js test execution
 * matching the exact API of expo-sqlite (openDatabaseAsync, execAsync, runAsync, getAllAsync, getFirstAsync).
 */

function splitSqlClauses(input: string): string[] {
  const result: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (char === ',' && !inSingleQuote && !inDoubleQuote) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    result.push(current.trim());
  }
  return result;
}

export class MockSQLiteDatabase {
  public tables: Record<string, any[]> = {};
  public migrations: { version: number; name: string; applied_at: string }[] = [];

  constructor() {
    this.tables['order_drafts'] = [];
    this.tables['pending_photos'] = [];
    this.tables['schema_migrations'] = [];
  }

  async execAsync(sql: string): Promise<void> {
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const stmt of statements) {
      const lower = stmt.toLowerCase();
      if (lower.startsWith('create table')) {
        const match = stmt.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_]+)/i);
        if (match && match[1]) {
          const tableName = match[1];
          if (!this.tables[tableName]) {
            this.tables[tableName] = [];
          }
        }
      } else if (lower.startsWith('alter table')) {
        const match = stmt.match(
          /alter\s+table\s+([a-zA-Z0-9_]+)\s+add\s+column\s+([a-zA-Z0-9_]+)/i,
        );
        if (match && match[1] && match[2]) {
          const tableName = match[1];
          const colName = match[2];
          if (this.tables[tableName]) {
            for (const row of this.tables[tableName]) {
              if (row[colName] === undefined) {
                row[colName] = null;
              }
            }
          }
        }
      }
    }
  }

  async runAsync(
    sql: string,
    params: any[] = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    const trimmed = sql.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('insert into')) {
      const match = trimmed.match(
        /insert\s+into\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*values\s*\((.+)\)/is,
      );
      if (match) {
        const tableName = match[1];
        const cols = splitSqlClauses(match[2]);
        const rawVals = splitSqlClauses(match[3]);

        const row: any = {};
        let paramIdx = 0;

        cols.forEach((col, idx) => {
          const valExpr = rawVals[idx];
          if (valExpr === '?') {
            row[col] = params[paramIdx++] !== undefined ? params[paramIdx - 1] : null;
          } else if (valExpr.startsWith("'") && valExpr.endsWith("'")) {
            row[col] = valExpr.slice(1, -1);
          } else if (!isNaN(Number(valExpr))) {
            row[col] = Number(valExpr);
          } else if (valExpr.toUpperCase() === 'NULL') {
            row[col] = null;
          } else {
            row[col] = valExpr;
          }
        });

        if (!this.tables[tableName]) {
          this.tables[tableName] = [];
        }
        this.tables[tableName].push(row);
        return { lastInsertRowId: this.tables[tableName].length, changes: 1 };
      }
    } else if (lower.startsWith('update')) {
      const match = trimmed.match(/update\s+([a-zA-Z0-9_]+)\s+set\s+(.+)\s+where\s+(.+)/is);
      if (match) {
        const tableName = match[1];
        const setPart = match[2];
        const wherePart = match[3];

        const rows = this.tables[tableName] || [];
        let changes = 0;

        const setClauses = splitSqlClauses(setPart);

        // Identify WHERE filter
        const whereColMatch = wherePart.match(/([a-zA-Z0-9_]+)\s*=\s*\?/i);
        const whereCol = whereColMatch ? whereColMatch[1] : null;
        const whereVal = whereCol ? params[params.length - 1] : null;

        for (const row of rows) {
          if (!whereCol || row[whereCol] === whereVal) {
            let paramIdx = 0;
            for (const clause of setClauses) {
              if (clause.includes('retry_count = retry_count + 1')) {
                row['retry_count'] = (Number(row['retry_count']) || 0) + 1;
              } else {
                const parts = clause.split('=').map((p) => p.trim());
                const col = parts[0];
                const rhs = parts.slice(1).join('=').trim();

                if (rhs === '?') {
                  row[col] = params[paramIdx++];
                } else if (rhs.startsWith("'") && rhs.endsWith("'")) {
                  row[col] = rhs.slice(1, -1);
                } else if (!isNaN(Number(rhs))) {
                  row[col] = Number(rhs);
                } else if (rhs.toUpperCase() === 'NULL') {
                  row[col] = null;
                }
              }
            }
            changes++;
          }
        }
        return { lastInsertRowId: 0, changes };
      }
    } else if (lower.startsWith('delete from')) {
      const match = trimmed.match(
        /delete\s+from\s+([a-zA-Z0-9_]+)\s+where\s+([a-zA-Z0-9_]+)\s*=\s*\?/i,
      );
      if (match) {
        const tableName = match[1];
        const whereCol = match[2];
        const whereVal = params[0];

        const rows = this.tables[tableName] || [];
        const initialLen = rows.length;
        this.tables[tableName] = rows.filter((r) => r[whereCol] !== whereVal);
        return { lastInsertRowId: 0, changes: initialLen - this.tables[tableName].length };
      }
    }

    return { lastInsertRowId: 0, changes: 0 };
  }

  async getAllAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
    const trimmed = sql.trim();
    const lower = trimmed.toLowerCase();

    if (lower.startsWith('select')) {
      const match = trimmed.match(/select\s+(.+)\s+from\s+([a-zA-Z0-9_]+)(?:\s+where\s+(.+))?/is);
      if (match) {
        const tableName = match[2];
        const whereClause = match[3];
        const rows = this.tables[tableName] || [];

        if (!whereClause) {
          return rows.map((r) => ({ ...r })) as T[];
        }

        return rows
          .filter((row) => {
            if (whereClause.includes('client_draft_id = ?')) {
              return row.client_draft_id === params[0];
            }
            if (whereClause.includes('id = ?')) {
              return row.id === params[0];
            }
            if (whereClause.includes('server_order_id IS NOT NULL')) {
              const hasOrder = Boolean(row.server_order_id && row.server_order_id !== '');
              if (whereClause.includes("sync_status IN ('PENDING', 'FAILED')")) {
                return hasOrder && (row.sync_status === 'PENDING' || row.sync_status === 'FAILED');
              }
              return hasOrder;
            }
            if (whereClause.includes('sync_status = ?')) {
              return row.sync_status === params[0];
            }
            if (whereClause.includes('store_id = ?')) {
              return row.store_id === params[0];
            }
            return true;
          })
          .map((r) => ({ ...r })) as T[];
      }
    }
    return [];
  }

  async getFirstAsync<T>(sql: string, params: any[] = []): Promise<T | null> {
    const rows = await this.getAllAsync<T>(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }
}
