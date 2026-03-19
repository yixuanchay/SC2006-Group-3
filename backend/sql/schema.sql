-- HomeMatch MySQL Schema
-- Run once:  mysql -u root -p homematch < backend/sql/schema.sql
-- (create the database first: CREATE DATABASE homematch;)

CREATE TABLE IF NOT EXISTS users (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    email          VARCHAR(255) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    name           VARCHAR(255),
    citizenship    VARCHAR(10),
    is_first_timer TINYINT(1) DEFAULT 1,
    reset_token    VARCHAR(64),
    reset_expires  DATETIME,
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_searches (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    name       VARCHAR(255),
    form_data  JSON NOT NULL,
    results    JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);
