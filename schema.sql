-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create Enum Types
create type user_role as enum ('admin', 'empleado');
create type user_status as enum ('active', 'inactive');
create type gasto_estado as enum ('registrado', 'pendiente', 'aprobado');

-- Create Users Table (Public profile for Auth users)
create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role user_role not null default 'empleado',
  status user_status not null default 'active',
  created_at timestamptz default now()
);

-- Enable RLS on Users
alter table public.users enable row level security;

-- Policies for Users
create policy "Users can view their own profile" on public.users
  for select using (auth.uid() = id);

create policy "Admins can view all profiles" on public.users
  for select using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can update profiles" on public.users
  for update using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

-- Create Categories Table
create table public.categorias (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  creador_id uuid references public.users(id),
  activa boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS on Categories
alter table public.categorias enable row level security;

-- Policies for Categories
create policy "Everyone can view active categories" on public.categorias
  for select using (true);

create policy "Admins can manage categories" on public.categorias
  for all using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

-- Create Payment Methods Table
create table public.metodos_pago (
  id uuid default uuid_generate_v4() primary key,
  nombre text not null,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Enable RLS on Payment Methods
alter table public.metodos_pago enable row level security;

-- Policies for Payment Methods
create policy "Everyone can view active payment methods" on public.metodos_pago
  for select using (true);

create policy "Admins can manage payment methods" on public.metodos_pago
  for all using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

-- Create Expenses Table
create table public.gastos (
  id uuid default uuid_generate_v4() primary key,
  fecha date not null default CURRENT_DATE,
  monto numeric not null,
  categoria_id uuid references public.categorias(id),
  metodo_id uuid references public.metodos_pago(id),
  usuario_id uuid references public.users(id) not null,
  descripcion text,
  factura_url text,
  estado gasto_estado default 'registrado',
  created_at timestamptz default now()
);

-- Enable RLS on Expenses
alter table public.gastos enable row level security;

-- Policies for Expenses
create policy "Employees can view their own expenses" on public.gastos
  for select using (auth.uid() = usuario_id);

create policy "Admins can view all expenses" on public.gastos
  for select using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

create policy "Employees can insert their own expenses" on public.gastos
  for insert with check (auth.uid() = usuario_id);

create policy "Admins can update expenses" on public.gastos
  for update using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete expenses" on public.gastos
  for delete using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

-- Create Incomes Table
create table public.ingresos (
  id uuid default uuid_generate_v4() primary key,
  fecha date not null default CURRENT_DATE,
  monto numeric not null,
  metodo_id uuid references public.metodos_pago(id),
  usuario_id uuid references public.users(id) not null,
  descripcion text,
  tipo text, -- e.g., 'Venta', 'Servicio'
  origen text, -- e.g., 'Cliente X'
  archivo_url text,
  created_at timestamptz default now()
);

-- Enable RLS on Incomes
alter table public.ingresos enable row level security;

-- Policies for Incomes
create policy "Employees can view their own incomes" on public.ingresos
  for select using (auth.uid() = usuario_id);

create policy "Admins can view all incomes" on public.ingresos
  for select using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

create policy "Employees can insert their own incomes" on public.ingresos
  for insert with check (auth.uid() = usuario_id);

create policy "Admins can update incomes" on public.ingresos
  for update using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins can delete incomes" on public.ingresos
  for delete using (
    exists (
      select 1 from public.users where id = auth.uid() and role = 'admin'
    )
  );

-- Function to handle new user creation (Triggers)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role, status)
  values (new.id, new.email, 'empleado', 'active');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new auth users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Initial Data Seeding (Optional)
insert into public.categorias (nombre, activa) values
('Servicios', true),
('Arriendo', true),
('Nómina', true),
('Papelería', true),
('Proveedores', true),
('Ventas', true);

insert into public.metodos_pago (nombre, activo) values
('Efectivo', true),
('Nequi', true),
('Daviplata', true),
('Transferencia', true),
('Datafono', true);

-- Storage Buckets Setup (You need to run this or create them in UI)
insert into storage.buckets (id, name, public) values ('facturas', 'facturas', true);
insert into storage.buckets (id, name, public) values ('comprobantes', 'comprobantes', true);

-- Storage Policies
create policy "Authenticated users can upload facturas"
on storage.objects for insert to authenticated with check ( bucket_id = 'facturas' );

create policy "Authenticated users can view facturas"
on storage.objects for select to authenticated using ( bucket_id = 'facturas' );

create policy "Authenticated users can upload comprobantes"
on storage.objects for insert to authenticated with check ( bucket_id = 'comprobantes' );

create policy "Authenticated users can view comprobantes"
on storage.objects for select to authenticated using ( bucket_id = 'comprobantes' );
