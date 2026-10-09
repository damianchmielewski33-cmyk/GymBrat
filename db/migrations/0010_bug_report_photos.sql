CREATE TABLE IF NOT EXISTS `bug_report_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`bug_report_id` text NOT NULL,
	`data_url` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`bug_report_id`) REFERENCES `bug_reports`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `bug_report_photos_bug` ON `bug_report_photos` (`bug_report_id`);
