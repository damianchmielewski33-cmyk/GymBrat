CREATE TABLE `support_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`order_id` text,
	`contact_email` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created_at` integer NOT NULL,
	`due_at` integer NOT NULL,
	`resolved_at` integer,
	`admin_note` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `support_requests_status_created` ON `support_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `support_requests_user` ON `support_requests` (`user_id`,`created_at`);
