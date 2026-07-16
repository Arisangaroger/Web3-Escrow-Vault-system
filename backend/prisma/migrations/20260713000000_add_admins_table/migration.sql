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
INSERT INTO "admins" ("name", "email", "password_hash", "wallet_address") 
VALUES (
  'Musanze Cooperative Manager',
  'admin@escrow.local',
  '$argon2id$v=19$m=65536,t=3,p=4$st6fEN9YtXQ4I9BxUnUXbg$XWdBy5y3jOuhnc2so9UhwDr8srxvKNwX3lCHS28sT0w',
  '0x0000000000000000000000000000000000000000'
);
