CREATE TABLE `body_report_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`data_url` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`report_id`) REFERENCES `body_reports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `body_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`weight_kg` real,
	`waist_cm` real,
	`chest_cm` real,
	`thigh_cm` real,
	`training_energy` integer,
	`sleep_quality` integer,
	`day_energy` integer,
	`digestion_score` integer,
	`cardio_compliance` text,
	`diet_compliance` text,
	`training_compliance` text,
	`compliance_notes` text,
	`additional_info` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `page_views` (
	`id` text PRIMARY KEY NOT NULL,
	`screen_key` text NOT NULL,
	`pathname` text NOT NULL,
	`user_id` text,
	`visitor_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_page_views_created` ON `page_views` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_page_views_screen_created` ON `page_views` (`screen_key`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_page_views_user_created` ON `page_views` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `site_activity_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`action` text NOT NULL,
	`meta_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`cardio_minutes` integer DEFAULT 0 NOT NULL,
	`exercise_data_json` text,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`weekly_cardio_goal_minutes` integer DEFAULT 150 NOT NULL,
	`training_nutrition_goals_json` text,
	`rest_nutrition_goals_json` text,
	`nutrition_day_types_json` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`name` text,
	`first_name` text,
	`last_name` text,
	`weight_kg` real,
	`height_cm` integer,
	`age` integer,
	`activity_level` text,
	`app_role` text DEFAULT 'zawodnik' NOT NULL,
	`fitatu_access_token` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `weight_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`recorded_at` integer NOT NULL,
	`weight_kg` real NOT NULL,
	`notes` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workout_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`workout_plan_id` text,
	`date` text NOT NULL,
	`cardio_minutes` integer DEFAULT 0 NOT NULL,
	`exercises` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
