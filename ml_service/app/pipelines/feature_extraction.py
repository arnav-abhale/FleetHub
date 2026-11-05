from typing import List, Dict, Any
import numpy as np

def extract_driver_features(driver_data: Dict[str, Any], trips: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Extracts statistical & ML features from driver metadata and historical trip events.
    """
    total_trips = len(trips)
    if total_trips == 0:
        base_score = float(driver_data.get("score") or 85.0)
        return {
            "overall_score": base_score,
            "safety_score": base_score,
            "harsh_braking_rate": 0.5,
            "rapid_accel_rate": 0.4,
            "speeding_rate": 0.3,
            "sharp_cornering_rate": 0.2,
            "incident_rate": 0.0,
            "punctuality_rate": 95.0,
            "route_consistency": 90.0,
            "fuel_efficiency": 85.0,
            "fragile_experience": 85.0,
            "long_distance_experience": 80.0,
            "heavy_capacity_experience": 85.0,
            "total_distance_km": float(driver_data.get("total_trips_completed", 0) * 45),
            "total_trips": float(driver_data.get("total_trips_completed", 0)),
        }

    total_distance = sum(float(t.get("distance_km") or 35.0) for t in trips)
    dist_100km = max(total_distance / 100.0, 0.1)

    harsh_braking_total = sum(int(t.get("harsh_braking_events", 0)) for t in trips)
    rapid_accel_total = sum(int(t.get("rapid_acceleration_events", 0)) for t in trips)
    speeding_total = sum(int(t.get("speeding_events", 0)) for t in trips)
    cornering_total = sum(int(t.get("sharp_cornering_events", 0)) for t in trips)
    incidents_total = sum(1 for t in trips if t.get("has_incident", False))

    on_time_trips = sum(1 for t in trips if t.get("is_on_time", True))
    punctuality = (on_time_trips / total_trips) * 100.0

    scores = [float(t.get("driving_score") or 85.0) for t in trips]
    avg_score = float(np.mean(scores))
    score_variance = float(np.var(scores))
    consistency = max(0.0, min(100.0, 100.0 - np.sqrt(score_variance) * 4.0))

    # Fragile package handling history
    fragile_trips = [t for t in trips if t.get("handle_with_care", False)]
    if fragile_trips:
        fragile_success = (sum(1 for t in fragile_trips if not t.get("has_incident", False) and t.get("harsh_braking_events", 0) <= 1) / len(fragile_trips)) * 100.0
    else:
        # Infer from braking smoothness & safety score
        braking_penalty = min(harsh_braking_total / dist_100km * 10.0, 40.0)
        fragile_success = max(60.0, avg_score - braking_penalty)

    # Long distance experience (> 80 km)
    long_trips = [t for t in trips if float(t.get("distance_km") or 0) >= 80.0]
    long_dist_exp = min(100.0, (len(long_trips) / max(total_trips, 1)) * 140.0 + (avg_score * 0.3))

    # Fuel efficiency
    fuel_scores = [float(t.get("fuel_efficiency_km_l") or 14.0) for t in trips]
    avg_fuel_raw = float(np.mean(fuel_scores)) if fuel_scores else 14.0
    # Normalize 10 km/L (50 score) to 18 km/L (100 score)
    fuel_efficiency_score = max(50.0, min(100.0, (avg_fuel_raw - 10.0) * 6.25 + 50.0))

    # Safety Score calculation
    harsh_events_per_100km = (harsh_braking_total + rapid_accel_total + speeding_total + cornering_total) / dist_100km
    safety_score = max(30.0, min(100.0, avg_score - (harsh_events_per_100km * 2.5) - (incidents_total * 8.0)))

    return {
        "overall_score": avg_score,
        "safety_score": safety_score,
        "consistency_score": consistency,
        "harsh_braking_rate": harsh_braking_total / dist_100km,
        "rapid_accel_rate": rapid_accel_total / dist_100km,
        "speeding_rate": speeding_total / dist_100km,
        "sharp_cornering_rate": cornering_total / dist_100km,
        "incident_rate": incidents_total / max(total_trips, 1),
        "punctuality_rate": punctuality,
        "route_consistency": consistency,
        "fuel_efficiency": fuel_efficiency_score,
        "fragile_experience": fragile_success,
        "long_distance_experience": long_dist_exp,
        "heavy_capacity_experience": 88.0,
        "total_distance_km": total_distance,
        "total_trips": float(total_trips),
    }
