ALTER TABLE user ADD COLUMN username TEXT;
ALTER TABLE user ADD COLUMN displayUsername TEXT;
CREATE UNIQUE INDEX user_username ON user(username);
