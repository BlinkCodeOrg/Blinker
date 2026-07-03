CREATE INDEX IF NOT EXISTS `idx_history_urls_profile_last_visit` ON `history_urls` (`profile_id`,`last_visit_time`);
CREATE INDEX IF NOT EXISTS `idx_history_urls_profile_typed_last` ON `history_urls` (`profile_id`,`typed_count`,`last_visit_time`);
CREATE INDEX IF NOT EXISTS `idx_passwords_profile_origin` ON `passwords` (`profile_id`,`origin`);
CREATE INDEX IF NOT EXISTS `idx_passwords_profile_updated` ON `passwords` (`profile_id`,`updated_at`);
CREATE INDEX IF NOT EXISTS `idx_bookmarks_profile_updated` ON `bookmarks` (`profile_id`,`updated_at`);
CREATE INDEX IF NOT EXISTS `idx_downloads_profile_state_updated` ON `downloads` (`profile_id`,`state`,`updated_at`);
