-- FreeB — seed COMPLETO do catálogo (consolidado).
-- Idempotente: rode quantas vezes quiser. Roda DEPOIS das migrations (precisa da
-- tabela public.categories da 0004 e da coluna products.category_id).
--
-- Já traz TUDO no valor final (não depende de rodar 0006/0009 depois):
--   • 4 tamanhos (300ml / 500ml / 1L / 5L) em public.categories
--   • 16 produtos = 4 sabores × 4 tamanhos, com preço/descrição/imagem/cor finais
--
-- Preços por tamanho:  300ml R$10,00 · 500ml R$12,50 · 1L R$18,50 · 5L R$55,00
-- Imagens em public/produtos/<sabor>-<tamanho>.webp (1L usa o arquivo 1000ml).
-- Ids: 500ml mantém o id legado (suco-<sabor>-600); demais usam suco-de-<sabor>-<tam>.

-- ── Categorias (tamanhos) ────────────────────────────────────────────────────
insert into public.categories (id, name, sort_order) values
  ('300ml', '300ml',    10),
  ('500ml', '500ml',    20),
  ('1l',    '1 litro',  30),
  ('5l',    '5 litros', 40)
on conflict (id) do update set name = excluded.name, sort_order = excluded.sort_order;

-- ── Produtos (4 sabores × 4 tamanhos) ────────────────────────────────────────
insert into public.products
  (id, name, description, volume, price, accent, tag, image_url, category_id, active) values
  -- Laranja (orange) — "Best Seller" no 500ml
  ('suco-de-laranja-300ml', 'Suco de Laranja', 'Rico em Vitamina C', '300ml',   10.00, 'orange', null,         '/produtos/laranja-300ml.webp',  '300ml', true),
  ('suco-laranja-600',      'Suco de Laranja', 'Rico em Vitamina C', '500ml',   12.50, 'orange', 'Best Seller','/produtos/laranja-500ml.webp',  '500ml', true),
  ('suco-de-laranja-1l',    'Suco de Laranja', 'Rico em Vitamina C', '1 litro', 18.50, 'orange', null,         '/produtos/laranja-1000ml.webp', '1l',    true),
  ('suco-de-laranja-5l',    'Suco de Laranja', 'Rico em Vitamina C', '5 litros',55.00, 'orange', null,         '/produtos/laranja-5l.webp',     '5l',    true),
  -- Acerola (pink) — id legado do 500ml era "goiaba"
  ('suco-de-acerola-300ml', 'Suco de Acerola', 'Explosão de Vitamina C', '300ml',   10.00, 'pink', null, '/produtos/acerola-300ml.webp',  '300ml', true),
  ('suco-goiaba-600',       'Suco de Acerola', 'Explosão de Vitamina C', '500ml',   12.50, 'pink', null, '/produtos/acerola-500ml.webp',  '500ml', true),
  ('suco-de-acerola-1l',    'Suco de Acerola', 'Explosão de Vitamina C', '1 litro', 18.50, 'pink', null, '/produtos/acerola-1000ml.webp', '1l',    true),
  ('suco-de-acerola-5l',    'Suco de Acerola', 'Explosão de Vitamina C', '5 litros',55.00, 'pink', null, '/produtos/acerola-5l.webp',     '5l',    true),
  -- Caju (gold)
  ('suco-de-caju-300ml', 'Suco de Caju', 'Pura polpa', '300ml',   10.00, 'gold', null, '/produtos/caju-300ml.webp',  '300ml', true),
  ('suco-caju-600',      'Suco de Caju', 'Pura polpa', '500ml',   12.50, 'gold', null, '/produtos/caju-500ml.webp',  '500ml', true),
  ('suco-de-caju-1l',    'Suco de Caju', 'Pura polpa', '1 litro', 18.50, 'gold', null, '/produtos/caju-1000ml.webp', '1l',    true),
  ('suco-de-caju-5l',    'Suco de Caju', 'Pura polpa', '5 litros',55.00, 'gold', null, '/produtos/caju-5l.webp',     '5l',    true),
  -- Maracujá (purple)
  ('suco-de-maracuja-300ml', 'Suco de Maracujá', 'Calmante natural', '300ml',   10.00, 'purple', null, '/produtos/maracuja-300ml.webp',  '300ml', true),
  ('suco-maracuja-600',      'Suco de Maracujá', 'Calmante natural', '500ml',   12.50, 'purple', null, '/produtos/maracuja-500ml.webp',  '500ml', true),
  ('suco-de-maracuja-1l',    'Suco de Maracujá', 'Calmante natural', '1 litro', 18.50, 'purple', null, '/produtos/maracuja-1000ml.webp', '1l',    true),
  ('suco-de-maracuja-5l',    'Suco de Maracujá', 'Calmante natural', '5 litros',55.00, 'purple', null, '/produtos/maracuja-5l.webp',     '5l',    true)
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  volume      = excluded.volume,
  price       = excluded.price,
  accent      = excluded.accent,
  tag         = excluded.tag,
  image_url   = excluded.image_url,
  category_id = excluded.category_id,
  active      = excluded.active;
