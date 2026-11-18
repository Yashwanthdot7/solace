-- =============================================================
-- Solace — demo data for a DEVELOPMENT project only.
-- Do NOT run this on your production database: the demo password
-- below is public.
--
-- Every demo account logs in with password:  demo-password-123
--   demo.elder@example.com      (role: elder)
--   demo.youth@example.com      (role: youth)
--   demo.organiser@example.com  (role: community)
--   demo.guardian@example.com   (role: guardian)
-- =============================================================

insert into public.users (id, email, password, name, role, locality, points, streak, score, goals, email_verified)
values
  ('00000000-0000-4000-8000-000000000001', 'demo.elder@example.com',
   '$2b$10$jtkmCciqWfpGDSjzpX0ABea7HmRquX.un.xn7oYtJZTid25WteLP6',
   'Demo Elder', 'elder', 'Jayanagar', 40, 3, 72, '["Meet new people"]', true),
  ('00000000-0000-4000-8000-000000000002', 'demo.youth@example.com',
   '$2b$10$jtkmCciqWfpGDSjzpX0ABea7HmRquX.un.xn7oYtJZTid25WteLP6',
   'Demo Youth', 'youth', 'Indiranagar', 25, 1, 70, '[]', true),
  ('00000000-0000-4000-8000-000000000003', 'demo.organiser@example.com',
   '$2b$10$jtkmCciqWfpGDSjzpX0ABea7HmRquX.un.xn7oYtJZTid25WteLP6',
   'Demo Organiser', 'community', 'Koramangala', 120, 5, 80, '[]', true),
  ('00000000-0000-4000-8000-000000000004', 'demo.guardian@example.com',
   '$2b$10$jtkmCciqWfpGDSjzpX0ABea7HmRquX.un.xn7oYtJZTid25WteLP6',
   'Demo Guardian', 'guardian', 'Bengaluru', 10, 1, 72, '[]', true)
on conflict (email) do nothing;

insert into public.posts (user_id, author, role, text, category, image, hearts)
values
  ('00000000-0000-4000-8000-000000000001', 'Demo Elder', 'elder',
   'Demo post: made fresh ragi dosas this morning. Anyone want to swap recipes?',
   'recipe', 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=900&q=70', 3),
  ('00000000-0000-4000-8000-000000000002', 'Demo Youth', 'youth',
   'Demo post: anyone up for a Cubbon Park walk this Sunday?',
   'fitness', 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=900&q=70', 5),
  ('00000000-0000-4000-8000-000000000003', 'Demo Organiser', 'community',
   'Demo post: trivia evening at the community hall, 6 PM. All ages welcome!',
   'event', 'https://images.unsplash.com/photo-1529390079861-591de354faf5?w=900&q=70', 8);

insert into public.organiser_tasks (title, audience, points, issued_by)
values
  ('Demo task: greet 3 neighbours by name today', 'all', 10, 'Demo Organiser'),
  ('Demo task: help one elder set up video calling', 'youth', 20, 'Demo Organiser');
