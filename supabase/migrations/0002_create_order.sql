-- Néctar Pura — RPC de criação de pedido (Fase 2)
-- Transação atômica: upsert do cliente por CPF, criação do pedido e dos itens.
-- 🔒 Preço e nome vêm SEMPRE da tabela products (active = true) — nunca do cliente.
-- 🔒 SECURITY DEFINER + grant só para service_role: apenas o servidor cria pedidos.

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
  -- ── Validação do cliente (defesa no servidor, além do Zod no client) ──────
  v_name  := trim(p_customer->>'name');
  v_email := trim(p_customer->>'email');
  v_phone := trim(p_customer->>'phone');
  v_cpf   := regexp_replace(coalesce(p_customer->>'cpf', ''), '\D', '', 'g'); -- só dígitos

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

  -- ── Vínculo do cliente: upsert por CPF (mantém dados mais recentes) ───────
  insert into public.customers (name, email, phone, cpf)
  values (v_name, v_email, v_phone, v_cpf)
  on conflict (cpf) do update
    set name  = excluded.name,
        email = excluded.email,
        phone = excluded.phone
  returning id into v_customer_id;

  -- ── Geração do código único no banco, com retry em colisão ───────────────
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

  -- ── Cria o pedido (total será preenchido após somar os itens) ────────────
  insert into public.orders (code, customer_id, status, payment_method, total)
  values (v_code, v_customer_id, 'pending', p_payment_method, 0)
  returning id, created_at into v_order_id, v_created_at;

  -- ── Itens: preço e nome lidos do banco (snapshot), total somado aqui ─────
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item->>'quantity')::int;
    if v_qty is null or v_qty <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select id, name, price
      into v_product
      from public.products
      where id = (v_item->>'product_id') and active = true;

    if not found then
      raise exception 'product_not_found: %', v_item->>'product_id';
    end if;

    insert into public.order_items (order_id, product_id, name, unit_price, quantity)
    values (v_order_id, v_product.id, v_product.name, v_product.price, v_qty);

    v_total := v_total + (v_product.price * v_qty);
  end loop;

  update public.orders set total = v_total where id = v_order_id;

  -- ── Retorna o pedido completo para o comprovante ─────────────────────────
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
            'quantity',   oi.quantity
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

-- 🔒 Só o servidor (service_role) pode chamar a RPC. anon/authenticated não.
revoke all on function public.create_order(jsonb, jsonb, text) from public;
revoke all on function public.create_order(jsonb, jsonb, text) from anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, text) to service_role;
