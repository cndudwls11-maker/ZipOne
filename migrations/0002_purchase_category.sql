CREATE TABLE posts_next (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL CHECK(length(nickname) BETWEEN 2 AND 20),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 100),
  content TEXT NOT NULL CHECK(length(content) BETWEEN 10 AND 5000),
  category TEXT NOT NULL CHECK(category IN ('product','purchase','usage','idea','other')),
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO posts_next SELECT id,nickname,title,content,category,password_hash,created_at,updated_at FROM posts;
CREATE TABLE replies_next (
  post_id TEXT PRIMARY KEY REFERENCES posts_next(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK(length(content) BETWEEN 2 AND 5000),
  admin_id TEXT REFERENCES admins(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO replies_next SELECT post_id,content,admin_id,created_at,updated_at FROM replies;
DROP TABLE replies;
DROP TABLE posts;
ALTER TABLE posts_next RENAME TO posts;
ALTER TABLE replies_next RENAME TO replies;
CREATE INDEX posts_created ON posts(created_at DESC, id DESC);
CREATE INDEX posts_category_created ON posts(category, created_at DESC, id DESC);
INSERT INTO schema_migrations VALUES ('0002_purchase_category.sql', unixepoch());
