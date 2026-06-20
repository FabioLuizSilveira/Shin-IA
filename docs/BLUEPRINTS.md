# Blueprints — Shinã Platform

> Last updated: 2026-06-20 (Milestone 1.1 — Documentation Alignment)

Blueprints are pre-configured industry templates that accelerate tenant onboarding. A Blueprint defines the default set of capabilities, workflows, commission plans, geofence rules, and tracking configurations for a specific fleet segment.

Blueprints are applied at tenant provisioning time but can be customized afterward in the relevant Studios.

---

## Blueprint Structure

```typescript
type Blueprint = {
  id: string;
  name: string;
  industry: string;
  capabilities: string[];           // Capability keys to enable
  defaultWorkflows: WorkflowRef[];  // Pre-configured workflow definitions
  defaultGeofences: GeofenceTemplate[];
  trackingConfig: TrackingConfig;
  commissionConfig: CommissionConfig | null;  // null if not applicable
  operatorRole: boolean;            // Whether the blueprint uses an Operator role
  telemetryMetrics: string[];       // Which telemetry readings to collect
};
```

---

## Blueprint: Mobility

**Industry:** Urban mobility / passenger transport  
**Use cases:** Ride-hailing, taxi fleets, employee shuttle services

### Capabilities

| Capability | Enabled |
|-----------|---------|
| `tracking.basic` | ✅ |
| `tracking.geofence` | ✅ |
| `tracking.telemetry` | ✅ |
| `tracking.history` | ✅ |
| `commission.basic` | ✅ |
| `commission.plans` | ✅ |
| `commission.campaigns` | ✅ |
| `commission.settlements` | ✅ |

### Tracking Configuration

| Setting | Default Value |
|---------|--------------|
| Position interval (moving) | 10 seconds |
| Position interval (idle) | 60 seconds |
| Speed threshold (alert) | 80 km/h |
| Idle threshold | 5 minutes |
| Trip detection: ignition on | ✅ |

### Telemetry Metrics

- `ignition` — on/off state
- `speed` — km/h
- `odometer` — cumulative km
- `fuel_level` — percentage
- `driver_id` — RFID/iButton identifier

### Geofence Templates

- **Service Area** — polygon defining operational zone; alert on exit
- **Base Depot** — circle around home location; detect arrival/departure
- **Airport Zone** — designated pickup/dropoff zones
- **Restricted Area** — areas where vehicles should not enter

### Operator Role

Mobility blueprint includes an **Operator** role by default — a driver-facing role with access to:
- Own active trip
- Own commission balance and transaction history
- Assigned vehicle status

### Commission Profile

- Type: Percentage of trip fare
- Settlement: Weekly
- Requires approval above configurable threshold

---

## Blueprint: Forklift

**Industry:** Intralogistics / warehouse operations  
**Use cases:** Distribution centers, manufacturing plants, cold storage facilities

### Capabilities

| Capability | Enabled |
|-----------|---------|
| `tracking.basic` | ✅ |
| `tracking.geofence` | ✅ |
| `tracking.telemetry` | ✅ |
| `tracking.history` | ✅ |
| `commission.basic` | ❌ |

### Tracking Configuration

| Setting | Default Value |
|---------|--------------|
| Position interval (moving) | 5 seconds |
| Position interval (idle) | 30 seconds |
| Speed threshold (alert) | 15 km/h (indoor) |
| Shock detection | ✅ |
| Impact severity threshold | Configurable |

### Telemetry Metrics

- `ignition` — on/off state
- `speed` — km/h (indoor)
- `odometer` — hours (operating hours, not km)
- `battery_voltage` — for electric forklifts
- `fork_height` — optional, requires additional sensor
- `driver_id` — operator badge/RFID
- `impact_g` — G-force shock measurement

### Geofence Templates

- **Charging Zone** — area where forklifts must be charged; alert if battery < 20% outside
- **Loading Bay** — entry/exit monitoring for dock utilization reporting
- **Cold Storage Zone** — time-limited access; alerts for prolonged dwell
- **Pedestrian Zone** — alert when forklift enters pedestrian-shared space

### Operator Role

Forklift blueprint includes an **Operator** role with access to:
- Own assigned forklift status and position
- Own operating hours
- Incident reporting (shock events)

### Commission Profile

Not applicable — forklift operations typically use operational KPIs rather than commission incentives.

---

## Blueprint: Truck Platform

**Industry:** Road freight / long-haul logistics  
**Use cases:** Trucking companies, logistics providers, freight brokers with own fleet

### Capabilities

| Capability | Enabled |
|-----------|---------|
| `tracking.basic` | ✅ |
| `tracking.geofence` | ✅ |
| `tracking.telemetry` | ✅ |
| `tracking.history` | ✅ |
| `commission.basic` | ✅ |
| `commission.plans` | ✅ |
| `commission.settlements` | ✅ |

### Tracking Configuration

| Setting | Default Value |
|---------|--------------|
| Position interval (moving) | 30 seconds |
| Position interval (idle) | 5 minutes |
| Speed threshold (alert) | 90 km/h |
| Idle threshold | 10 minutes |
| Harsh brake threshold | 0.4g |
| Harsh acceleration threshold | 0.4g |
| Driver fatigue monitoring | Optional (integration-dependent) |

### Telemetry Metrics

- `ignition` — on/off
- `speed` — km/h
- `odometer` — km
- `fuel_level` — liters or percentage
- `engine_rpm` — revolutions per minute
- `engine_temp` — celsius
- `brake_pedal` — boolean
- `driver_id` — tachograph or RFID
- `cargo_weight` — optional, requires axle sensor
- `door_status` — cargo door open/closed (optional)

### Geofence Templates

- **Loading Point** — shipper location; detect arrival and departure, calculate dwell time
- **Delivery Point** — consignee location; detect arrival for delivery confirmation
- **Toll Plaza** — automated toll passage detection
- **Rest Area** — mandatory rest stops; alert if driver doesn't stop within regulation window
- **Restricted Road** — roads where trucks > certain weight are prohibited
- **Border Crossing** — international freight; crossing events for customs documentation

### Operator Role

Truck Platform blueprint includes a **Driver** role with access to:
- Own active trip and route
- Own truck status and position
- Own commission balance and earnings
- Document upload (delivery confirmation photos)

### Commission Profile

- Type: Per-km or per-delivery (configurable)
- Modifiers: On-time bonus, fuel efficiency bonus
- Settlement: Bi-weekly
- Deductions: Fines and damages (configurable)

---

## Blueprint: Recovery Truck

**Industry:** Roadside assistance / vehicle recovery  
**Use cases:** Breakdown services, insurance recovery fleets, towing companies

### Capabilities

| Capability | Enabled |
|-----------|---------|
| `tracking.basic` | ✅ |
| `tracking.geofence` | ✅ |
| `tracking.telemetry` | ✅ |
| `tracking.history` | ✅ |
| `commission.basic` | ✅ |
| `commission.plans` | ✅ |
| `commission.campaigns` | ✅ |
| `commission.settlements` | ✅ |

### Tracking Configuration

| Setting | Default Value |
|---------|--------------|
| Position interval (moving) | 15 seconds |
| Position interval (idle) | 60 seconds |
| Real-time dispatch mode | ✅ (reduced interval to 5s when dispatched) |
| ETA calculation | ✅ |

### Telemetry Metrics

- `ignition` — on/off
- `speed` — km/h
- `odometer` — km
- `crane_deployed` — boolean (winch/crane operational state)
- `driver_id` — operator identification
- `job_status` — dispatched / on_scene / loading / en_route_delivery / completed

### Geofence Templates

- **Coverage Zone** — SLA coverage area; alert if a vehicle is stranded outside covered zone
- **Base Location** — dispatch hub; detect return after job completion
- **Exclusion Zone** — no-tow zones (private property, restricted areas)

### Operator Role

Recovery Truck blueprint includes an **Operator** role with access to:
- Assigned job details and customer location
- Own vehicle status and position
- Job completion reporting
- Own commission earnings per job

### Commission Profile

- Type: Per-job fixed + distance component
- Bonus: Night/weekend rate multiplier
- Campaign: Seasonal demand campaigns (storms, high-incident periods)
- Settlement: Weekly
- Approval required for disputed jobs

---

## Blueprint: Agriculture

**Industry:** Agribusiness / rural fleet  
**Use cases:** Crop farms, sugarcane operations, soybean farms, rural logistics

### Capabilities

| Capability | Enabled |
|-----------|---------|
| `tracking.basic` | ✅ |
| `tracking.geofence` | ✅ |
| `tracking.telemetry` | ✅ |
| `tracking.history` | ✅ |
| `commission.basic` | ❌ |

### Tracking Configuration

| Setting | Default Value |
|---------|--------------|
| Position interval (moving) | 30 seconds |
| Position interval (idle) | 5 minutes |
| Low-signal fallback | ✅ (store-and-forward for rural areas with poor connectivity) |
| Satellite fallback | Optional (additional hardware required) |

### Telemetry Metrics

- `ignition` — on/off
- `speed` — km/h
- `odometer` — hours (operating hours) and km
- `engine_rpm`
- `engine_temp`
- `fuel_level`
- `pto_status` — Power Take-Off engaged (for implements like harvesters)
- `implement_depth` — optional, for precision agriculture
- `field_id` — current field being worked (GPS-derived from geofence)
- `driver_id` — operator identification

### Geofence Templates

- **Farm Boundary** — full property perimeter; unauthorized exit alert
- **Field Zones** — individual field boundaries; track which fields have been worked
- **Storage Facility** — grain silos, warehouses; detect arrival/departure for logistics
- **Maintenance Yard** — equipment maintenance area; track machine downtimes
- **Restricted Conservation Area** — legally protected areas; compliance alerts

### Operator Role

Agriculture blueprint includes an **Operator** role (optional, disabled by default):
- Own assigned equipment status
- Own field coverage progress
- Equipment incident reporting

### Commission Profile

Not applicable — agricultural fleet management focuses on operational efficiency rather than commission structures.

---

## Applying a Blueprint

```
1. Select blueprint during tenant provisioning
      │
      ▼
2. Capabilities activated on tenant
      │
      ▼
3. Default workflows imported
      │
      ▼
4. Default geofence templates created
      │
      ▼
5. Tracking configuration applied
      │
      ▼
6. Commission plan skeleton created (if applicable)
      │
      ▼
7. Tenant admin notified to review and customize
```

Blueprints can be re-applied after provisioning in the Config Studio (replaces only factory-default values, preserving custom configuration).

Multiple blueprints cannot be combined — a tenant chooses one. Cross-industry deployments should start with the closest blueprint and customize.
