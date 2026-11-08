CREATE TABLE IF NOT EXISTS `supplement_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date_key` text NOT NULL,
	`name` text NOT NULL,
	`slot` text DEFAULT '' NOT NULL,
	`taken_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `supplement_intakes_uidx` ON `supplement_intakes` (`user_id`,`date_key`,`name`,`slot`);
