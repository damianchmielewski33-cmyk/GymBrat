CREATE TABLE IF NOT EXISTS `waitlist_signups` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirm_token_hash` text,
	`confirm_expires_at` integer,
	`consent_version` text NOT NULL,
	`consent_at` integer NOT NULL,
	`confirmed_at` integer,
	`unsubscribed_at` integer,
	`notified_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `waitlist_signups_email` ON `waitlist_signups` (`email`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `waitlist_signups_status_created` ON `waitlist_signups` (`status`,`created_at`);
