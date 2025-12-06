-- Migration to add detailed company profile fields
-- Run this in Supabase SQL Editor

-- Add new columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS employee_count TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS annual_revenue TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS monthly_budget TEXT DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS target_market TEXT,
ADD COLUMN IF NOT EXISTS challenges TEXT;

-- Update the RPC function to include new fields
CREATE OR REPLACE FUNCTION create_new_organization(
    org_name TEXT,
    org_industry TEXT,
    org_description TEXT,
    org_website TEXT,
    org_employee_count TEXT DEFAULT 'unknown',
    org_annual_revenue TEXT DEFAULT 'unknown',
    org_monthly_budget TEXT DEFAULT 'unknown',
    org_target_market TEXT DEFAULT NULL,
    org_challenges TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_org_id UUID;
    current_user_id UUID;
BEGIN
    current_user_id := auth.uid();
    
    INSERT INTO public.organizations (
        name, industry, description, website_url, 
        employee_count, annual_revenue, monthly_budget, target_market, challenges
    )
    VALUES (
        org_name, org_industry, org_description, org_website,
        org_employee_count, org_annual_revenue, org_monthly_budget, org_target_market, org_challenges
    )
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.profiles (id, organization_id, role)
    VALUES (current_user_id, new_org_id, 'admin')
    ON CONFLICT (id) DO UPDATE SET organization_id = new_org_id, role = 'admin';
    
    RETURN new_org_id;
END;
$$;
