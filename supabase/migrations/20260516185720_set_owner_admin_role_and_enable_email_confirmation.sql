-- Set admin role for platform owner + backfill profiles.email for existing users
UPDATE public.profiles SET role = 'admin' WHERE email = 'charllesgst@gmail.com';

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id AND (p.email IS NULL OR p.email = '');
