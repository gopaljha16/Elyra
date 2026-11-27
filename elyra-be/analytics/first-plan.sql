-- Completed UTC weekly cohorts. Each member contributes once.
WITH cohort AS (
  SELECT e.entity, e.occurred_at FROM dating_events e
  WHERE e.kind = 'verified' AND NOT EXISTS (
    SELECT 1 FROM dating_events p WHERE p.kind = 'previously_verified' AND p.entity = e.entity
  ) AND date_trunc('week',e.occurred_at) + interval '21 days' <= CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
), outcomes AS (
  SELECT c.*, EXISTS (
    SELECT 1 FROM matches m JOIN dating_events p ON p.entity = m.id AND p.kind = 'confirmed'
    WHERE c.entity IN (m."user1Id", m."user2Id") AND p.occurred_at >= c.occurred_at
      AND p.occurred_at < c.occurred_at + interval '14 days'
  ) AS confirmed FROM cohort c
)
SELECT date_trunc('week',occurred_at) AS week, count(*) AS verified,
  count(*) FILTER (WHERE confirmed) AS confirmed_members, avg(confirmed::int) AS conversion
FROM outcomes GROUP BY 1 ORDER BY 1;
