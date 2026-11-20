-- Pomodoro: a plain focus timer with 20-20-20 and drinking reminders. Times,
-- volumes and the running clock live in the browser's localStorage, so the
-- module only needs its row for access control.

insert into public.modules (id, name) values ('pomodoro', 'Pomodoro')
on conflict (id) do nothing;
