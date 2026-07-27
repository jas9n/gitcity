CREATE TABLE `github_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `github_cache_expires_at_idx` ON `github_cache` (`expires_at`);