-- =========================================================
-- Online Marketplace - Seed Data (MySQL)
-- =========================================================
-- Run AFTER schema.sql, on a fresh database:
--   cmd /c "mysql -u root -p < database/seed.sql"
--
-- PASSWORDS: for this coursework we keep auth simple - every
-- sample account shares the same PLAIN-TEXT password below
-- (no hashing). The login check just compares the value.
--   Shared demo password:  password123
-- =========================================================

USE online_marketplace;

-- ---------------------------------------------------------
-- Sample accounts. 'active' so they can log in right away.
-- One admin + one customer (the two logins we test with),
-- plus one seller because products must belong to a seller.
-- ---------------------------------------------------------
INSERT INTO users (name, email, password, mobile, role, status) VALUES
  ('Site Admin',    'admin@market.test',    'password123', '9000000001', 'admin',    'active'),
  ('Demo Seller',   'seller@market.test',   'password123', '9000000002', 'seller',   'active'),
  ('Demo Customer', 'customer@market.test', 'password123', '9000000003', 'customer', 'active');

-- ---------------------------------------------------------
-- Product categories.
-- ---------------------------------------------------------
INSERT INTO categories (category_name, description) VALUES
  ('Electronics',    'Phones, laptops and gadgets'),
  ('Books',          'Printed and digital books'),
  ('Home & Kitchen', 'Appliances and household items');

-- ---------------------------------------------------------
-- Sample products owned by the demo seller.
-- We look the ids up by name/email instead of hard-coding
-- them, so the seed still works no matter what the
-- AUTO_INCREMENT values happen to be.
-- ---------------------------------------------------------
SET @seller_id = (SELECT user_id     FROM users      WHERE email = 'seller@market.test');
SET @cat_elec  = (SELECT category_id FROM categories WHERE category_name = 'Electronics');
SET @cat_books = (SELECT category_id FROM categories WHERE category_name = 'Books');
SET @cat_home  = (SELECT category_id FROM categories WHERE category_name = 'Home & Kitchen');

INSERT INTO products (seller_id, category_id, product_name, description, price, stock_quantity) VALUES
  (@seller_id, @cat_elec,  'Wireless Earbuds',   'Bluetooth 5.3 earbuds with charging case', 1999.00, 50),
  (@seller_id, @cat_elec,  'USB-C Charger 30W',  'Fast charger for phones and tablets',       899.00, 100),
  (@seller_id, @cat_books, 'Intro to Databases', 'A beginner-friendly guide to SQL',          499.00,  30),
  (@seller_id, @cat_home,  'Ceramic Coffee Mug', '350ml microwave-safe mug',                  249.00, 200);
