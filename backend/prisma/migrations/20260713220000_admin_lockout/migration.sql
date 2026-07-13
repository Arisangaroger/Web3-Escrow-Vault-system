-- Admin account lockout after repeated failed logins
ALTER TABLE "admins" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "admins" ADD COLUMN "locked_until" TIMESTAMP(3);
