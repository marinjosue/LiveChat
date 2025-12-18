"use strict";

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const { z } = require("zod");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function dbQuery(text, params = []) {
  return pool.query(text, params);
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await fn(client);
    await client.query("COMMIT");
    return res;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

const USER_SORT_WHITELIST = new Map([
  ["id", "id"],
  ["email", "email"],
  ["role", "role"],
  ["createdAt", "created_at"],
]);

const ORDER_SORT_WHITELIST = new Map([
  ["id", "id"],
  ["userId", "user_id"],
  ["status", "status"],
  ["total", "total_amount"],
  ["createdAt", "created_at"],
]);

function safeSortColumn(sort, whitelist, fallback) {
  return whitelist.get(sort) || fallback;
}

function safeSortDir(dir) {
  return String(dir).toLowerCase() === "asc" ? "ASC" : "DESC";
}

function buildWhere(filters) {
  const where = [];
  const params = [];
  for (const f of filters) {
    params.push(f.value);
    const idx = params.length;
    where.push(f.clause.replace("$n", `$${idx}`));
  }
  return {
    whereSql: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

function getPagination(page, pageSize, maxSize = 100) {
  const p = Math.max(parseInt(page || "1", 10), 1);
  const ps = Math.min(Math.max(parseInt(pageSize || "20", 10), 1), maxSize);
  const offset = (p - 1) * ps;
  return { p, ps, offset };
}

const UserCreateSchema = z.object({
  email: z.string().email().max(254),
  role: z.enum(["user", "admin"]).default("user"),
  isActive: z.boolean().optional().default(true),
});

const UserPatchSchema = z.object({
  email: z.string().email().max(254).optional(),
  role: z.enum(["user", "admin"]).optional(),
  isActive: z.boolean().optional(),
});

const OrderCreateSchema = z.object({
  userId: z.number().int().positive(),
  status: z.enum(["PENDING", "PAID", "CANCELLED"]).default("PENDING"),
  totalAmount: z.number().nonnegative(),
  items: z.array(
    z.object({
      sku: z.string().min(1).max(64),
      qty: z.number().int().positive(),
      price: z.number().nonnegative(),
    })
  ).min(1),
});

async function initDb() {
  await dbQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id),
      status TEXT NOT NULL,
      total_amount NUMERIC(12,2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      sku TEXT NOT NULL,
      qty INT NOT NULL,
      price NUMERIC(12,2) NOT NULL
    );
  `);
}

const UsersRepo = {
  async create({ email, role, isActive }) {
    const q = `
      INSERT INTO users (email, role, is_active)
      VALUES ($1, $2, $3)
      RETURNING id, email, role, is_active AS "isActive", created_at AS "createdAt";
    `;
    const { rows } = await dbQuery(q, [email, role, isActive]);
    return rows[0];
  },

  async getById(id) {
    const q = `
      SELECT id, email, role, is_active AS "isActive", created_at AS "createdAt"
      FROM users WHERE id = $1;
    `;
    const { rows } = await dbQuery(q, [id]);
    return rows[0] || null;
  },

  async list({ search, role, isActive, sort, dir, page, pageSize }) {
    const filters = [];
    if (search) filters.push({ clause: "email ILIKE $n", value: `%${search}%` });
    if (role) filters.push({ clause: "role = $n", value: role });
    if (typeof isActive !== "undefined") filters.push({ clause: "is_active = $n", value: isActive });

    const { whereSql, params } = buildWhere(filters);
    const { ps, offset } = getPagination(page, pageSize);
    const sortCol = safeSortColumn(sort, USER_SORT_WHITELIST, "id");
    const sortDir = safeSortDir(dir);

    const q = `
      SELECT id, email, role, is_active AS "isActive", created_at AS "createdAt"
      FROM users
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const { rows } = await dbQuery(q, [...params, ps, offset]);
    return rows;
  },

  async patch(id, patch) {
    const allowed = new Map([
      ["email", "email"],
      ["role", "role"],
      ["isActive", "is_active"],
    ]);

    const sets = [];
    const params = [];
    for (const [k, v] of Object.entries(patch)) {
      if (!allowed.has(k)) continue;
      params.push(v);
      sets.push(`${allowed.get(k)} = $${params.length}`);
    }
    if (!sets.length) return null;

    params.push(id);
    const q = `
      UPDATE users SET ${sets.join(", ")}
      WHERE id = $${params.length}
      RETURNING id, email, role, is_active AS "isActive", created_at AS "createdAt";
    `;
    const { rows } = await dbQuery(q, params);
    return rows[0] || null;
  },

  async remove(id) {
    const q = `DELETE FROM users WHERE id = $1 RETURNING id;`;
    const { rows } = await dbQuery(q, [id]);
    return rows[0] || null;
  },
};

const OrdersRepo = {
  async create({ userId, status, totalAmount, items }) {
    return withTx(async (client) => {
      const u = await client.query(`SELECT id FROM users WHERE id = $1;`, [userId]);
      if (!u.rows.length) throw new Error("USER_NOT_FOUND");

      const orderRes = await client.query(
        `
        INSERT INTO orders (user_id, status, total_amount)
        VALUES ($1, $2, $3)
        RETURNING id, user_id AS "userId", status, total_amount AS "totalAmount", created_at AS "createdAt";
        `,
        [userId, status, totalAmount]
      );

      const order = orderRes.rows[0];
      const skus = items.map((i) => i.sku);
      const qtys = items.map((i) => i.qty);
      const prices = items.map((i) => i.price);

      await client.query(
        `
        INSERT INTO order_items (order_id, sku, qty, price)
        SELECT $1, t.sku, t.qty, t.price
        FROM UNNEST($2::text[], $3::int[], $4::numeric[]) AS t(sku, qty, price);
        `,
        [order.id, skus, qtys, prices]
      );

      return order;
    });
  },

  async getById(id) {
    const o = await dbQuery(
      `
      SELECT id, user_id AS "userId", status, total_amount AS "totalAmount", created_at AS "createdAt"
      FROM orders WHERE id = $1;
      `,
      [id]
    );
    if (!o.rows.length) return null;

    const items = await dbQuery(
      `SELECT id, order_id AS "orderId", sku, qty, price FROM order_items WHERE order_id = $1;`,
      [id]
    );

    return { ...o.rows[0], items: items.rows };
  },

  async list({ userId, status, from, to, sort, dir, page, pageSize }) {
    const filters = [];
    if (userId) filters.push({ clause: "user_id = $n", value: userId });
    if (status) filters.push({ clause: "status = $n", value: status });
    if (from) filters.push({ clause: "created_at >= $n", value: new Date(from) });
    if (to) filters.push({ clause: "created_at <= $n", value: new Date(to) });

    const { whereSql, params } = buildWhere(filters);
    const { ps, offset } = getPagination(page, pageSize);
    const sortCol = safeSortColumn(sort, ORDER_SORT_WHITELIST, "id");
    const sortDir = safeSortDir(dir);

    const q = `
      SELECT id, user_id AS "userId", status, total_amount AS "totalAmount", created_at AS "createdAt"
      FROM orders
      ${whereSql}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const { rows } = await dbQuery(q, [...params, ps, offset]);
    return rows;
  },
};

const app = express();
app.use(express.json());
app.use(helmet());
app.use(rateLimit({ windowMs: 60000, limit: 120 }));

app.post("/users", async (req, res) => {
  try {
    const data = UserCreateSchema.parse(req.body);
    const u = await UsersRepo.create(data);
    res.status(201).json(u);
  } catch (e) {
    res.status(400).json({ error: "ERROR" });
  }
});

app.get("/users", async (req, res) => {
  const users = await UsersRepo.list(req.query);
  res.json(users);
});

app.get("/users/:id", async (req, res) => {
  const u = await UsersRepo.getById(Number(req.params.id));
  if (!u) return res.sendStatus(404);
  res.json(u);
});

app.patch("/users/:id", async (req, res) => {
  try {
    const patch = UserPatchSchema.parse(req.body);
    const u = await UsersRepo.patch(Number(req.params.id), patch);
    if (!u) return res.sendStatus(404);
    res.json(u);
  } catch {
    res.status(400).json({ error: "ERROR" });
  }
});

app.delete("/users/:id", async (req, res) => {
  const ok = await UsersRepo.remove(Number(req.params.id));
  if (!ok) return res.sendStatus(404);
  res.sendStatus(204);
});

app.post("/orders", async (req, res) => {
  try {
    const data = OrderCreateSchema.parse(req.body);
    const o = await OrdersRepo.create(data);
    res.status(201).json(o);
  } catch {
    res.status(400).json({ error: "ERROR" });
  }
});

app.get("/orders", async (req, res) => {
  const orders = await OrdersRepo.list(req.query);
  res.json(orders);
});

app.get("/orders/:id", async (req, res) => {
  const o = await OrdersRepo.getById(Number(req.params.id));
  if (!o) return res.sendStatus(404);
  res.json(o);
});

(async () => {
  await initDb();
  app.listen(process.env.PORT || 3000);
})();
