CREATE TABLE `daily_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`sleep_quality` integer,
	`day_energy` integer,
	`stress` integer,
	`weight_kg` real,
	`notes` text,
	`day_closed_at` integer,
	`summary_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_checkins_user_date` ON `daily_checkins` (`user_id`,`date`);

