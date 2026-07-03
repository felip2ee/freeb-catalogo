-- FreeB — Feature 4: tamanho do suco no snapshot do pedido.
-- Rode no Supabase SQL Editor DEPOIS da 0012. Idempotente.
--
--   order_items.size → snapshot do tamanho (products.volume) no momento da compra,
--   para o histórico não mudar se o produto for editado depois.
--   create_order passa a gravar o size; backfill preenche os pedidos antigos.

-- ── 1. Coluna de snapshot do tamanho ─────────────────────────────────────────
alter table public.order_items
  add column if not exists size text;

-- ── 2. create_order grava o size (lido de products.volume) ───────────────────
create or replace function public.create_order(
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
  v_order_id    uuid;
  v_created_at  timestamptz;
  v_code        text;
  v_total       numeric(10,2) := 0;
  v_item        jsonb;
  v_product     record;
  v_qty         int;
  v_name        text;
  v_email       text;
  v_phone       text;
  v_cpf         text;
  v_attempts    int := 0;
begin
  -- ── Validação do cliente ──────────────────────────────────────────────────
  v_name  := trim(p_customer->>'name');
  v_email := trim(p_customer->>'email');
  v_phone := trim(p_customer->>'phone');
  v_cpf   := regexp_replace(coalesce(p_customer->>'cpf', ''), '\D', '', 'g');

  if v_name is null or length(v_name) < 2 then
    raise exception 'invalid_name';
  end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email';
  end if;
  if length(v_cpf) <> 11 then
    raise exception 'invalid_cpf';
  end if;
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart';
  end if;

  -- ── Cliente: cria se não existir; NUNCA sobrescreve existente ─────────────
  insert into public.customers (name, email, phone, cpf, consent_at)
  values (v_name, v_email, v_phone, v_cpf, now())
  on conflict (cpf) do nothing
  returning id into v_customer_id;

  if v_customer_id is null then
    select id, name, email, phone
      into v_customer_id, v_name, v_email, v_phone
      from public.customers
      where cpf = v_cpf;
    update public.customers set consent_at = now() where id = v_customer_id;
  end if;

  -- ── Código único ──────────────────────────────────────────────────────────
  loop
    v_attempts := v_attempts + 1;
    v_code := 'FB-'
      || upper(substr(md5(gen_random_uuid()::text), 1, 5))
      || '-'
      || lpad(((floor(random() * 9000) + 1000))::int::text, 4, '0');
    exit when not exists (select 1 from public.orders where code = v_code);
    if v_attempts > 10 then
      raise exception 'code_generation_failed';
    end if;
  end loop;

  insert into public.orders (code, customer_id, status, payment_method, total)
  values (v_code, v_customer_id, 'pending', p_payment_method, 0)
  returning id, created_at into v_order_id, v_created_at;

  -- ── Itens: nome/preço/tamanho lidos do banco (snapshot) ───────────────────
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select id, name, price, volume
      into v_product
      from public.products
      where id = (v_item->>'product_id') and active = true;

    if not found then
      raise exception 'product_not_found: %', v_item->>'product_id';
    end if;

    insert into public.order_items (order_id, product_id, name, unit_price, quantity, size)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty, v_product.volume);

    v_total := v_total + (v_product.price * v_qty);
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  -- ── Retorno para o comprovante (inclui size) ──────────────────────────────
  return jsonb_build_object(
    'id',         v_order_id,
    'code',       v_code,
    'status',     'pending',
    'total',      v_total,
    'created_at', v_created_at,
    'customer', jsonb_build_object(
      'name', v_name, 'email', v_email, 'phone', v_phone, 'cpf', v_cpf
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'product_id', oi.product_id,
            'name',       oi.name,
            'unit_price', oi.unit_price,
            'quantity',   oi.quantity,
            'size',       oi.size
          ) order by oi.id
        ),
        '[]'::jsonb
      )
      from public.order_items oi
      where oi.order_id = v_order_id
    )
  );
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, text) from public;
revoke all on function public.create_order(jsonb, jsonb, text) from anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text) to service_role;

-- ── 3. Backfill (melhor esforço): tamanho atual do produto nos pedidos antigos ─
update public.order_items oi
  set size = p.volume
  from public.products p
  where oi.product_id = p.id
    and oi.size is null;
