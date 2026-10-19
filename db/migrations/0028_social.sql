CREATE TABLE IF NOT EXISTS `user_social_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`visibility` text DEFAULT 'friends' NOT NULL,
	`bio` text,
	`show_stats` integer DEFAULT 1 NOT NULL,
	`show_on_global` integer DEFAULT 1 NOT NULL,
	`discoverable` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_follows` (
	`id` text PRIMARY KEY NOT NULL,
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`following_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_follows_pair_uidx` ON `user_follows` (`follower_id`,`following_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_follows_following_idx` ON `user_follows` (`following_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_activity_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`meta_json` text DEFAULT '{}' NOT NULL,
	`visibility_snapshot` text DEFAULT 'friends' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_activity_posts_user_created_idx` ON `user_activity_posts` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_activity_posts_created_idx` ON `user_activity_posts` (`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_activity_posts_vis_created_idx` ON `user_activity_posts` (`visibility_snapshot`,`created_at`);
