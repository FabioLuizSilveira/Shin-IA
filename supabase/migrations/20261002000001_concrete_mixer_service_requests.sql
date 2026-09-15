-- Multi-Operation Business Architecture v2 — concrete-mixer-truck's own
-- dispatch runtime (same treatment as towing/water-tank-truck/
-- sand-gravel-transport). A concrete mixer service request IS an
-- operations row, not a new aggregate.
alter type operation_type add value if not exists 'concrete_mixer_service_request';
