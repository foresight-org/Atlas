-- Memory a Node publishes after a conversation.
--
-- Meld (and anything shaped like it) sends the graph, not the recording.
-- One row per session. Sending the same session again replaces the row.
-- The public API reads these rows and never the sterilized text that may
-- have been used, once, to derive a graph.

create table if not exists node_memory_bundles (
  id             text primary key,
  place_id       text not null,
  source         text not null default 'meld',
  session_id     text not null default '',
  session_label  text not null default '',
  session_at     text not null default '',
  payload        jsonb not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists node_memory_place_idx
  on node_memory_bundles (place_id, updated_at desc);

alter table node_memory_bundles enable row level security;
