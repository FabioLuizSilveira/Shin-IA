-- Approval Steps
-- Individual approval steps within an approval workflow instance

create table if not exists approval_steps (
  id               uuid          primary key default gen_random_uuid(),
  approval_request_id uuid       not null,
  step_number      integer       not null,
  step_type        text          not null check (step_type in ('approval', 'notification', 'action')),
  required_role    text,         -- role key that can approve (nullable for specific user)
  required_user_id uuid,         -- specific user required (nullable for role-based)
  status           text          not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'skipped')),
  acted_by_id      uuid,         -- user who took action
  acted_at         timestamptz,
  comment          text,
  version          integer       not null default 1,
  metadata         jsonb         not null default '{}',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),

  constraint approval_steps_request_fk
    foreign key (approval_request_id) references approval_requests (id) on delete cascade,

  constraint approval_steps_acted_by_fk
    foreign key (acted_by_id) references user_profiles (id) on delete set null,

  unique (approval_request_id, step_number)
);

-- RLS: Via parent approval_requests table
alter table approval_steps enable row level security;
alter table approval_steps force row level security;

create policy "approval_steps_select"
  on approval_steps for select
  to authenticated
  using (
    exists (
      select 1 from approval_requests ar
      where ar.id = approval_steps.approval_request_id
      and (
        ar.tenant_id is null
        or ar.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
      )
    )
  );

create index approval_steps_approval_request_id_idx on approval_steps (approval_request_id);
create index approval_steps_step_number_idx on approval_steps (step_number);
create index approval_steps_status_idx on approval_steps (status);
create index approval_steps_acted_by_id_idx on approval_steps (acted_by_id);
