CREATE TABLE IF NOT EXISTS `bug_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`description` text NOT NULL,
	`expected_behavior` text NOT NULL,
	`steps_to_reproduce` text NOT NULL,
	`priority` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bug_reports_status_created` ON `bug_reports` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bug_reports_user` ON `bug_reports` (`user_id`);
