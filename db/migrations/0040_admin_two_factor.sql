CREATE TABLE `admin_two_factor` (
	`user_id` text PRIMARY KEY NOT NULL,
	`secret_enc` text NOT NULL,
	`enabled_at` integer,
	`recovery_hashes` text DEFAULT '[]' NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` integer,
	`last_step` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
