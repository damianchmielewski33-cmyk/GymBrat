CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`privacy` text DEFAULT 'private' NOT NULL,
	`invite_code` text NOT NULL,
	`avatar_emoji` text DEFAULT '🏋️' NOT NULL,
	`banner_color` text DEFAULT '#1a1a1c' NOT NULL,
	`ranking_metric` text DEFAULT 'sessions' NOT NULL,
	`max_members` integer DEFAULT 50 NOT NULL,
	`member_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_invite_code_uidx` ON `teams` (`invite_code`);
--> statement-breakpoint
CREATE INDEX `teams_owner_created_idx` ON `teams` (`owner_user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `teams_privacy_name_idx` ON `teams` (`privacy`,`name`);
--> statement-breakpoint
CREATE INDEX `teams_archived_idx` ON `teams` (`archived_at`);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`muted_notifications` integer DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	`left_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_members_team_user_uidx` ON `team_members` (`team_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `team_members_user_status_idx` ON `team_members` (`user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `team_members_team_status_idx` ON `team_members` (`team_id`,`status`);
--> statement-breakpoint
CREATE TABLE `team_invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`invited_by_user_id` text NOT NULL,
	`invitee_user_id` text,
	`invitee_email` text,
	`role` text DEFAULT 'member' NOT NULL,
	`token` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`responded_at` integer,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`invited_by_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`invitee_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invitations_token_uidx` ON `team_invitations` (`token`);
--> statement-breakpoint
CREATE INDEX `team_invitations_team_status_idx` ON `team_invitations` (`team_id`,`status`);
--> statement-breakpoint
CREATE INDEX `team_invitations_invitee_user_idx` ON `team_invitations` (`invitee_user_id`,`status`);
--> statement-breakpoint
CREATE INDEX `team_invitations_invitee_email_idx` ON `team_invitations` (`invitee_email`,`status`);
