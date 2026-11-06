# Marketly — Online Marketplace Web Application

A full-stack online marketplace built for the Web Technology assignment, with
role-based access for **Customers, Sellers, and Admins**.

**Stack:** HTML/CSS + JavaScript (DOM) on the front end · AJAX/Fetch to REST
APIs · Node.js + Express backend · MySQL database.

## Features

**Customer** — register/login, browse & search products, filter by category,
view product details & reviews, add to cart, checkout, view and cancel orders,
leave reviews, update profile.

**Seller** — register (pending admin approval), add/update/delete own products,
manage stock, view orders containing their products, update order status, view
a sales report.

**Admin** — manage customers and sellers (search, block/unblock, approve/reject
sellers), manage products and categories, view marketplace reports, and view a
system activity log.

> The spec's fourth role, **Super Admin**, exists in the database schema (the
> `role` enum plus the `admin_permissions` and `system_logs` tables) so the
> four-role requirement is met, but its dedicated screens/endpoints are out of
> scope for this build.

## Project structure

```
.
├── backend/
│   ├── server.js          # Express app: mounts routes, serves the frontend
│   ├── db.js              # MySQL connection pool (reads .env)
│   ├── log.js             # system_logs activity helper
│   ├── middleware/auth.js # header-based authenticate + role authorize
│   └── routes/            # auth, products, categories, cart, orders, reviews, admin
├── database/
│   ├── schema.sql         # 11 tables with keys + constraints
│   └── seed.sql           # sample accounts, categories, products
├── *.html                 # the frontend pages
└── js/session.js          # shared client-side session helper
```

## Setup & run

**Prerequisites:** Node.js and MySQL installed and running.

1. **Install dependencies**
   ```
   npm install
   ```
2. **Create the database** (loads the schema, then the sample data)
   ```
   mysql -u root -p < database/schema.sql
   mysql -u root -p < database/seed.sql
   ```
   On Windows PowerShell, wrap each in `cmd /c "..."` because PowerShell has no `<` redirect.
3. **Configure your DB password** — create a `.env` file in the project root:
   ```
   DB_PASSWORD=your_mysql_password
   ```
   (`.env` is gitignored. Host/user/db default to localhost/root/online_marketplace.)
4. **Start the server**
   ```
   node backend/server.js
   ```
5. Open **http://localhost:3000**.

## Demo accounts

All seeded accounts share the password **`password123`**:

| Role     | Email                  |
|----------|------------------------|
| Admin    | admin@market.test      |
| Seller   | seller@market.test     |
| Customer | customer@market.test   |

## API overview

| Area       | Endpoints |
|------------|-----------|
| Auth       | `POST /api/auth/register`, `POST /api/auth/login`, `PUT /api/auth/profile` |
| Products   | `GET /api/products`, `GET /api/products/:id`, `GET /api/products/mine`, `POST/PUT/DELETE /api/products/:id` |
| Categories | `GET /api/categories`, `POST/PUT/DELETE /api/categories/:id` |
| Cart       | `GET /api/cart`, `POST /api/cart/items`, `PUT/DELETE /api/cart/items/:productId` |
| Orders     | `POST /api/orders`, `GET /api/orders`, `GET /api/orders/:id`, `GET /api/orders/seller`, `PUT /api/orders/:id/cancel`, `PUT /api/orders/:id/status` |
| Reviews    | `GET /api/reviews/product/:id`, `POST /api/reviews`, `DELETE /api/reviews/:id` |
| Admin      | `GET /api/admin/customers`, `GET /api/admin/sellers`, user block/unblock, seller approve/reject, `GET /api/admin/reports`, `GET /api/admin/logs` |

Access control is enforced by an `x-user-id` header checked against the `users`
table on each protected request.

> **Note:** for this coursework, passwords are stored and compared as plain text
> (no hashing) to keep authentication simple.
