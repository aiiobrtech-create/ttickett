-- Create the tickets bucket if it doesn't exist
-- Note: This usually needs to be done via the Supabase Dashboard or API, 
-- but these are the SQL commands to set up policies for it.

-- 1. Create the bucket (This might fail if already exists or if not allowed via SQL)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('tickets', 'tickets', true);

-- 2. Set up Storage Policies for the 'tickets' bucket

-- Allow public access to read files
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'tickets');

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'tickets' AND 
    auth.role() = 'authenticated'
  );

-- Allow users to update/delete their own files (optional, but good practice)
CREATE POLICY "Users can manage their own files" ON storage.objects
  FOR ALL USING (
    bucket_id = 'tickets' AND 
    auth.uid() = owner
  );
