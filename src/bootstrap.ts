import { supabase } from './supabase';
import { MOCK_ORGANIZATIONS, MOCK_TICKETS, MOCK_PLATFORMS, MOCK_CATEGORIES } from './mockData';

export const bootstrapAdmin = async () => {
  try {
    // Check if we have data already
    const { count: orgCount } = await supabase.from('organizations').select('*', { count: 'exact', head: true });
    
    if (orgCount === 0) {
      console.log('Seeding organizations...');
      await supabase.from('organizations').insert(MOCK_ORGANIZATIONS);
    }

    const { data: scopeCompany } = await supabase
      .from('companies')
      .select('id')
      .order('createdAt', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { count: platformCount } = await supabase.from('platforms').select('*', { count: 'exact', head: true });
    if (platformCount === 0 && scopeCompany?.id) {
      console.log('Seeding platforms...');
      await supabase
        .from('platforms')
        .insert(MOCK_PLATFORMS.map((p) => ({ ...p, companyId: scopeCompany.id })));
    }

    const { count: categoryCount } = await supabase.from('categories').select('*', { count: 'exact', head: true });
    if (categoryCount === 0 && scopeCompany?.id) {
      console.log('Seeding categories...');
      await supabase
        .from('categories')
        .insert(MOCK_CATEGORIES.map((c) => ({ ...c, companyId: scopeCompany.id })));
    }

    // Seed a default admin user if not exists
    const adminEmail = 'admin@ttickett.com';
    const { data: existingAdmin } = await supabase.from('users').select('*').eq('email', adminEmail).single();
    
    if (!existingAdmin) {
      console.log('Seeding default admin user...');
      // Note: This only seeds the user record in the 'users' table.
      // The user still needs to be created in Supabase Auth for login to work.
      await supabase.from('users').insert({
        name: 'Administrador',
        email: adminEmail,
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    }

    console.log('Bootstrap completed successfully.');
  } catch (error) {
    console.error('Bootstrap failed:', error);
  }
};
