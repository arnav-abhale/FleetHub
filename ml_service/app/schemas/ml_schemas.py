from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DriverIntelligenceProfile(BaseModel):
    driver_id: str
    driver_name: str
    overall_score: float = Field(..., ge=0, le=100)
    safety_score: float = Field(..., ge=0, le=100)
    consistency_score: float = Field(..., ge=0, le=100)
    delivery_reliability_score: float = Field(..., ge=0, le=100)
    fragile_suitability_score: float = Field(..., ge=0, le=100)
    long_distance_suitability_score: float = Field(..., ge=0, le=100)
    fuel_efficiency_score: float = Field(..., ge=0, le=100)
    risk_classification: str = Field(..., description="Low, Moderate, or High")
    safety_grade: str = Field(..., description="A, B, or C")
    total_trips_completed: int = 0
    punctuality_rate: float = Field(..., ge=0, le=100)
    harsh_braking_rate: float = Field(default=0.0, description="Events per 100km")
    rapid_acceleration_rate: float = Field(default=0.0, description="Events per 100km")
    speeding_rate: float = Field(default=0.0, description="Events per 100km")
    incident_count: int = 0
    assessment_summary: str
    key_strengths: List[str] = []
    improvement_areas: List[str] = []
    monthly_trend: List[Dict[str, Any]] = []
    is_improving: bool = True

class FleetIntelligenceDashboard(BaseModel):
    overall_fleet_safety_score: float
    total_drivers_analyzed: int
    total_high_risk_drivers: int
    total_moderate_risk_drivers: int
    total_low_risk_drivers: int
    top_performing_drivers: List[DriverIntelligenceProfile]
    coaching_candidates: List[DriverIntelligenceProfile]
    driver_rankings: List[DriverIntelligenceProfile]
    score_distribution: Dict[str, int]
    monthly_performance_trends: List[Dict[str, Any]]

class DeliveryRequirements(BaseModel):
    request_id: Optional[str] = None
    pickup_address: str
    drop_address: str
    package_category: str = "Standard Freight"
    weight_kg: float = 10.0
    handle_with_care: bool = False
    priority: str = "normal"  # urgent, high, normal, low
    distance_km: float = 45.0
    estimated_cost: Optional[float] = None
    required_vehicle_type: Optional[str] = None
    delivery_deadline: Optional[str] = None

class RecommendedDriverMatch(BaseModel):
    driver_id: str
    driver_name: str
    employee_code: str
    avatar_url: Optional[str] = None
    phone_number: Optional[str] = None
    assigned_vehicle: Optional[str] = None
    vehicle_capacity_kg: Optional[float] = None
    status: str
    is_eligible: bool = True
    suitability_score: float = Field(..., ge=0, le=100)
    safety_score: float = Field(..., ge=0, le=100)
    reliability_score: float = Field(..., ge=0, le=100)
    risk_level: str
    rank: int
    reason_summary: str
    match_reasons: List[str]
    confidence_level: float = Field(default=0.95, ge=0, le=1.0)
    scenario_matched: str  # Fragile Delivery, Long-Distance, High-Value, Standard

class DriverRecommendationResponse(BaseModel):
    delivery_summary: Dict[str, Any]
    scenario: str
    total_eligible_evaluated: int
    top_recommendations: List[RecommendedDriverMatch]
    fallback_applied: bool = False
    model_version: str = "1.0.0-rf-gbdt"

class TripCompletionFeedback(BaseModel):
    trip_id: str
    delivery_id: str
    driver_id: str
    vehicle_id: str
    distance_km: float
    duration_minutes: int
    driving_score: float
    harsh_braking_events: int = 0
    rapid_acceleration_events: int = 0
    speeding_events: int = 0
    sharp_cornering_events: int = 0
    has_incident: bool = False
    incident_detail: Optional[str] = None
    handle_with_care: bool = False
    is_on_time: bool = True
    fuel_efficiency_km_l: Optional[float] = None
