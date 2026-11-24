create table if not exists rooms (
  code         text primary key,
  song_id      integer not null,
  track_index  integer not null default 0,
  title        text not null default '',
  artist       text not null default '',
  playing      boolean not null default false,
  position_ms  double precision not null default 0,
  anchor_ms    bigint not null default 0,
  speed        double precision not null default 1,
  seq          bigint not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists room_presence (
  room_code  text not null references rooms (code) on delete cascade,
  peer_id    text not null,
  last_seen  timestamptz not null default now(),
  primary key (room_code, peer_id)
);
