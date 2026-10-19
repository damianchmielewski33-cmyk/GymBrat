CREATE TABLE IF NOT EXISTS `team_quests` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`template_key` text NOT NULL,
	`title` text NOT NULL,
	`emoji` text DEFAULT '🎯' NOT NULL,
	`metric_kind` text NOT NULL,
	`metric_filter_json` text DEFAULT '{}' NOT NULL,
	`target_value` real NOT NULL,
	`unit_label` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`completed_at` integer,
	`reward_xp_each` integer DEFAULT 100 NOT NULL,
	`reward_badge_key` text NOT NULL,
	`reward_title` text NOT NULL,
	`created_by` text,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `team_quests_team_status_idx` ON `team_quests` (`team_id`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_quest_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`last_workout_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`quest_id`) REFERENCES `team_quests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `team_quest_contrib_quest_user_uidx` ON `team_quest_contributions` (`quest_id`,`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_quest_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`quest_id` text NOT NULL,
	`team_id` text NOT NULL,
	`completed_at` integer NOT NULL,
	`total_value` real DEFAULT 0 NOT NULL,
	`participants_count` integer DEFAULT 0 NOT NULL,
	`meta_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`quest_id`) REFERENCES `team_quests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `team_quest_completions_quest_uidx` ON `team_quest_completions` (`quest_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `team_quest_completions_team_idx` ON `team_quest_completions` (`team_id`,`completed_at`);
