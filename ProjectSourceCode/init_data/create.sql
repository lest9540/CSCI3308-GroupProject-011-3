DROP TABLE IF EXISTS users;
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL,
    email VARCHAR(100) NOT NULL
);

DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10, 2) NOT NULL,
    final_balance DECIMAL(10, 2) NOT NULL
);