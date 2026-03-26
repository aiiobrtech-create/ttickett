-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platforms JSONB DEFAULT '[]',
  categories JSONB DEFAULT '[]',
  address TEXT,
  phone TEXT,
  contactPerson TEXT,
  email TEXT,
  observations TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Platforms table
CREATE TABLE IF NOT EXISTS platforms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  env TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Categories table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "desc" TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Users table (Linked to Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'client',
  avatar TEXT,
  "organizationId" UUID REFERENCES organizations(id),
  phone TEXT,
  whatsapp TEXT,
  observations TEXT,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Tickets table
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  number TEXT NOT NULL UNIQUE,
  requester TEXT NOT NULL,
  "requesterEmail" TEXT NOT NULL,
  "requesterUid" UUID,
  "organizationId" UUID REFERENCES organizations(id),
  platform TEXT,
  category TEXT,
  subject TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Aberto',
  urgency TEXT NOT NULL DEFAULT 'Média',
  assignee TEXT,
  "estimatedDeadline" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
  messages JSONB DEFAULT '[]',
  attachment JSONB
);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Security Definer Function to check admin status using JWT metadata (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin';
END;
$$ LANGUAGE plpgsql STABLE;

-- Policies for Organizations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Organizations are viewable by authenticated users' AND tablename = 'organizations') THEN
    CREATE POLICY "Organizations are viewable by authenticated users" ON organizations
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Organizations are manageable by admins' AND tablename = 'organizations') THEN
    CREATE POLICY "Organizations are manageable by admins" ON organizations
      FOR ALL USING (is_admin());
  END IF;
END $$;

-- Policies for Platforms
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platforms are viewable by authenticated users' AND tablename = 'platforms') THEN
    CREATE POLICY "Platforms are viewable by authenticated users" ON platforms
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Platforms are manageable by admins' AND tablename = 'platforms') THEN
    CREATE POLICY "Platforms are manageable by admins" ON platforms
      FOR ALL USING (is_admin());
  END IF;
END $$;

-- Policies for Categories
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Categories are viewable by authenticated users' AND tablename = 'categories') THEN
    CREATE POLICY "Categories are viewable by authenticated users" ON categories
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Categories are manageable by admins' AND tablename = 'categories') THEN
    CREATE POLICY "Categories are manageable by admins" ON categories
      FOR ALL USING (is_admin());
  END IF;
END $$;

-- Policies for Users
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own profile' AND tablename = 'users') THEN
    CREATE POLICY "Users can view their own profile" ON users
      FOR SELECT USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own profile' AND tablename = 'users') THEN
    CREATE POLICY "Users can update their own profile" ON users
      FOR UPDATE USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can view all users' AND tablename = 'users') THEN
    CREATE POLICY "Admins can view all users" ON users
      FOR SELECT USING (is_admin());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all users' AND tablename = 'users') THEN
    CREATE POLICY "Admins can manage all users" ON users
      FOR ALL USING (is_admin());
  END IF;
END $$;

-- Policies for Tickets
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can view their own tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "Clients can view their own tickets" ON tickets
      FOR SELECT USING (
        auth.uid() = "requesterUid" OR 
        (EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() AND users.role = 'client' AND users."organizationId" = tickets."organizationId"
        ))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Clients can create tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "Clients can create tickets" ON tickets
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Agents can view and update assigned tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "Agents can view and update assigned tickets" ON tickets
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.id = auth.uid() AND users.role = 'agent' AND users.name = tickets.assignee
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can manage all tickets' AND tablename = 'tickets') THEN
    CREATE POLICY "Admins can manage all tickets" ON tickets
      FOR ALL USING (is_admin());
  END IF;
END $$;
