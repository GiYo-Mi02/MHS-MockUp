-- Migration: Fix verification_expires_at timezone issue
-- This changes the column from timestamptz to text to store millisecond timestamps
-- Run this in your Supabase SQL Editor

-- Step 1: Change the column type to TEXT to store millisecond timestamps
ALTER TABLE citizens 
ALTER COLUMN verification_expires_at TYPE TEXT;

-- Step 2: Add a comment explaining the format
COMMENT ON COLUMN citizens.verification_expires_at IS 'Expiration timestamp stored as milliseconds since epoch (string format) to avoid timezone conversion issues';

-- Step 3: Clear any existing expired verification codes
UPDATE citizens 
SET verification_code_hash = NULL,
    verification_expires_at = NULL
WHERE verification_expires_at IS NOT NULL 
  AND (
    -- Old ISO format that's expired
    verification_expires_at ~ '^\d{4}-'
    OR
    -- Numeric format that's expired
    (verification_expires_at ~ '^\d+$' AND verification_expires_at::bigint < EXTRACT(EPOCH FROM NOW()) * 1000)
  );

-- Verification complete message
SELECT 'Migration completed successfully. All expired codes cleared.' AS status;
