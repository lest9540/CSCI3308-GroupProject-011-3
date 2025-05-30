DROP TABLE IF EXISTS users;
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(60) NOT NULL,
    email VARCHAR(100) NOT NULL,
    reminders BOOLEAN NOT NULL DEFAULT FALSE,
    budget DECIMAL(10, 2) DEFAULT 0.00
);
SELECT * FROM users;

DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    user_id VARCHAR(50) NOT NULL,
    name VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    month VARCHAR(2) NOT NULL,
    day VARCHAR(2) NOT NULL,
    year VARCHAR(4) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    final_balance DECIMAL(10, 2) NOT NULL
);

DROP TABLE IF EXISTS plannerPiechartData;
CREATE TABLE plannerPiechartData (
    user_id VARCHAR(50) PRIMARY KEY,
    recurring_percentage INT,
    groceries_percentage INT,
    personal_percentage INT,
    miscellaneous_percentage INT
);