-- Chat's VIP level (task 068c): a member with the VIP badge, in the VIP chat (the chat once
-- called Admin); admin keeps managing chat. Only widens the check; v1 never reads it.
ALTER TABLE public.user_app_access DROP CONSTRAINT user_app_access_check;
ALTER TABLE public.user_app_access ADD CONSTRAINT user_app_access_check CHECK (
    (app = 'seller' AND access = 'member')
    OR (app = 'backoffice' AND access IN ('guest', 'admin'))
    OR (app = 'chat' AND access IN ('member', 'vip', 'admin'))
);
