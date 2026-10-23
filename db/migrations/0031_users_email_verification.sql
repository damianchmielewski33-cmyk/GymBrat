ALTER TABLE `users` ADD `email_verified_at` integer;
--> statement-breakpoint
ALTER TABLE `users` ADD `session_version` integer DEFAULT 0 NOT NULL;
