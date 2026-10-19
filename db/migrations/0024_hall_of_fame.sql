CREATE TABLE IF NOT EXISTS `hof_seasons` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`archived_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `hof_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`season_key` text NOT NULL,
	`category` text NOT NULL,
	`rank` integer NOT NULL,
	`user_id` text NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`score_label` text DEFAULT '' NOT NULL,
	`meta_json` text DEFAULT '{}' NOT NULL,
	`awarded_at` integer NOT NULL,
	FOREIGN KEY (`season_key`) REFERENCES `hof_seasons`(`key`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `hof_awards_season_cat_rank_uidx` ON `hof_awards` (`season_key`,`category`,`rank`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `hof_awards_season_cat_user_uidx` ON `hof_awards` (`season_key`,`category`,`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `hof_awards_user_idx` ON `hof_awards` (`user_id`);
