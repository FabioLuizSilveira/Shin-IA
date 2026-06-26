-- Authentication domain events
-- Added to events schema to track all auth lifecycle events

-- Events schema already created in migration 20260019
-- This migration adds auth-specific event types and constants

-- Auth event types (for reference):
-- auth.login — User successfully authenticated
-- auth.logout — User session ended
-- auth.session.created — New session created
-- auth.session.expired — Session expired due to inactivity or timeout
-- auth.session.revoked — Session explicitly revoked (logout)
-- auth.password.reset — Password reset initiated
-- auth.password.reset.completed — Password reset completed
-- auth.email.verified — Email address verified
-- auth.email.verification.sent — Email verification sent
-- auth.mfa.enrolled — MFA method enrolled
-- auth.mfa.verified — MFA verification successful
-- auth.mfa.failed — MFA verification failed
-- auth.login.failed — Login attempt failed

-- Events are recorded in events.domain_events table with:
-- event_type: one of the above
-- tenant_id: UUID of tenant
-- user_id: UUID of user (NULL for platform-level events)
-- metadata: JSONB containing event-specific data (IP, user agent, device, etc.)
-- occurred_at: timestamptz
