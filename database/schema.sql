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
