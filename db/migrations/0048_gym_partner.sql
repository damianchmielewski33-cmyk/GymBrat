CREATE TABLE IF NOT EXISTS `gym_partner_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`lat` real NOT NULL,
	`lng` real NOT NULL,
	`goal` text NOT NULL,
	`level` text NOT NULL,
	`preferred_time` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `gym_partner_presence_geo_idx` ON `gym_partner_presence` (`expires_at`,`lat`,`lng`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `gym_partner_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `gym_partner_requests_pair_uidx` ON `gym_partner_requests` (`from_user_id`,`to_user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `gym_partner_requests_to_status_idx` ON `gym_partner_requests` (`to_user_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `gym_partner_requests_from_status_idx` ON `gym_partner_requests` (`from_user_id`,`status`);
