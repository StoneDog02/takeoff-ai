-- Set app roles for Proj-X users.
-- Run this once in Supabase Dashboard → SQL Editor (uses service role / migration context).
-- Replace the emails below with your actual admin and PM emails.
--
-- Roles: profiles.role can be 'admin' | 'project_manager' | 'field_supervisor' | 'employee' | 'subcontractor'
-- - admin: full access including /admin (user list, stats). Only this role gets isAdmin and can open Admin.
-- - project_manager: full contractor portal (projects, teams, estimates, payroll, etc.) but no Admin.
-- New signups get 'project_manager' by default via trigger.

-- Set admin (e.g. you)
update public.profiles
set role = 'admin', updated_at = now()
where id in (select id from auth.users where email = 'stoney.harward@gmail.com');

-- Ensure PM has project_manager (optional; default on signup is already project_manager)
update public.profiles
set role = 'project_manager', updated_at = now()
where id in (select id from auth.users where email = 'gritconstruction2023@gmail.com');

-- Verify (optional): list profiles and roles
-- select p.id, u.email, p.role from public.profiles p join auth.users u on u.id = p.id order by p.role, u.email;
