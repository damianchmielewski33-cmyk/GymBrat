-- Priorytety: highest/medium/lowest → critical/normal/low; statusy open/fixed → analysis/retest
UPDATE `bug_reports` SET `priority` = 'critical' WHERE `priority` = 'highest';
--> statement-breakpoint
UPDATE `bug_reports` SET `priority` = 'normal' WHERE `priority` = 'medium';
--> statement-breakpoint
UPDATE `bug_reports` SET `priority` = 'low' WHERE `priority` = 'lowest';
--> statement-breakpoint
UPDATE `bug_reports` SET `status` = 'analysis' WHERE `status` = 'open';
--> statement-breakpoint
UPDATE `bug_reports` SET `status` = 'retest' WHERE `status` = 'fixed';
