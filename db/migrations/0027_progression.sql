CREATE TABLE IF NOT EXISTS `progression_xp_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`team_id` text,
	`track` text NOT NULL,
	`amount` integer NOT NULL,
	`source` text NOT NULL,
	`source_key` text NOT NULL,
	`season_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `progression_xp_ledger_source_uidx` ON `progression_xp_ledger` (`source_key`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `progression_xp_ledger_user_created_idx` ON `progression_xp_ledger` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_xp` (
	`team_id` text PRIMARY KEY NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `community_xp` (
	`id` text PRIMARY KEY NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_season_xp` (
	`user_id` text NOT NULL,
	`season_key` text NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`finalized` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY (`user_id`, `season_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_cosmetics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cosmetic_key` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_cosmetics_user_key_uidx` ON `user_cosmetics` (`user_id`,`cosmetic_key`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_cosmetic_loadout` (
	`user_id` text PRIMARY KEY NOT NULL,
	`frame_key` text,
	`aura_key` text,
	`title_key` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
