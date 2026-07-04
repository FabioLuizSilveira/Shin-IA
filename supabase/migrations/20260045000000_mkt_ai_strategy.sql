-- M-MKT-07: ai director strategy stored per campaign

alter table mkt_campaigns add column ai_strategy jsonb;
