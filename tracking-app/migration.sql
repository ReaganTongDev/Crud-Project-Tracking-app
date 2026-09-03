-- Fold the separate salt column into password_hash, then drop salt.
-- PBKDF2 rows become: pbkdf2$<salt>$<hash>
-- After a successful login, the app replaces that with a bcrypt hash (salt is already inside bcrypt).

UPDATE users
SET password_hash = 'pbkdf2$' || salt || '$' || password_hash
WHERE salt IS NOT NULL
  AND salt != ''
  AND password_hash NOT LIKE '$2%'
  AND password_hash NOT LIKE 'pbkdf2$%';

ALTER TABLE users DROP COLUMN salt;
