const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach((line) => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data: profiles, error: profileErr } = await supabase.from('profiles').select('id').limit(1);
  if (profileErr || !profiles || profiles.length === 0) {
    console.error('No profiles found or error:', profileErr);
    return;
  }
  const profileId = profiles[0].id;
  console.log('Using profile ID:', profileId);

  const { data, error } = await supabase.from('clients').insert({
    name: 'Test Client ' + Date.now(),
    contact_email: 'test@example.com',
    created_by: profileId,
  }).select();
  console.log('Insert Result:', { data, error });
}
test();
