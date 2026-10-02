-- Branding assets (logo / ikony) zarządzane z panelu admina
CREATE TABLE IF NOT EXISTS `app_branding_assets` (
	`slot` text PRIMARY KEY NOT NULL,
	`mime_type` text NOT NULL,
	`data_url` text NOT NULL,
	`updated_at` integer NOT NULL
);
