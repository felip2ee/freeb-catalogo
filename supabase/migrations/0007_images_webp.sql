-- FreeB — Repontar imagens de .svg → .webp (imagens otimizadas, ~24MB → ~0.9MB).
-- Rode no Supabase SQL Editor DEPOIS da 0006. Idempotente.
-- (Só necessário porque a 0006 foi aplicada antes com caminhos .svg.)

update public.products
  set image_url = replace(image_url, '.svg', '.webp')
  where image_url like '/produtos/%.svg';
