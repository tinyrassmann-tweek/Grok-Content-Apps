-- Dev seed: fixed tenant + Tiny user + demo artifacts
INSERT INTO tenants (id, name, stream, hipaa_mode)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Think Tank Solutions AI',
  'think_tank',
  false
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, tenant_id, email, oauth_sub, role)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'tiny@thinktanksolutionsai.com',
  'dev-tiny',
  'director'
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO artifacts (id, tenant_id, kind, title, acl, hipaa_local_only)
VALUES
  (
    'demo',
    '11111111-1111-1111-1111-111111111111',
    'doc',
    'Demo Artifact',
    '{"roles":["director","editor","viewer"]}'::jsonb,
    false
  ),
  (
    'demo-artifact',
    '11111111-1111-1111-1111-111111111111',
    'doc',
    'Mobile Demo Artifact',
    '{"roles":["director","editor","viewer"]}'::jsonb,
    false
  )
ON CONFLICT (id) DO NOTHING;
