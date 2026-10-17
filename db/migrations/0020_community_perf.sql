-- Community performance indexes (feed / comments / chat hot paths)
CREATE INDEX IF NOT EXISTS "team_posts_team_mod_created_idx" ON "team_posts" ("team_id","moderation_status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_posts_team_visible_created_idx" ON "team_posts" ("team_id","created_at") WHERE "deleted_at" IS NULL AND "moderation_status" = 'visible';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_post_comments_post_deleted_created_idx" ON "team_post_comments" ("post_id","deleted_at","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_post_comments_post_live_created_idx" ON "team_post_comments" ("post_id","created_at") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_channel_deleted_created_idx" ON "chat_messages" ("channel_id","deleted_at","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_messages_channel_live_created_idx" ON "chat_messages" ("channel_id","created_at") WHERE "deleted_at" IS NULL;
