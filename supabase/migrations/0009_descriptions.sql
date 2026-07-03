-- FreeB — novas descrições dos sucos (uma por sabor, vale para todos os tamanhos).
-- Rode no Supabase SQL Editor. Idempotente (pode rodar de novo sem problema).
--
--   Laranja  → destaque de vitamina C
--   Acerola  → tem ~30x mais vitamina C que a laranja; em vez de repetir
--              "pura polpa", destacamos isso ("Explosão de Vitamina C")
--   Caju     → pura polpa
--   Maracujá → efeito calmante natural

update public.products
  set description = 'Rico em Vitamina C'
  where name ilike '%laranja%';

update public.products
  set description = 'Explosão de Vitamina C'
  where name ilike '%acerola%';

update public.products
  set description = 'Pura polpa'
  where name ilike '%caju%';

-- Obs.: '%maracuj%' (sem o "a") casa "Maracujá" apesar do acento.
update public.products
  set description = 'Calmante natural'
  where name ilike '%maracuj%';
