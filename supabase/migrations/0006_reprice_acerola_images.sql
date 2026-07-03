-- FreeB — Reprecificação por tamanho + troca Goiaba→Acerola + imagens por sabor.
-- Rode no Supabase SQL Editor. Idempotente (pode rodar de novo sem problema).
--
-- Imagens ficam em public/produtos/<sabor>-<tamanho>.webp no próprio app
-- (image_url é caminho relativo, resolvido contra a origem do site).
-- Mapa de tamanho→arquivo: 300ml, 500ml, 1l→1000ml, 5l.

-- ── 1. Preços por tamanho (iguais para todos os sabores) ─────────────────────
update public.products set price = 10.00 where category_id = '300ml';
update public.products set price = 12.50 where category_id = '500ml';
update public.products set price = 18.50 where category_id = '1l';
update public.products set price = 55.00 where category_id = '5l';

-- ── 2. Goiaba → Acerola (renomeia; order_items preserva o nome histórico) ─────
-- ilike casa sem case; 'goiaba' não tem acento, então o padrão simples basta.
update public.products
  set name = 'Suco de Acerola',
      description = 'Rico em Vitamina C',
      accent = 'pink'
  where name ilike '%goiaba%';

-- ── 3. Imagens por sabor + tamanho ───────────────────────────────────────────
-- Obs.: '%maracuj%' (sem o "a") casa "Maracujá" apesar do acento.
update public.products
  set image_url = '/produtos/acerola-'  || case category_id when '1l' then '1000ml' else category_id end || '.webp'
  where name ilike '%acerola%';

update public.products
  set image_url = '/produtos/laranja-'  || case category_id when '1l' then '1000ml' else category_id end || '.webp'
  where name ilike '%laranja%';

update public.products
  set image_url = '/produtos/caju-'     || case category_id when '1l' then '1000ml' else category_id end || '.webp'
  where name ilike '%caju%';

update public.products
  set image_url = '/produtos/maracuja-' || case category_id when '1l' then '1000ml' else category_id end || '.webp'
  where name ilike '%maracuj%';
