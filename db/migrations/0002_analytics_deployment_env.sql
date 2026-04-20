ALTER TABLE `page_views` ADD COLUMN `deployment_env` text;--> statement-breakpoint
ALTER TABLE `site_activity_log` ADD COLUMN `deployment_env` text;
