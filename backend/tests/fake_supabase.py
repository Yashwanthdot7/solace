"""A tiny in-memory stand-in for the Supabase Python client.

It supports only the query-builder calls that server.py uses:
    table(name).select(cols, count=...).eq().gte().lt().order().limit().execute()
    table(name).insert(row).execute()
    table(name).update(values).eq().execute()
    table(name).delete().eq().execute()

That lets the tests run with no internet and no real database.
"""
import copy


class _Result:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Query:
    def __init__(self, db, table):
        self._db = db
        self._table = table
        self._op = "select"
        self._payload = None
        self._filters = []
        self._order = None
        self._limit = None
        self._count = None
        self._cols = "*"

    # ── operations ──
    def select(self, cols="*", count=None):
        self._op, self._cols, self._count = "select", cols, count
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    # ── filters ──
    def eq(self, field, value):
        self._filters.append(lambda r: r.get(field) == value)
        return self

    def neq(self, field, value):
        self._filters.append(lambda r: r.get(field) != value)
        return self

    def gte(self, field, value):
        self._filters.append(lambda r: r.get(field) is not None and str(r.get(field)) >= str(value))
        return self

    def lt(self, field, value):
        self._filters.append(lambda r: r.get(field) is not None and str(r.get(field)) < str(value))
        return self

    def in_(self, field, values):
        values = list(values)
        self._filters.append(lambda r: r.get(field) in values)
        return self

    def order(self, field, desc=False):
        self._order = (field, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    # ── run ──
    def _rows(self):
        return self._db.tables.setdefault(self._table, [])

    def _match(self, row):
        return all(f(row) for f in self._filters)

    def execute(self):
        rows = self._rows()
        if self._op == "insert":
            new = self._payload if isinstance(self._payload, list) else [self._payload]
            for r in new:
                self._db.check_unique(self._table, r)
                rows.append(copy.deepcopy(r))
            return _Result(copy.deepcopy(new))
        if self._op == "update":
            hit = [r for r in rows if self._match(r)]
            for r in hit:
                r.update(copy.deepcopy(self._payload))
            return _Result(copy.deepcopy(hit))
        if self._op == "delete":
            hit = [r for r in rows if self._match(r)]
            self._db.tables[self._table] = [r for r in rows if not self._match(r)]
            return _Result(copy.deepcopy(hit))
        # select
        hit = [r for r in rows if self._match(r)]
        if self._order:
            field, desc = self._order
            hit = sorted(hit, key=lambda r: str(r.get(field) or ""), reverse=desc)
        total = len(hit)
        if self._limit is not None:
            hit = hit[: self._limit]
        if self._cols and self._cols != "*":
            keep = [c.strip() for c in self._cols.split(",")]
            hit = [{k: r.get(k) for k in keep} for r in hit]
        return _Result(copy.deepcopy(hit), total if self._count else None)


class FakeSupabase:
    # (table, column) pairs that must be unique, like the real schema.
    UNIQUE = {("users", "email"), ("users", "id"), ("otps", "email")}

    def __init__(self):
        self.tables = {}

    def table(self, name):
        return _Query(self, name)

    def check_unique(self, table, row):
        for t, col in self.UNIQUE:
            if t == table and col in row:
                if any(r.get(col) == row[col] for r in self.tables.get(table, [])):
                    raise Exception(f"duplicate key value violates unique constraint {table}.{col}")

    def reset(self):
        self.tables = {}
