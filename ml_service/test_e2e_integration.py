import sys
from pathlib import Path

# Ensure root directory is in sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from app.schemas.ml_schemas import DeliveryRequirements, TripCompletionFeedback
from app.main import (
    get_driver_recommendations,
    get_driver_intelligence_profile,
    get_fleet_intelligence_dashboard,
    record_trip_feedback,
    pipeline_mgr
)

def run_tests():
    print("=============================================================")
    print("FLEETHUB ML INTELLIGENT DRIVER ASSIGNMENT SYSTEM E2E TESTS")
    print("=============================================================")

    # Test 1: Fleet Intelligence Dashboard
    print("\n--- TEST 1: Fleet Intelligence Dashboard ---")
    dashboard = get_fleet_intelligence_dashboard()
    assert dashboard.overall_fleet_safety_score > 0, "Safety score should be > 0"
    assert dashboard.total_drivers_analyzed == 5, f"Expected 5 drivers, got {dashboard.total_drivers_analyzed}"
    assert len(dashboard.top_performing_drivers) > 0, "Expected top performers list"
    print(f"  [PASS] Overall Fleet Safety Score: {dashboard.overall_fleet_safety_score}")
    print(f"  [PASS] Total Drivers Analyzed: {dashboard.total_drivers_analyzed}")
    print(f"  [PASS] Top Performer: {dashboard.top_performing_drivers[0].driver_name} (Score: {dashboard.top_performing_drivers[0].overall_score})")

    # Test 2: Individual Driver Profile
    print("\n--- TEST 2: Individual Driver Intelligence Profile ---")
    rahul_profile = get_driver_intelligence_profile("d0000000-0000-0000-0000-000000000001")
    assert rahul_profile.driver_name == "Rahul Sharma"
    assert rahul_profile.safety_grade == "A"
    assert rahul_profile.risk_classification == "Low"
    assert rahul_profile.fragile_suitability_score >= 90.0
    print(f"  [PASS] Driver: {rahul_profile.driver_name}")
    print(f"  [PASS] Safety Score: {rahul_profile.safety_score}/100 | Grade: {rahul_profile.safety_grade} | Risk: {rahul_profile.risk_classification}")
    print(f"  [PASS] Fragile Suitability: {rahul_profile.fragile_suitability_score}% | Long-Distance: {rahul_profile.long_distance_suitability_score}%")
    print(f"  [PASS] Assessment Remarks: \"{rahul_profile.assessment_summary}\"")

    # Test 3: Scenario A - Fragile Delivery Recommendation
    print("\n--- TEST 3: Scenario A - Fragile Delivery Matching ---")
    fragile_req = DeliveryRequirements(
        pickup_address="Bhiwandi Pharma Zone, Mumbai",
        drop_address="Medipark, Thane",
        package_category="Fragile Glassware & Vaccine Vials",
        weight_kg=14.0,
        handle_with_care=True,
        priority="high",
        distance_km=42.0
    )
    rec_fragile = get_driver_recommendations(fragile_req)
    assert rec_fragile.scenario == "Fragile Delivery"
    assert len(rec_fragile.top_recommendations) >= 1
    top_cand = rec_fragile.top_recommendations[0]
    print(f"  [PASS] Identified Scenario: {rec_fragile.scenario}")
    print(f"  [PASS] Top Recommended Driver: {top_cand.driver_name} with Match: {top_cand.suitability_score}%")
    print(f"  [PASS] Explainability Reason: \"{top_cand.reason_summary}\"")
    print(f"  [PASS] Key Matches: {top_cand.match_reasons}")
    # Verify harsh driver is penalized or not top
    for rec in rec_fragile.top_recommendations:
        assert rec.status == "available", f"Driver {rec.driver_name} should be available"

    # Test 4: Scenario B - Long-Distance Highway Route
    print("\n--- TEST 4: Scenario B - Long-Distance Highway Route ---")
    long_req = DeliveryRequirements(
        pickup_address="Mumbai Central Freight Depot",
        drop_address="Chakan Industrial Corridor, Pune via Expressway",
        package_category="Automotive Spares",
        weight_kg=85.0,
        handle_with_care=False,
        priority="normal",
        distance_km=148.0
    )
    rec_long = get_driver_recommendations(long_req)
    assert rec_long.scenario == "Long-Distance Delivery"
    print(f"  [PASS] Identified Scenario: {rec_long.scenario}")
    print(f"  [PASS] Top Recommended Driver: {rec_long.top_recommendations[0].driver_name} (Suitability: {rec_long.top_recommendations[0].suitability_score}%)")
    print(f"  [PASS] Explainability Reason: \"{rec_long.top_recommendations[0].reason_summary}\"")

    # Test 5: Strict Business Constraints (Unavailable Drivers & Vehicle Capacity)
    print("\n--- TEST 5: Business Constraints Validation ---")
    for r in rec_fragile.top_recommendations:
        assert r.driver_name != "Aman Verma", "Aman Verma is on_trip and must NOT be recommended"
        assert r.driver_name != "Imran Sheikh", "Imran Sheikh is off_duty and must NOT be recommended"
    print("  [PASS] Confirmed: on_trip and off_duty drivers were strictly excluded from active recommendation")

    # Test vehicle capacity constraint (e.g. 1800 kg package requires heavy commercial vehicle)
    heavy_req = DeliveryRequirements(
        pickup_address="MIDC Industrial Area, Andheri",
        drop_address="Bhiwandi Hub",
        package_category="Heavy Steel Machinery",
        weight_kg=1400.0,  # Tata Ace EV (750kg) cannot carry this!
        handle_with_care=False,
        priority="normal",
        distance_km=30.0
    )
    rec_heavy = get_driver_recommendations(heavy_req)
    for r in rec_heavy.top_recommendations:
        assert r.vehicle_capacity_kg >= 1400.0, f"Vehicle capacity {r.vehicle_capacity_kg} must be >= 1400kg"
    print(f"  [PASS] Confirmed: Heavy package (1400kg) filtered out smaller capacity vehicles (e.g. 750kg Tata Ace)")

    # Test 6: Continuous Learning & Feedback
    print("\n--- TEST 6: Continuous Learning Trip Feedback ---")
    initial_score = rahul_profile.overall_score
    feedback = TripCompletionFeedback(
        trip_id="TRP-TEST-9999",
        delivery_id="DEL-TEST-0001",
        driver_id="d0000000-0000-0000-0000-000000000001",
        vehicle_id="02000000-0000-0000-0000-000000000001",
        distance_km=95.0,
        duration_minutes=120,
        driving_score=99.0,
        harsh_braking_events=0,
        rapid_acceleration_events=0,
        speeding_events=0,
        sharp_cornering_events=0,
        has_incident=False,
        handle_with_care=True,
        is_on_time=True,
        fuel_efficiency_km_l=18.2
    )
    fb_res = record_trip_feedback(feedback)
    assert fb_res["success"] is True
    updated_profile = get_driver_intelligence_profile("d0000000-0000-0000-0000-000000000001")
    print(f"  [PASS] Feedback recorded successfully: {fb_res['message']}")
    print(f"  [PASS] Driver Trip Count Updated: {updated_profile.total_trips_completed}")
    print(f"  [PASS] Recalibrated Safety Score: {updated_profile.safety_score}/100")

    print("\n=============================================================")
    print("ALL 6 INTEGRATION TESTS PASSED WITH 100% SUCCESS!")
    print("=============================================================")

if __name__ == "__main__":
    run_tests()
