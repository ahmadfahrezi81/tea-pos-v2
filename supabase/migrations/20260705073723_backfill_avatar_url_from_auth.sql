UPDATE public.users u
SET avatar_url = a.raw_user_meta_data ->> 'avatar_url'
FROM auth.users a
WHERE u.id = a.id
  AND a.raw_user_meta_data ->> 'avatar_url' IS NOT NULL
  AND u.avatar_url IS NULL;
