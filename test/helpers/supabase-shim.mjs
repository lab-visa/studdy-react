/**
 * Test-only, minimal stand-in for the @supabase/supabase-js client,
 * translating the small subset of its chainable query builder actually
 * used by this repo's api/*.js and api/_lib/*.js files into real SQL run
 * against the local test Postgres schema (via the `pg` Pool from
 * test/helpers/db.mjs).
 *
 * Why this exists rather than mocking supabase-js itself: it lets tests
 * exercise the ACTUAL production handler/lib functions unmodified,
 * against a real Postgres database enforcing the real constraints
 * (unique indexes, foreign keys) — including true concurrency tests —
 * without needing a full local Supabase/PostgREST stack. Deliberately
 * scoped to exactly the method calls this codebase uses, not a general
 * PostgREST reimplementation.
 *
 * Error shape matches supabase-js closely enough for this codebase's own
 * error handling: `{ data, error }`, with `error.code` carrying the raw
 * Postgres SQLSTATE (e.g. '23505' for a unique violation) — the exact
 * value every 23505-check in this codebase already relies on.
 */

class QueryBuilder {
  constructor(pool, table) {
    this.pool = pool;
    this.table = table;
    this.mode = 'select';
    this.filters = [];
    this.insertObj = null;
    this.updateObj = null;
    this.singleMode = null;
    this.limitN = null;
    this.orderCol = null;
    this.orderAscending = true;
  }

  select() {
    return this;
  }

  insert(obj) {
    this.mode = 'insert';
    this.insertObj = obj;
    return this;
  }

  update(obj) {
    this.mode = 'update';
    this.updateObj = obj;
    return this;
  }

  eq(col, val) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  in(col, vals) {
    this.filters.push({ type: 'in', col, val: vals });
    return this;
  }

  not(col, op, val) {
    this.filters.push({ type: 'not', col, op, val });
    return this;
  }

  is(col, val) {
    this.filters.push({ type: 'is', col, val });
    return this;
  }

  lt(col, val) {
    this.filters.push({ type: 'lt', col, val });
    return this;
  }

  order(col, opts = {}) {
    this.orderCol = col;
    this.orderAscending = opts.ascending !== false;
    return this;
  }

  limit(n) {
    this.limitN = n;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  _buildWhere(startIdx) {
    const clauses = [];
    const params = [];
    let idx = startIdx;
    for (const f of this.filters) {
      if (f.type === 'eq') {
        clauses.push(`"${f.col}" = $${idx}`);
        params.push(f.val);
        idx++;
      } else if (f.type === 'in') {
        clauses.push(`"${f.col}" = ANY($${idx}::text[])`);
        params.push(f.val);
        idx++;
      } else if (f.type === 'not') {
        if (f.op === 'is' && f.val === null) {
          clauses.push(`"${f.col}" IS NOT NULL`);
        } else {
          throw new Error(`supabase-shim: unsupported not() usage: ${f.op}`);
        }
      } else if (f.type === 'is') {
        if (f.val === null) {
          clauses.push(`"${f.col}" IS NULL`);
        } else {
          clauses.push(`"${f.col}" = $${idx}`);
          params.push(f.val);
          idx++;
        }
      } else if (f.type === 'lt') {
        clauses.push(`"${f.col}" < $${idx}`);
        params.push(f.val);
        idx++;
      }
    }
    return { clauseSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params, nextIdx: idx };
  }

  async _execute() {
    try {
      if (this.mode === 'select') {
        const { clauseSql, params } = this._buildWhere(1);
        let sql = `SELECT * FROM "${this.table}" ${clauseSql}`;
        if (this.orderCol) sql += ` ORDER BY "${this.orderCol}" ${this.orderAscending ? 'ASC' : 'DESC'}`;
        if (this.limitN) sql += ` LIMIT ${Number(this.limitN)}`;
        const res = await this.pool.query(sql, params);
        return this._shapeResult(res.rows);
      }
      if (this.mode === 'insert') {
        const cols = Object.keys(this.insertObj);
        const vals = cols.map((c) => this.insertObj[c]);
        const placeholders = cols.map((_, i) => `$${i + 1}`);
        const colList = cols.map((c) => `"${c}"`).join(', ');
        const sql = `INSERT INTO "${this.table}" (${colList}) VALUES (${placeholders.join(', ')}) RETURNING *`;
        const res = await this.pool.query(sql, vals);
        return this._shapeResult(res.rows);
      }
      if (this.mode === 'update') {
        const cols = Object.keys(this.updateObj);
        const setParts = cols.map((c, i) => `"${c}" = $${i + 1}`);
        const setVals = cols.map((c) => this.updateObj[c]);
        const { clauseSql, params: whereParams } = this._buildWhere(cols.length + 1);
        const sql = `UPDATE "${this.table}" SET ${setParts.join(', ')} ${clauseSql} RETURNING *`;
        const res = await this.pool.query(sql, [...setVals, ...whereParams]);
        return this._shapeResult(res.rows);
      }
      throw new Error(`supabase-shim: unknown mode ${this.mode}`);
    } catch (err) {
      return { data: null, error: { message: err.message, code: err.code } };
    }
  }

  _shapeResult(rows) {
    if (this.singleMode === 'maybeSingle') {
      return { data: rows.length ? rows[0] : null, error: null };
    }
    if (this.singleMode === 'single') {
      if (rows.length !== 1) return { data: null, error: { message: 'expected exactly one row' } };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null };
  }

  then(onFulfilled, onRejected) {
    return this._execute().then(onFulfilled, onRejected);
  }

  catch(onRejected) {
    return this._execute().catch(onRejected);
  }
}

export function createTestSupabaseClient(pool) {
  return {
    from(table) {
      return new QueryBuilder(pool, table);
    },
    /** Minimal stand-in for supabase-js's .rpc(name, namedParams) — used
     * by api/track-event.js to call increment_site_traffic(...). Uses
     * Postgres named-argument call notation so param order doesn't
     * matter, matching supabase-js's own object-based calling
     * convention. */
    async rpc(fnName, params = {}) {
      try {
        const keys = Object.keys(params);
        const argSql = keys.map((k, i) => `${k} := $${i + 1}`).join(', ');
        const values = keys.map((k) => params[k]);
        await pool.query(`SELECT ${fnName}(${argSql})`, values);
        return { data: null, error: null };
      } catch (err) {
        return { data: null, error: { message: err.message, code: err.code } };
      }
    },
  };
}
