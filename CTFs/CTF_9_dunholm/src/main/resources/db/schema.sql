CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    display_name VARCHAR(128) NOT NULL,
    email VARCHAR(128),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trials (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    phase VARCHAR(16) NOT NULL,
    status VARCHAR(32) NOT NULL,
    summary TEXT,
    lead_investigator VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secrets (
    id BIGSERIAL PRIMARY KEY,
    secret_key VARCHAR(128) NOT NULL,
    secret_value TEXT NOT NULL,
    owner_username VARCHAR(64),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    display_title VARCHAR(255) NOT NULL,
    owner_username VARCHAR(64),
    classification VARCHAR(32) NOT NULL,
    summary TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_flags (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    flag_index INTEGER NOT NULL,
    flag_value VARCHAR(255) NOT NULL,
    CONSTRAINT user_flags_uniq UNIQUE (username, flag_index)
);
