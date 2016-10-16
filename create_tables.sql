CREATE TABLE IF NOT EXISTS user
(
    user_name VARCHAR(20) NOT NULL PRIMARY KEY,
    password VARCHAR(20) NOT NULL,
    first_name VARCHAR(20),
    middle_name VARCHAR(20),
    last_name VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS user_follow
(
    user_name VARCHAR(20) NOT NULL,
    following_user_name VARCHAR(20) NOT NULL,
    FOREIGN KEY (user_name) REFERENCES user (user_name),
    FOREIGN KEY (following_user_name) REFERENCES user (user_name) 
);

CREATE UNIQUE INDEX IF NOT EXISTS user_follow_idx
ON user_follow (user_name, following_user_name);

CREATE TABLE IF NOT EXISTS alert
(
    alert_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    description VARCHAR(255) NOT NULL,
    actor_user_name VARCHAR(20) NOT NULL,
    affected_user_name VARCHAR(20) NOT NULL,
    action_date TIMESTAMP NOT NULL,
    post_id INTEGER,
    post_comment_id INTEGER,
    FOREIGN KEY (actor_user_name) 
        REFERENCES user (user_name),
    FOREIGN KEY (affected_user_name)
        REFERENCES user (user_name)
);

CREATE TABLE IF NOT EXISTS post
(
    post_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    post_date TIMESTAMP NOT NULL,
    description VARCHAR(200) NOT NULL,
    author VARCHAR(20) NOT NULL,
    image BLOB,
    mime_type VARCHAR(20) NOT NULL,
    encoding VARCHAR(20),
    file_size INTEGER NOT NULL DEFAULT 0,
    file_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (author) REFERENCES user (user_name)
);

CREATE TABLE IF NOT EXISTS post_comment 
(
    post_comment_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_name VARCHAR(20) NOT NULL,
    comment_text VARCHAR(200) NOT NULL,
    comment_date TIMESTAMP NOT NULL,
    FOREIGN KEY (post_id) REFERENCES post (post_id),
    FOREIGN KEY (user_name) REFERENCES user (user_name)
);

CREATE TABLE IF NOT EXISTS post_like
(
    post_id INTEGER NOT NULL,
    user_name VARCHAR(20),
    FOREIGN KEY (post_id) REFERENCES post (post_id),
    FOREIGN KEY (user_name) REFERENCES user (user_name)
);

CREATE UNIQUE INDEX IF NOT EXISTS post_like_idx
ON post_like (post_id, user_name);