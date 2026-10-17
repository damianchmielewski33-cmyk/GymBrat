CREATE TABLE `chat_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_key` text NOT NULL,
	`kind` text NOT NULL,
	`team_id` text,
	`group_session_id` text,
	`challenge_id` text,
	`title` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`group_session_id`) REFERENCES `group_workout_sessions`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_channels_scope_uidx` ON `chat_channels` (`scope_key`);
--> statement-breakpoint
CREATE INDEX `chat_channels_kind_team_idx` ON `chat_channels` (`kind`,`team_id`);
--> statement-breakpoint
CREATE INDEX `chat_channels_group_session_idx` ON `chat_channels` (`group_session_id`);
--> statement-breakpoint
CREATE INDEX `chat_channels_challenge_idx` ON `chat_channels` (`challenge_id`);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`author_user_id` text NOT NULL,
	`body` text NOT NULL,
	`parent_message_id` text,
	`created_at` integer NOT NULL,
	`edited_at` integer,
	`deleted_at` integer,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `chat_messages_channel_created_idx` ON `chat_messages` (`channel_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `chat_messages_parent_idx` ON `chat_messages` (`parent_message_id`);
--> statement-breakpoint
CREATE INDEX `chat_messages_author_idx` ON `chat_messages` (`author_user_id`);
--> statement-breakpoint
CREATE TABLE `chat_message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`user_id` text NOT NULL,
	`emoji` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_message_reactions_uidx` ON `chat_message_reactions` (`message_id`,`user_id`,`emoji`);
--> statement-breakpoint
CREATE INDEX `chat_message_reactions_message_idx` ON `chat_message_reactions` (`message_id`);
--> statement-breakpoint
CREATE TABLE `chat_mentions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`mentioned_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`mentioned_user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `chat_mentions_message_idx` ON `chat_mentions` (`message_id`);
--> statement-breakpoint
CREATE INDEX `chat_mentions_user_idx` ON `chat_mentions` (`mentioned_user_id`);
--> statement-breakpoint
CREATE TABLE `chat_read_states` (
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`last_read_message_id` text,
	`last_read_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_read_states_uidx` ON `chat_read_states` (`user_id`,`channel_id`);
--> statement-breakpoint
CREATE INDEX `chat_read_states_channel_idx` ON `chat_read_states` (`channel_id`);
--> statement-breakpoint
CREATE TABLE `chat_typing` (
	`channel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_typing_uidx` ON `chat_typing` (`channel_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `chat_typing_updated_idx` ON `chat_typing` (`channel_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `chat_events` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_id` text NOT NULL,
	`actor_user_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`channel_id`) REFERENCES `chat_channels`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `chat_events_channel_created_idx` ON `chat_events` (`channel_id`,`created_at`);
