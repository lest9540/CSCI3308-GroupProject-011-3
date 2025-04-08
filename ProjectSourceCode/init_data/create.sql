DROP TABLE IF EXISTS users;
CREATE TABLE users (
    username VARCHAR(50) PRIMARY KEY,
    email VARCHAR(50),
    password VARCHAR(60) NOT NULL
);
SELECT * FROM users;