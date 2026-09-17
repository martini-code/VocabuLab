import { DatabaseSync } from 'node:sqlite';

export default class Database {
  private _db: DatabaseSync;

  constructor(filename: string = ':memory:', _options?: any) {
    this._db = new DatabaseSync(filename);
  }

  exec(sql: string): this {
    this._db.exec(sql);
    return this;
  }

  prepare(sql: string) {
    const stmt = this._db.prepare(sql);
    return {
      run: (...params: any[]) => {
        const res = stmt.run(...params);
        return {
          changes: Number(res.changes),
          lastInsertRowid: Number(res.lastInsertRowid),
        };
      },
      get: (...params: any[]) => {
        const row = stmt.get(...params);
        return row ? { ...row } : undefined;
      },
      all: (...params: any[]) => {
        const rows = stmt.all(...params);
        return rows.map((r: any) => ({ ...r }));
      },
    };
  }

  close(): void {
    this._db.close();
  }
}
