ALTER TABLE `workouts` ADD `operation_id` text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_workouts_user_operation` ON `workouts` (`user_id`,`operation_id`);
