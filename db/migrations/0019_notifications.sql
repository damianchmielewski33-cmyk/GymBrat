CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`href` text DEFAULT '' NOT NULL,
	`actor_user_id` text,
	`team_id` text,
	`entity_type` text,
	`entity_id` text,
	`group_key` text,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`collapsed_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE SET NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `notifications_user_created_idx` ON `notifications` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `notifications_user_read_created_idx` ON `notifications` (`user_id`,`read_at`,`created_at`);
--> statement-breakpoint
CREATE INDEX `notifications_user_kind_created_idx` ON `notifications` (`user_id`,`kind`,`created_at`);
--> statement-breakpoint
CREATE INDEX `notifications_user_group_idx` ON `notifications` (`user_id`,`group_key`);
--> statement-breakpoint
CREATE TABLE `notification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`notification_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `notification_events_user_created_idx` ON `notification_events` (`user_id`,`created_at`);
