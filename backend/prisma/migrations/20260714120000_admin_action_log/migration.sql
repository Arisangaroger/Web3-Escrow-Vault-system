-- Allow admin resolution audit without a user phone FK violation
ALTER TABLE "deal_action_log" ALTER COLUMN "actor_phone" DROP NOT NULL;
ALTER TABLE "deal_action_log" ADD COLUMN "admin_email" TEXT;
