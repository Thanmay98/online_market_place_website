-- =========================================================
-- Online Marketplace - Database Schema (MySQL)
-- Module: Database
-- =========================================================
-- Apply with:
--   mysql -u root -p < database/schema.sql
-- =========================================================

CREATE DATABASE IF NOT EXISTS online_marketplace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE online_marketplace;

-- ---------------------------------------------------------
-- users
-- Every account in the system. Four roles share one table
-- so login/auth is uniform; `role` drives access control
-- and `status` handles block/unblock and seller approval.
-- This is the root table referenced by most others.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id     INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)   NOT NULL,
  email       VARCHAR(150)   NOT NULL UNIQUE,
  password    VARCHAR(255)   NOT NULL,            -- stores a hash, never plain text
  mobile      VARCHAR(15),
  role        ENUM('customer','seller','admin','superadmin') NOT NULL DEFAULT 'customer',
  status      ENUM('active','blocked','pending')             NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- categories
-- Product categories, managed by admins. Standalone table;
-- products reference it later. `status` lets an admin retire
-- a category without deleting it (and its products).
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  category_id    INT AUTO_INCREMENT PRIMARY KEY,
  category_name  VARCHAR(100)  NOT NULL UNIQUE,
  description    TEXT,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active'
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- addresses
-- A user can save multiple addresses (one-to-many). The FK
-- to users enforces that every address belongs to a real
-- user; ON DELETE CASCADE removes a user's addresses with
-- them, since an address has no meaning on its own.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  address_id    INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT          NOT NULL,
  address_line  VARCHAR(255) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  state         VARCHAR(100) NOT NULL,
  pincode       VARCHAR(10)  NOT NULL,
  CONSTRAINT fk_addresses_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------
-- products
-- Items listed for sale. Each product belongs to one seller
-- (a user) and one category.
--   * seller FK CASCADEs:  delete a seller -> their listings go too.
--   * category FK RESTRICTs: a category with products can't be
--     deleted (disable it via categories.status instead).
-- CHECK constraints stop price and stock going negative.
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  product_id      INT AUTO_INCREMENT PRIMARY KEY,
  seller_id       INT            NOT NULL,
  category_id     INT            NOT NULL,
  product_name    VARCHAR(150)   NOT NULL,
  description     TEXT,
  price           DECIMAL(10,2)  NOT NULL,
  stock_quantity  INT            NOT NULL DEFAULT 0,
  image           VARCHAR(255),
  status          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_seller
    FOREIGN KEY (seller_id) REFERENCES users(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(category_id)
    ON DELETE RESTRICT,
  CONSTRAINT chk_products_price CHECK (price >= 0),
  CONSTRAINT chk_products_stock CHECK (stock_quantity >= 0)
) ENGINE=InnoDB;
