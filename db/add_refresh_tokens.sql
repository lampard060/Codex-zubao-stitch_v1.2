-- Create refresh tokens table
create table user_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token varchar(255) not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- Index for lookup by token
create index idx_refresh_tokens_token on user_refresh_tokens(token);
-- Index for user lookup
create index idx_refresh_tokens_user on user_refresh_tokens(user_id);
-- Index for cleanup of expired tokens
create index idx_refresh_tokens_expiry on user_refresh_tokens(expires_at);
