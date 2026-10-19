CREATE TABLE IF NOT EXISTS `team_fcs_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`fcs` real DEFAULT 0 NOT NULL,
	`components_json` text DEFAULT '{}' NOT NULL,
	`computed_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `team_fcs_scores_team_user_week_uidx` ON `team_fcs_scores` (`team_id`,`user_id`,`week_start`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `team_fcs_scores_team_week_fcs_idx` ON `team_fcs_scores` (`team_id`,`week_start`,`fcs`);
