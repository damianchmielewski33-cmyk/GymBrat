ALTER TABLE `users` ADD `last_active_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `inactivity_warned_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `photos_warned_at` integer;
