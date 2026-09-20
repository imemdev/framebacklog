CREATE TABLE partner_access (user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, grants TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE invitation_access (hash TEXT PRIMARY KEY REFERENCES invitations(hash) ON DELETE CASCADE, grants TEXT NOT NULL);
INSERT INTO partner_access(user_id,grants)
SELECT m.user_id, COALESCE((SELECT json_group_object(id,json('["view-screens","comment","screen-review","view-ideas","ideas"]')) FROM projects),'{}') FROM members m WHERE m.role='partner';
