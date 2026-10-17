CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`team_id` text,
	`created_by_user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`emoji` text DEFAULT '🏆' NOT NULL,
	`metric_kind` text NOT NULL,
	`metric_filter_json` text DEFAULT '{}' NOT NULL,
	`target_value` integer NOT NULL,
	`unit_label` text DEFAULT '' NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`reward_xp` integer DEFAULT 100 NOT NULL,
	`reward_badge_key` text,
	`reward_title` text,
	`status` text DEFAULT 'active' NOT NULL,
	`template_key` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `challenges_team_status_idx` ON `challenges` (`team_id`,`status`);
--> statement-breakpoint
CREATE INDEX `challenges_scope_status_idx` ON `challenges` (`scope`,`status`);
--> statement-breakpoint
CREATE INDEX `challenges_ends_at_idx` ON `challenges` (`ends_at`);
--> statement-breakpoint
CREATE INDEX `challenges_template_idx` ON `challenges` (`template_key`);
--> statement-breakpoint
CREATE TABLE `challenge_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`joined_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_participants_uidx` ON `challenge_participants` (`challenge_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `challenge_participants_user_idx` ON `challenge_participants` (`user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `challenge_progress` (
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`current_value` integer DEFAULT 0 NOT NULL,
	`last_workout_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_progress_uidx` ON `challenge_progress` (`challenge_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `challenge_progress_challenge_idx` ON `challenge_progress` (`challenge_id`);
--> statement-breakpoint
CREATE TABLE `challenge_reward_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` text NOT NULL,
	`user_id` text NOT NULL,
	`xp_awarded` integer DEFAULT 0 NOT NULL,
	`badge_key` text,
	`claimed_at` integer NOT NULL,
	`celebration_seen_at` integer,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `challenge_reward_claims_uidx` ON `challenge_reward_claims` (`challenge_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `challenge_reward_claims_user_idx` ON `challenge_reward_claims` (`user_id`);
--> statement-breakpoint
CREATE TABLE `user_community_xp` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_badges` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`badge_key` text NOT NULL,
	`title` text NOT NULL,
	`emoji` text DEFAULT '🏅' NOT NULL,
	`challenge_id` text,
	`unlocked_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE NO ACTION ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_badges_user_key_uidx` ON `user_badges` (`user_id`,`badge_key`);
--> statement-breakpoint
CREATE INDEX `user_badges_user_idx` ON `user_badges` (`user_id`);
