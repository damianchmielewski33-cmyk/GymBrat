CREATE TABLE IF NOT EXISTS `meal_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by_user_id` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_meal_catalog_updated` ON `meal_catalog` (`updated_at`);
