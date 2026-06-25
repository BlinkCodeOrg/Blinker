CREATE TABLE `passwords` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`profile_id` text NOT NULL,
	`origin` text NOT NULL,
	`url` text NOT NULL,
	`username` text NOT NULL,
	`encrypted_password` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`source` text DEFAULT 'Flow' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_passwords_profile_id` ON `passwords` (`profile_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_passwords_profile_origin_username` ON `passwords` (`profile_id`,`origin`,`username`);
