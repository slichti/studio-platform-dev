-- Migration 0070: Add optional cohort end date to courses

ALTER TABLE `courses` ADD `cohort_end_date` integer;
