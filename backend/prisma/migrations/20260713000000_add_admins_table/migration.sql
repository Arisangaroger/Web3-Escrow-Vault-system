-- CreateTable
CREATE TABLE "admins" (
    "admin_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "admins_pkey" PRIMARY KEY ("admin_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "admins"("email");

-- Insert seed admin (password: admin123 - CHANGE IN PRODUCTION!)
-- Password hash generated with argon2: admin123
INSERT INTO "admins" ("name", "email", "password_hash", "wallet_address") 
VALUES (
  'Musanze Cooperative Manager',
  'admin@escrow.local',
  '$argon2id$v=19$m=65536,t=3,p=4$randomsalt$hashedpassword',
  '0x0000000000000000000000000000000000000000'
);

-- Note: Update wallet_address with actual admin wallet after deployment
-- Note: Re-hash password properly before production deployment
