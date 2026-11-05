from typing import List, Dict, Any, Optional
import numpy as np
from ..schemas.ml_schemas import DeliveryRequirements, RecommendedDriverMatch

class DriverSuitabilityRanker:
    """
    Intelligent Driver Recommendation Engine:
    Combines ML predictions (Risk Classification, Predicted Performance Index)
    with task-specific suitability weights and deterministic business constraints.
    """
    def __init__(self, risk_classifier, performance_predictor):
        self.risk_classifier = risk_classifier
        self.performance_predictor = performance_predictor

    def identify_scenario(self, req: DeliveryRequirements) -> str:
        if req.handle_with_care or "fragile" in req.package_category.lower() or "medical" in req.package_category.lower():
            return "Fragile Delivery"
        elif req.distance_km >= 80.0 or "expressway" in req.drop_address.lower() or "corridor" in req.drop_address.lower():
            return "Long-Distance Delivery"
        elif req.priority.lower() == "urgent" or (req.estimated_cost and req.estimated_cost >= 15000):
            return "High-Value Delivery"
        else:
            return "Standard Delivery"

    def evaluate_driver(
        self,
        driver: Dict[str, Any],
        features: Dict[str, float],
        req: DeliveryRequirements,
        scenario: str
    ) -> Optional[RecommendedDriverMatch]:
        """
        Evaluates a single driver for a specific delivery order.
        Returns None if hard constraints are violated (e.g. unavailable, vehicle too small).
        """
        driver_status = (driver.get("status") or "available").lower().replace("-", "_")
        
        # Hard Business Constraint 1: Driver Availability
        # Drivers who are currently on_trip or off_duty cannot be dispatched for a new active delivery
        if driver_status in ["on_trip", "off_duty", "inactive", "suspended"]:
            return None

        # Hard Business Constraint 2: Vehicle Capacity Check
        vehicle = driver.get("vehicle") or {}
        capacity_kg = float(vehicle.get("capacity_kg") or 1000.0)
        if req.weight_kg > capacity_kg:
            # Vehicle cannot carry this shipment
            return None

        # Predict ML Risk & Performance Index
        predicted_risk, risk_confidence = self.risk_classifier.predict(features)
        predicted_perf_idx = self.performance_predictor.predict_performance_index(features)

        safety_score = float(features.get("safety_score", 85.0))
        consistency_score = float(features.get("consistency_score", 85.0))
        harsh_braking_rate = float(features.get("harsh_braking_rate", 1.0))
        rapid_accel_rate = float(features.get("rapid_accel_rate", 0.8))
        punctuality_rate = float(features.get("punctuality_rate", 92.0))
        fuel_eff_score = float(features.get("fuel_efficiency", 85.0))
        fragile_exp = float(features.get("fragile_experience", 85.0))
        long_dist_exp = float(features.get("long_distance_experience", 80.0))
        incident_rate = float(features.get("incident_rate", 0.0))
        rating = float(driver.get("rating") or 4.5) / 5.0 * 100.0

        match_reasons: List[str] = []
        base_suitability = 0.0

        # Scenario-specific dynamic suitability weighting
        if scenario == "Fragile Delivery":
            # Scenario A: Fragile Cargo (handle_with_care)
            # Heavy weights on safety, smooth braking, and fragile experience
            braking_smoothness_score = max(0.0, 100.0 - (harsh_braking_rate * 25.0) - (rapid_accel_rate * 15.0))
            
            base_suitability = (
                0.35 * safety_score +
                0.25 * fragile_exp +
                0.20 * braking_smoothness_score +
                0.10 * consistency_score +
                0.10 * predicted_perf_idx
            )
            # Strict penalty for High Risk drivers on fragile deliveries
            if predicted_risk == "High":
                base_suitability -= 30.0
            elif predicted_risk == "Moderate":
                base_suitability -= 8.0

            if braking_smoothness_score >= 88.0:
                match_reasons.append(f"Exceptional braking discipline ({harsh_braking_rate:.1f} harsh stops/100km)")
            if fragile_exp >= 85.0:
                match_reasons.append("Proven track record on fragile & sensitive cargo")
            if consistency_score >= 88.0:
                match_reasons.append("High driving consistency across transit segments")

        elif scenario == "Long-Distance Delivery":
            # Scenario B: Long Distance (> 80 km or Highway Corridor)
            base_suitability = (
                0.30 * long_dist_exp +
                0.25 * punctuality_rate +
                0.15 * consistency_score +
                0.15 * fuel_eff_score +
                0.15 * safety_score
            )
            if long_dist_exp >= 85.0:
                match_reasons.append(f"Extensive long-haul route experience ({req.distance_km:.0f} km required)")
            if punctuality_rate >= 92.0:
                match_reasons.append(f"Reliable on-time highway arrival rate ({punctuality_rate:.1f}%)")
            if fuel_eff_score >= 85.0:
                match_reasons.append("Optimized fuel efficiency on expressway cruising")

        elif scenario == "High-Value Delivery":
            # Scenario C: High-Value Shipment (Urgent or expensive)
            incident_safety_factor = max(0.0, 100.0 - (incident_rate * 200.0))
            base_suitability = (
                0.35 * safety_score +
                0.25 * incident_safety_factor +
                0.20 * rating +
                0.20 * punctuality_rate
            )
            if incident_rate == 0:
                match_reasons.append("100% incident-free delivery record")
            if safety_score >= 90.0:
                match_reasons.append(f"Grade A safety rating ({safety_score:.0f}/100)")
            if rating >= 90.0:
                match_reasons.append("High client trust and positive delivery reviews")

        else:
            # Scenario D: Standard Freight Delivery
            base_suitability = (
                0.30 * predicted_perf_idx +
                0.25 * safety_score +
                0.25 * punctuality_rate +
                0.20 * rating
            )
            match_reasons.append("Balanced driving performance across urban sectors")
            if punctuality_rate >= 90.0:
                match_reasons.append(f"Consistent delivery punctuality ({punctuality_rate:.1f}%)")
            match_reasons.append("Vehicle capacity and availability immediately aligned")

        # Proximity / depot bonus (if depot matches or driver is in the same city)
        driver_city = str(driver.get("city") or "").lower()
        if any(c in req.pickup_address.lower() for c in ["mumbai", "pune", "thane", "nashik"]):
            for c in ["mumbai", "pune", "thane", "nashik"]:
                if c in req.pickup_address.lower() and c in driver_city:
                    base_suitability += 3.0
                    match_reasons.append(f"Located near dispatch hub ({c.title()})")
                    break

        final_suitability = float(np.clip(base_suitability, 10.0, 99.0))

        # Build natural language narrative explanation
        driver_name = driver.get("name") or driver.get("user", {}).get("fullName") or "Driver"
        first_name = driver_name.split()[0]
        if final_suitability >= 90.0:
            summary = f"{first_name} is an optimal candidate for this {scenario.lower()} with top safety marks ({safety_score:.0f}/100) and smooth handling discipline."
        elif final_suitability >= 80.0:
            summary = f"{first_name} is a reliable and available driver with strong punctuality and compliant vehicle capacity."
        else:
            summary = f"{first_name} is fully available and qualified, though historical telemetry shows slightly higher acceleration/braking variation."

        vehicle_name = vehicle.get("make_model") or vehicle.get("registration_number") or "Assigned Van"

        return RecommendedDriverMatch(
            driver_id=str(driver.get("id")),
            driver_name=driver_name,
            employee_code=str(driver.get("employee_code") or "DRV-100"),
            avatar_url=driver.get("avatar_url") or driver.get("user", {}).get("avatarUrl"),
            phone_number=driver.get("phone") or driver.get("user", {}).get("phoneNumber"),
            assigned_vehicle=vehicle_name,
            vehicle_capacity_kg=capacity_kg,
            status=driver_status,
            is_eligible=True,
            suitability_score=round(final_suitability, 1),
            safety_score=round(safety_score, 1),
            reliability_score=round(punctuality_rate, 1),
            risk_level=predicted_risk,
            rank=0,  # will be assigned post-ranking
            reason_summary=summary,
            match_reasons=match_reasons[:3],
            confidence_level=round(risk_confidence, 2),
            scenario_matched=scenario
        )

    def rank_drivers(
        self,
        drivers_data: List[Dict[str, Any]],
        driver_features_map: Dict[str, Dict[str, float]],
        req: DeliveryRequirements,
        top_k: int = 3
    ) -> List[RecommendedDriverMatch]:
        """
        Ranks all available eligible drivers and returns the top_k recommendations.
        """
        scenario = self.identify_scenario(req)
        evaluated_matches: List[RecommendedDriverMatch] = []

        for drv in drivers_data:
            drv_id = str(drv.get("id"))
            feats = driver_features_map.get(drv_id, {})
            match = self.evaluate_driver(drv, feats, req, scenario)
            if match is not None:
                evaluated_matches.append(match)

        # Sort descending by dynamically computed suitability score
        evaluated_matches.sort(key=lambda m: m.suitability_score, reverse=True)

        # Assign rank 1, 2, 3...
        for rank_idx, m in enumerate(evaluated_matches, start=1):
            m.rank = rank_idx

        return evaluated_matches[:top_k]
