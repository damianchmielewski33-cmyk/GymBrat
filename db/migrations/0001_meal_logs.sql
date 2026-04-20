CREATE TABLE `meal_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`name` text,
	`calories` real NOT NULL,
	`protein_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`carbs_g` real NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_meal_logs_user_date` ON `meal_logs` (`user_id`,`date`);
