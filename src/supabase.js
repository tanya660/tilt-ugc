import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://poluaucqywnvcdgeytdr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbHVhdWNxeXdudmNkZ2V5dGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNjAyOTQsImV4cCI6MjA4OTkzNjI5NH0.U0avQqPCLRAjDyc2gGHRTALc42fp-pV4ZWO9llXQexM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
