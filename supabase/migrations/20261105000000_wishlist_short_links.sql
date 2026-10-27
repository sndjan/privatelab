-- Wunsch-Liste: shorter share links, e.g. /w/k7qm2xpa9z instead of a UUID.
--
-- 10 characters from 32 that can't be mixed up (no 0/o, 1/l): about 50 bits,
-- far too many to guess. Existing UUID links keep working; "Neuen Link
-- erzeugen" switches a list to a short one.

create or replace function private.wishlist_share_token()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789abcdefghijkmnpqrstuvwxyz';
  bytes bytea := uuid_send(gen_random_uuid());
  token text := '';
  i integer;
begin
  -- gen_random_uuid() is cryptographically random apart from its version
  -- bits (bytes 6 and 8), which are skipped. 256 is a multiple of 32, so
  -- every character is equally likely.
  foreach i in array array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11] loop
    token := token || substr(alphabet, get_byte(bytes, i) % 32 + 1, 1);
  end loop;
  return token;
end;
$$;

revoke all on function private.wishlist_share_token() from public;
grant execute on function private.wishlist_share_token() to authenticated;

alter table public.wishlist_lists
  alter column share_token drop default,
  alter column share_token type text using share_token::text,
  alter column share_token set default private.wishlist_share_token(),
  add constraint wishlist_lists_share_token_check check (share_token ~ '^[0-9a-z-]{10,36}$');
