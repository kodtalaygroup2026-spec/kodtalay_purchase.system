-- ---------------------------------------------------------------------------
-- 0019: เปลี่ยน format PR number เป็น PUR-YYMM-NNNN
-- ---------------------------------------------------------------------------

create or replace function public.next_pr_number()
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  yymm      text := to_char(now() at time zone 'Asia/Bangkok', 'YYMM');
  pattern   text := 'PUR-' || yymm || '-%';
  max_seq   integer;
  next_seq  integer;
begin
  perform pg_advisory_xact_lock(hashtext('PUR' || yymm));

  select coalesce(max(split_part(pr_number, '-', 3)::integer), 0)
  into max_seq
  from purchase_requisitions
  where pr_number like pattern;

  next_seq := max_seq + 1;
  return 'PUR-' || yymm || '-' || lpad(next_seq::text, 4, '0');
end;
$$;

grant execute on function public.next_pr_number() to authenticated;
