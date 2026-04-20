CREATE TABLE `email_verification_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`purpose` text DEFAULT 'register' NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`consumed_at` integer,
	`send_count` integer DEFAULT 1 NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_sent_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_email_verification_codes_email_purpose` ON `email_verification_codes` (`email`,`purpose`);--> statement-breakpoint
CREATE INDEX `idx_email_verification_codes_expires` ON `email_verification_codes` (`expires_at`);
