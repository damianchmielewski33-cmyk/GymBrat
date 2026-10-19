CREATE TABLE IF NOT EXISTS `user_reputation` (
	`user_id` text PRIMARY KEY NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`tier` text DEFAULT 'bronze' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_reputation_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`points` integer NOT NULL,
	`source_key` text NOT NULL,
	`team_id` text,
	`meta_json` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_reputation_events_source_uidx` ON `user_reputation_events` (`source_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_reputation_events_user_created_idx` ON `user_reputation_events` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_reputation_events_user_kind_created_idx` ON `user_reputation_events` (`user_id`,`kind`,`created_at`);
