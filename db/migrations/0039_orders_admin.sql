ALTER TABLE `subscription_orders` ADD `fulfilled_at` integer;--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `late_payment_at` integer;--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `refunded_at` integer;--> statement-breakpoint
ALTER TABLE `subscription_orders` ADD `admin_note` text;--> statement-breakpoint
UPDATE `subscription_orders` SET `fulfilled_at` = `paid_at` WHERE `status` IN ('paid','manual') AND `fulfilled_at` IS NULL AND `paid_at` IS NOT NULL;
