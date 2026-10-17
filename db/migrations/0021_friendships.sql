CREATE TABLE `friendships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_a_id` text NOT NULL,
	`user_b_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by` text NOT NULL,
	`share_workout_a` integer DEFAULT 0 NOT NULL,
	`share_workout_b` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`user_a_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_b_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `friendships_pair_uidx` ON `friendships` (`user_a_id`,`user_b_id`);
--> statement-breakpoint
CREATE INDEX `friendships_user_a_status_idx` ON `friendships` (`user_a_id`,`status`);
--> statement-breakpoint
CREATE INDEX `friendships_user_b_status_idx` ON `friendships` (`user_b_id`,`status`);
--> statement-breakpoint
CREATE INDEX `friendships_requested_by_idx` ON `friendships` (`requested_by`,`status`);
--> statement-breakpoint
CREATE TABLE `friend_live_presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`presence_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`started_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `friend_live_presence_active_updated_idx` ON `friend_live_presence` (`active`,`updated_at`);
