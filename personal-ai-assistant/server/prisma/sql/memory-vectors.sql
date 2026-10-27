-- Phase 10: long-term memory vectors.
--
-- Prisma cannot diff `Unsupported(...)` columns, so the embedding column is
-- managed here instead of through `prisma db push`.
--
--   npm run db:memory
--
-- Why halfvec: nemotron-3.5-embed-1b returns 2048 dimensions, but pgvector's
-- HNSW index caps `vector` at 2000 dimensions. `halfvec` allows 4000, costs
-- half the storage, and is accurate enough for cosine ranking of short facts.
--
-- Safe to re-run: the type change is skipped once the column is already right,
-- and the index uses IF NOT EXISTS.

DO $$
DECLARE
  current_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO current_type
    FROM pg_attribute a
   WHERE a.attrelid = '"Memory"'::regclass
     AND a.attname = 'embedding';

  IF current_type IS NOT NULL AND current_type <> 'halfvec(2048)' THEN
    ALTER TABLE "Memory"
      ALTER COLUMN embedding TYPE halfvec(2048) USING NULL::halfvec(2048);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Memory_embedding_hnsw"
  ON "Memory" USING hnsw (embedding halfvec_cosine_ops);
