-- Add overlay title/subtitle for course card (parity with memberships/classes)
ALTER TABLE courses ADD COLUMN overlay_title TEXT;
ALTER TABLE courses ADD COLUMN overlay_subtitle TEXT;
