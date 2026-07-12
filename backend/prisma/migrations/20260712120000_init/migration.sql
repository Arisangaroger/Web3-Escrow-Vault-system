-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('Created', 'FundsLocked', 'Shipped', 'Delivered', 'Disputed', 'Released', 'Cancelled', 'Resolved');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('Simulated_Sent', 'Pending', 'Failed');

-- CreateTable
CREATE TABLE "users" (
    "phone_number" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "encrypted_private_key" TEXT NOT NULL,
    "pin_hash" TEXT NOT NULL,
    "pin_attempts" INTEGER NOT NULL DEFAULT 0,
    "lockout_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("phone_number")
);

-- CreateTable
CREATE TABLE "deals" (
    "deal_id" INTEGER NOT NULL,
    "sender_phone" TEXT NOT NULL,
    "driver_phone" TEXT NOT NULL,
    "receiver_phone" TEXT NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "status" "DealStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fund_lock_deadline" TIMESTAMP(3) NOT NULL,
    "payout_ready_time" TIMESTAMP(3),
    "dispute_reason_code" INTEGER,
    "tx_hash_created" TEXT NOT NULL,
    "last_synced_block" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("deal_id")
);

-- CreateTable
CREATE TABLE "deal_action_log" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "actor_phone" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tx_hash" TEXT NOT NULL,

    CONSTRAINT "deal_action_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications_log" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER,
    "recipient_phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivery_status" "NotificationStatus" NOT NULL DEFAULT 'Simulated_Sent',

    CONSTRAINT "notifications_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_state" (
    "id" SERIAL NOT NULL,
    "last_synced_block" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_sender_phone_fkey" FOREIGN KEY ("sender_phone") REFERENCES "users"("phone_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_driver_phone_fkey" FOREIGN KEY ("driver_phone") REFERENCES "users"("phone_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_receiver_phone_fkey" FOREIGN KEY ("receiver_phone") REFERENCES "users"("phone_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_action_log" ADD CONSTRAINT "deal_action_log_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_action_log" ADD CONSTRAINT "deal_action_log_actor_phone_fkey" FOREIGN KEY ("actor_phone") REFERENCES "users"("phone_number") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("deal_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_recipient_phone_fkey" FOREIGN KEY ("recipient_phone") REFERENCES "users"("phone_number") ON DELETE RESTRICT ON UPDATE CASCADE;
