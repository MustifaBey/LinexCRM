BEGIN;
  -- Safely recreate the publication to ensure clean state
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

-- Add the required tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE team_chat, notifications, tickets, ticket_messages;
