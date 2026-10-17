CREATE TABLE `group_workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`host_user_id` text NOT NULL,
	`title` text DEFAULT 'Trening grupowy' NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`host_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `group_workout_sessions_team_status_idx` ON `group_workout_sessions` (`team_id`,`status`);
--> statement-breakpoint
CREATE INDEX `group_workout_sessions_host_idx` ON `group_workout_sessions` (`host_user_id`,`status`);
--> statement-breakpoint
CREATE TABLE `group_workout_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'joined' NOT NULL,
	`presence_json` text DEFAULT '{}' NOT NULL,
	`joined_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `group_workout_sessions`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `group_workout_participants_session_user_uidx` ON `group_workout_participants` (`session_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `group_workout_participants_session_status_idx` ON `group_workout_participants` (`session_id`,`status`);
