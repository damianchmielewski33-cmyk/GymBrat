CREATE TABLE `plan_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`previous_plan_json` text NOT NULL,
	`kind` text DEFAULT 'review' NOT NULL,
	`summary` text,
	`created_at` integer NOT NULL,
	`reverted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_plan_revisions_user_plan` ON `plan_revisions` (`user_id`,`plan_id`);
