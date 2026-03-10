-- Add custom_color for custom work types (hex, e.g. #3B82F6). Used when type_key = 'custom'.
alter table public.project_work_types
  add column if not exists custom_color text;

comment on column public.project_work_types.custom_color is 'Hex color for custom work types (e.g. #3B82F6). Only used when type_key = ''custom''.';
