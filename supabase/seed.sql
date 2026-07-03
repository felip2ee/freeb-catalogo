-- FreeB — seed dos produtos (500ml). Imagens em public/produtos/<sabor>-500ml.svg.
-- Idempotente: rode quantas vezes quiser. Os outros tamanhos (300ml/1L/5L) são
-- criados pelo admin; a migration 0006 define preços/imagens de todos.

insert into public.products (id, name, description, volume, price, accent, tag, image_url) values
  ('suco-laranja-600',  'Suco de Laranja',  'Rico em Vitamina C',     '500ml', 12.50, 'orange', 'Best Seller', '/produtos/laranja-500ml.webp'),
  ('suco-goiaba-600',   'Suco de Acerola',  'Explosão de Vitamina C', '500ml', 12.50, 'pink',   null,          '/produtos/acerola-500ml.webp'),
  ('suco-caju-600',     'Suco de Caju',     'Pura polpa',             '500ml', 12.50, 'gold',   null,          '/produtos/caju-500ml.webp'),
  ('suco-maracuja-600', 'Suco de Maracujá', 'Calmante natural',       '500ml', 12.50, 'purple', null,          '/produtos/maracuja-500ml.webp')
on conflict (id) do update set
  name        = excluded.name,
  description = excluded.description,
  volume      = excluded.volume,
  price       = excluded.price,
  accent      = excluded.accent,
  tag         = excluded.tag,
  image_url   = excluded.image_url;
