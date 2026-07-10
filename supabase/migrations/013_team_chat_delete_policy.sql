-- Migration: Add missing DELETE RLS policy for team_chat table
-- Root cause: Without this policy, Supabase silently rejects all DELETE
-- operations due to RLS, returning no error and 0 affected rows.

-- Allow staff (owner/admin/member) to delete their OWN messages
CREATE POLICY "Staff can delete own team chat messages" ON public.team_chat
  FOR DELETE USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

-- Allow owners and admins to delete ANY message (moderation)
CREATE POLICY "Admins can delete any team chat message" ON public.team_chat
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
