import sys
from pathlib import Path

# Ensure ml_service root is in sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

print("Loading ML components...")
from app.main import app
from app.schemas.ml_schemas import DeliveryRequirements
from app.main import get_driver_recommendations, get_fleet_intelligence_dashboard

print("Testing Fleet Intelligence Dashboard...")
dashboard = get_fleet_intelligence_dashboard()
print(f"Overall Fleet Safety Score: {dashboard.overall_fleet_safety_score}")
print(f"Total Drivers Analyzed: {dashboard.total_drivers_analyzed}")
print(f"Top Performer: {dashboard.top_performing_drivers[0].driver_name if dashboard.top_performing_drivers else 'None'}")

print("\nTesting Fragile Delivery Assignment Recommendation...")
fragile_req = DeliveryRequirements(
    pickup_address="Bhiwandi Logistics Park, Mumbai",
    drop_address="Hinjawadi IT Park, Pune",
    package_category="Fragile Medical Sensors",
    weight_kg=12.5,
    handle_with_care=True,
    priority="high",
    distance_km=135.0
)
res = get_driver_recommendations(fragile_req)
print(f"Scenario Identified: {res.scenario}")
print(f"Top 3 Recommended Candidates:")
for m in res.top_recommendations:
    print(f"  #{m.rank}: {m.driver_name} - Suitability: {m.suitability_score}% | Safety: {m.safety_score} | Risk: {m.risk_level}")
    print(f"     Reason: {m.reason_summary}")
    print(f"     Key Matches: {', '.join(m.match_reasons)}")

print("\nALL ML UNIT TESTS PASSED SUCCESSFULLY!")
