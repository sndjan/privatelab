-- Kreuzworträtsel: small crosswords, each opened by its secret link /k/<code>.
-- The puzzles live in the code (src/modules/crossword/puzzles.ts) and progress
-- stays in the solver's browser, so the module needs no tables. The module
-- page (/m/crossword) is the admin overview with links and QR codes.

insert into public.modules (id, name) values ('crossword', 'Kreuzworträtsel')
on conflict (id) do nothing;
