# Advanced Progress Tracking

The Advanced Progress Tracking feature allows studios to monitor member milestones, attendance trends, and performance metrics tailored to their specific business model (Yoga, Gym, or Hybrid).

## Overview

Studios can enable progress tracking via the Integrations settings. Once enabled, they select a "Studio Type" which determines the default metrics available to their members.

### Studio Types
| Type | Description | Primary Metrics |
|------|-------------|-----------------|
| **Yoga / Mindfulness** | Focused on consistency and practice duration. | Classes Attended, Minutes Practiced, Mindfulness Streaks. |
| **Gym / Fitness** | Focused on physical performance and load. | Weight Lifted, Cardio Duration, PRs. |
| **Hybrid** | A mix of both mindfulness and strength metrics. | All available metrics. |

## Data Model

### Metric Definitions (`progress_metric_definitions`)
Defines what can be tracked.
- `category`: mindfulness, strength, cardio, custom.
- `aggregation`: sum, max, avg, latest.
- `visibleToStudents`: Controls if members see this in their dashboard.

### Progress Entries (`member_progress_entries`)
Individual data points.
- `value`: The numerical value of the entry.
- `source`: auto (from attendance), manual (user input), import.

## API Integration

### Aggregation Logic
The `GET /progress/my-stats` endpoint performs real-time aggregation based on the metric definition's `aggregation` field.

```typescript
// Example aggregation query
const entries = await db.select()
    .from(memberProgressEntries)
    .where(and(
        eq(memberProgressEntries.memberId, memberId),
        eq(memberProgressEntries.metricDefinitionId, metric.id)
    ));

const value = entries.reduce((acc, entry) => {
    if (metric.aggregation === 'sum') return acc + entry.value;
    if (metric.aggregation === 'max') return Math.max(acc, entry.value);
    // ...
}, 0);
```

## UI Configuration

Studio owners manage settings in `studio.$slug.settings.integrations.tsx`. This includes:
1. Feature toggle (via `progress_tracking` feature key).
2. Studio Type selection (updates `tenants.settings`).
3. Default seeding (calls `POST /progress/seed-defaults`).

Members view their stats at `studio.$slug.progress.tsx`.
