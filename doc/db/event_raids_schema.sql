-- ============================================================================
-- UITS Event Raiders - Supabase Database Schema
-- Central Database Integration for User Roles, Submissions & Review Workflow
-- ============================================================================

-- 1. Create table for project-level roles (Admin, Moderator, Member)
CREATE TABLE IF NOT EXISTS public.event_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'mod', 'user')) DEFAULT 'user',
    assigned_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast user_id lookups
CREATE INDEX IF NOT EXISTS idx_event_roles_user_id ON public.event_roles(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.event_roles ENABLE ROW LEVEL SECURITY;

-- 2. Create table for event proposals and updates
CREATE TABLE IF NOT EXISTS public.event_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    user_email TEXT NOT NULL,
    user_name TEXT,
    submission_type TEXT NOT NULL CHECK (submission_type IN ('new', 'update')),
    raid_num INT,
    data JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id UUID REFERENCES auth.users(id),
    reviewer_email TEXT,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- Indexes for status and user lookups
CREATE INDEX IF NOT EXISTS idx_event_submissions_status ON public.event_submissions(status);
CREATE INDEX IF NOT EXISTS idx_event_submissions_user_id ON public.event_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_event_submissions_created_at ON public.event_submissions(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.event_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper Security-Definer Functions to Check Roles without Infinite RLS Recursion
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_event_admin(lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_roles
    WHERE user_id = lookup_user_id AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_event_staff(lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.event_roles
    WHERE user_id = lookup_user_id AND role IN ('admin', 'mod')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS Policies for event_roles
-- ============================================================================

-- Anyone authenticated can view roles (so users know their own role and staff can be identified)
DROP POLICY IF EXISTS "Authenticated users can view event roles" ON public.event_roles;
CREATE POLICY "Authenticated users can view event roles" ON public.event_roles
    FOR SELECT TO authenticated USING (true);

-- Only Admins can insert/update/delete moderator roles
DROP POLICY IF EXISTS "Admins can manage event roles" ON public.event_roles;
CREATE POLICY "Admins can manage event roles" ON public.event_roles
    FOR ALL TO authenticated
    USING (public.is_event_admin(auth.uid()))
    WITH CHECK (public.is_event_admin(auth.uid()));

-- ============================================================================
-- RLS Policies for event_submissions
-- ============================================================================

-- Authenticated users can insert their own submissions
DROP POLICY IF EXISTS "Users can insert own submissions" ON public.event_submissions;
CREATE POLICY "Users can insert own submissions" ON public.event_submissions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Regular users can view their own submissions; Admins and Mods can view ALL submissions
DROP POLICY IF EXISTS "Users can view submissions" ON public.event_submissions;
CREATE POLICY "Users can view submissions" ON public.event_submissions
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.is_event_staff(auth.uid()));

-- Admins and Mods can update submissions (approve / reject / leave notes)
DROP POLICY IF EXISTS "Staff can review submissions" ON public.event_submissions;
CREATE POLICY "Staff can review submissions" ON public.event_submissions
    FOR UPDATE TO authenticated
    USING (public.is_event_staff(auth.uid()))
    WITH CHECK (public.is_event_staff(auth.uid()));

-- ============================================================================
-- How to Designate Initial Admin (Direct Database Modification)
-- ============================================================================
-- In Supabase SQL Editor or Table View:
-- Run the following command with the user's UUID:
--
-- INSERT INTO public.event_roles (user_id, role)
-- VALUES ('<YOUR-USER-UUID-HERE>', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin', updated_at = NOW();
