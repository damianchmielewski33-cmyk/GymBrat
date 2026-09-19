ALTER TABLE `users` ADD `awp_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_awp_user_id_unique` ON `users` (`awp_user_id`);
