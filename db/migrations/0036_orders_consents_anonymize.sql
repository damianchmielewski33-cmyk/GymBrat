CREATE TABLE IF NOT EXISTS `subscription_plans` (`id` text PRIMARY KEY NOT NULL, `sku` text NOT NULL, `title` text NOT NULL, `description` text DEFAULT '' NOT NULL, `days` integer NOT NULL, `price_grosze` integer NOT NULL, `active` integer DEFAULT 1 NOT NULL, `sort_order` integer DEFAULT 0 NOT NULL, `updated_at` integer NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `subscription_plans_sku_unique` ON `subscription_plans` (`sku`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscription_orders` (`id` text PRIMARY KEY NOT NULL, `user_id` text, `plan_id` text, `plan_sku` text NOT NULL, `days` integer NOT NULL, `amount_grosze` integer NOT NULL, `status` text NOT NULL, `hotpay_payment_id` text, `source` text, `created_at` integer, `paid_at` integer);
--> statement-breakpoint
CREATE TABLE `subscription_orders_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`plan_id` text,
	`plan_sku` text NOT NULL,
	`days` integer NOT NULL,
	`amount_grosze` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`hotpay_payment_id` text,
	`source` text DEFAULT 'hotpay' NOT NULL,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`terms_accepted_at` integer,
	`immediate_service_consent_at` integer,
	`terms_version` text,
	`consent_text_hash` text,
	`receipt_number` text,
	`receipt_issued_at` integer,
	`buyer_name` text,
	`buyer_tax_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `subscription_orders_new` (`id`, `user_id`, `plan_id`, `plan_sku`, `days`, `amount_grosze`, `status`, `hotpay_payment_id`, `source`, `created_at`, `paid_at`) SELECT `id`, `user_id`, `plan_id`, `plan_sku`, `days`, `amount_grosze`, `status`, `hotpay_payment_id`, `source`, `created_at`, `paid_at` FROM `subscription_orders`;
--> statement-breakpoint
DROP TABLE `subscription_orders`;
--> statement-breakpoint
ALTER TABLE `subscription_orders_new` RENAME TO `subscription_orders`;
--> statement-breakpoint
CREATE INDEX `subscription_orders_user_created` ON `subscription_orders` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `subscription_orders_status` ON `subscription_orders` (`status`);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscription_orders_receipt_number` ON `subscription_orders` (`receipt_number`);
--> statement-breakpoint
CREATE TABLE `receipt_counters` (
	`year` integer PRIMARY KEY NOT NULL,
	`last_number` integer DEFAULT 0 NOT NULL
);
