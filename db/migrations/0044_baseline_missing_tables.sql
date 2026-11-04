CREATE TABLE IF NOT EXISTS `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_globally_disabled` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `oauth_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `oauth_accounts_provider_account` ON `oauth_accounts` (`provider`,`provider_account_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `oauth_accounts_user` ON `oauth_accounts` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `daily_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`sleep_quality` integer,
	`day_energy` integer,
	`stress` integer,
	`weight_kg` real,
	`notes` text,
	`day_closed_at` integer,
	`summary_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_daily_checkins_user_date` ON `daily_checkins` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`meta_json` text,
	`deployment_env` text,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_admin_audit_created` ON `admin_audit_log` (`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meal_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by_user_id` text
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_meal_catalog_updated` ON `meal_catalog` (`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meal_catalog_images` (
	`meal_id` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`data_url` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meal_catalog`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `exercise_technique_links` (
	`id` text PRIMARY KEY NOT NULL,
	`youtube_url` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by_user_id` text
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_exercise_technique_updated` ON `exercise_technique_links` (`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category_id` text NOT NULL,
	`secondary_category_ids` text,
	`aliases_en` text,
	`aliases_pl` text,
	`equipment` text,
	`difficulty` text,
	`description` text,
	`cues` text,
	`technique_youtube_url` text,
	`technique_youtube_title` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by_user_id` text,
	`updated_by_user_id` text
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_exercises_category` ON `exercises` (`category_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_exercises_name` ON `exercises` (`name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_exercises_active` ON `exercises` (`is_active`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_exercise_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`personal_youtube_url` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_user_exercise_notes_user_exercise` ON `user_exercise_notes` (`user_id`,`exercise_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_user_exercise_notes_user` ON `user_exercise_notes` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `active_workout_sessions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`device_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`granted` integer NOT NULL,
	`text_version` text NOT NULL,
	`source` text NOT NULL,
	`decided_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_consents_user_type_decided` ON `user_consents` (`user_id`,`type`,`decided_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `badge_definitions` (
	`key` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`emoji` text NOT NULL,
	`description` text,
	`target_value` integer,
	`unit_label` text,
	`is_repeatable` integer DEFAULT 0 NOT NULL,
	`rarity_cache_pct` real,
	`rarity_cache_updated_at` integer,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_active_quest_lock` (
	`team_id` text PRIMARY KEY NOT NULL,
	`quest_id` text NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quest_id`) REFERENCES `team_quests`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `push_subscriptions_endpoint_uidx` ON `push_subscriptions` (`endpoint`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `reminder_dispatches` (
	`user_id` text NOT NULL,
	`date_key` text NOT NULL,
	`kind` text NOT NULL,
	`sent_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `reminder_dispatches_uidx` ON `reminder_dispatches` (`user_id`,`date_key`,`kind`);
--> statement-breakpoint
ALTER TABLE `users` ADD `sex` TEXT;
--> statement-breakpoint
ALTER TABLE `users` ADD `package_ends_at` INTEGER;
--> statement-breakpoint
ALTER TABLE `users` ADD `package_plan_sku` TEXT;
--> statement-breakpoint
ALTER TABLE `users` ADD `admin_note` TEXT;
--> statement-breakpoint
ALTER TABLE `meal_logs` ADD `slot` TEXT;
--> statement-breakpoint
ALTER TABLE `meal_logs` ADD `barcode` TEXT;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `report_cadence_days` INTEGER NOT NULL DEFAULT 14;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `reminders_json` TEXT;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `meal_templates_json` TEXT;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `fitness_goals_json` TEXT;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `onboarding_completed_at` INTEGER;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `intro_tour_completed_at` INTEGER;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ai_entitled` INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `ai_features_disabled` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `progress_delta_unit` TEXT NOT NULL DEFAULT 'percent';
--> statement-breakpoint
ALTER TABLE `user_settings` ADD `start_photo_data_url` TEXT;
--> statement-breakpoint
ALTER TABLE `workout_plans` ADD `sort_order` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `bug_reports` ADD `admin_seen_at` INTEGER;
--> statement-breakpoint
ALTER TABLE `user_community_xp` ADD `prestige` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user_community_xp` ADD `prestige_xp_lifetime` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user_community_xp` ADD `title_key` TEXT;
--> statement-breakpoint
ALTER TABLE `user_community_xp` ADD `frame_key` TEXT;
--> statement-breakpoint
ALTER TABLE `user_community_xp` ADD `aura_key` TEXT;
--> statement-breakpoint
ALTER TABLE `user_social_profiles` ADD `opted_in_to_team_ranking` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user_social_profiles` ADD `opted_in_to_team_cardio` INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `user_badges` ADD `definition_key` TEXT;
