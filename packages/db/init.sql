-- Enable CITEXT extension for case-insensitive username
CREATE EXTENSION IF NOT EXISTS citext;
-- Enable uuid-ossp for gen_random_uuid (built into PG 13+ but extension is safer)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
