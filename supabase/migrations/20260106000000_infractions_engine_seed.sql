-- Shinã Infractions Engine — seed (bucket privado para documentos)
-- Mesma forma exata de contract-documents (10 MiB, PDF+imagens).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'infraction-documents', 'infraction-documents', false, 10485760,
  array['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do nothing;
