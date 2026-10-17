CREATE TABLE `team_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`type` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`snapshot_json` text DEFAULT '{}' NOT NULL,
	`source_key` text,
	`reaction_count` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`moderation_status` text DEFAULT 'visible' NOT NULL,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `team_posts_team_created_idx` ON `team_posts` (`team_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `team_posts_author_created_idx` ON `team_posts` (`author_user_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_posts_team_source_uidx` ON `team_posts` (`team_id`,`source_key`);
--> statement-breakpoint
CREATE TABLE `team_post_media` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`mime_type` text NOT NULL,
	`data_url` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `team_posts`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `team_post_media_post_idx` ON `team_post_media` (`post_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `team_post_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`parent_comment_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `team_posts`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `team_post_comments_post_created_idx` ON `team_post_comments` (`post_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `team_post_comments_parent_idx` ON `team_post_comments` (`parent_comment_id`);
--> statement-breakpoint
CREATE TABLE `team_post_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `team_posts`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_post_reactions_post_user_uidx` ON `team_post_reactions` (`post_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `team_post_reactions_post_kind_idx` ON `team_post_reactions` (`post_id`,`kind`);
--> statement-breakpoint
CREATE TABLE `team_post_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`comment_id` text,
	`mentioned_user_id` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `team_posts`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`comment_id`) REFERENCES `team_post_comments`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `team_post_mentions_post_idx` ON `team_post_mentions` (`post_id`);
--> statement-breakpoint
CREATE INDEX `team_post_mentions_user_idx` ON `team_post_mentions` (`mentioned_user_id`);
--> statement-breakpoint
CREATE TABLE `team_feed_events` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `team_feed_events_team_created_idx` ON `team_feed_events` (`team_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `community_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`milestone_key` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	`meta_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `community_milestones_user_kind_key_uidx` ON `community_milestones` (`user_id`,`kind`,`milestone_key`);
