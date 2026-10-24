CREATE INDEX IF NOT EXISTS `idx_workouts_user_plan_date` ON `workouts` (`user_id`,`workout_plan_id`,`date`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_workouts_user_date` ON `workouts` (`user_id`,`date`);
