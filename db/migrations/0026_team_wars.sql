CREATE TABLE IF NOT EXISTS `war_seasons` (
	`key` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_war_stats` (
	`team_id` text PRIMARY KEY NOT NULL,
	`league` text DEFAULT 'bronze' NOT NULL,
	`lp` integer DEFAULT 0 NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`draws` integer DEFAULT 0 NOT NULL,
	`season_key` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_war_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`league` text NOT NULL,
	`lp` integer DEFAULT 0 NOT NULL,
	`queued_at` integer NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `team_war_queue_team_uidx` ON `team_war_queue` (`team_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `team_war_queue_league_status_idx` ON `team_war_queue` (`league`,`status`,`lp`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `wars` (
	`id` text PRIMARY KEY NOT NULL,
	`season_key` text NOT NULL,
	`team_a_id` text NOT NULL,
	`team_b_id` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`score_a` real DEFAULT 0 NOT NULL,
	`score_b` real DEFAULT 0 NOT NULL,
	`winner_team_id` text,
	`summary_json` text DEFAULT '{}' NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`team_a_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_b_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`winner_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `wars_status_ends_idx` ON `wars` (`status`,`ends_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `wars_team_a_idx` ON `wars` (`team_a_id`,`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `wars_team_b_idx` ON `wars` (`team_b_id`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `war_score_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`war_id` text NOT NULL,
	`team_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`components_json` text DEFAULT '{}' NOT NULL,
	FOREIGN KEY (`war_id`) REFERENCES `wars`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `war_score_snapshots_war_team_idx` ON `war_score_snapshots` (`war_id`,`team_id`,`captured_at`);
