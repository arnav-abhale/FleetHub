import os
import json
from pathlib import Path
from typing import Dict, Any, List
import numpy as np
import joblib

from .feature_extraction import extract_driver_features
from ..models.risk_classifier import DriverRiskClassifier
from ..models.performance_model import DriverPerformancePredictor

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MODELS_DIR = DATA_DIR / "trained_models"

class MLPipelineManager:
    def __init__(self):
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        self.risk_classifier = DriverRiskClassifier()
        self.performance_predictor = DriverPerformancePredictor()
        self.data_store: Dict[str, Any] = self._load_initial_data()
        self.driver_features_cache: Dict[str, Dict[str, float]] = {}
        self._recompute_all_features()

    def _load_initial_data(self) -> Dict[str, Any]:
        data_file = DATA_DIR / "historical_trips.json"
        if data_file.exists():
            with open(data_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"drivers": []}

    def _save_data(self):
        data_file = DATA_DIR / "historical_trips.json"
        with open(data_file, "w", encoding="utf-8") as f:
            json.dump(self.data_store, f, indent=2)

    def _recompute_all_features(self):
        for drv in self.data_store.get("drivers", []):
            drv_id = str(drv.get("id"))
            trips = drv.get("trips", [])
            feats = extract_driver_features(drv, trips)
            self.driver_features_cache[drv_id] = feats

    def get_driver_features(self, driver_id: str) -> Dict[str, float]:
        if driver_id in self.driver_features_cache:
            return self.driver_features_cache[driver_id]
        # Fallback to driver info in store
        for drv in self.data_store.get("drivers", []):
            if str(drv.get("id")) == driver_id:
                feats = extract_driver_features(drv, drv.get("trips", []))
                self.driver_features_cache[driver_id] = feats
                return feats
        return extract_driver_features({}, [])

    def record_trip_completion(self, trip_feedback: Dict[str, Any]):
        """
        Continuous Learning: Updates driver historical trip records and recalibrates scores
        without requiring full offline model retraining every single trip.
        """
        driver_id = str(trip_feedback.get("driver_id"))
        matched_driver = None
        for drv in self.data_store.get("drivers", []):
            if str(drv.get("id")) == driver_id:
                matched_driver = drv
                break

        if not matched_driver:
            matched_driver = {
                "id": driver_id,
                "name": trip_feedback.get("driver_name", "Driver"),
                "status": "available",
                "score": float(trip_feedback.get("driving_score", 85.0)),
                "total_trips_completed": 1,
                "trips": []
            }
            self.data_store.setdefault("drivers", []).append(matched_driver)

        # Append trip
        new_trip = {
            "trip_code": trip_feedback.get("trip_code") or f"TRP-{np.random.randint(9000, 9999)}",
            "distance_km": float(trip_feedback.get("distance_km", 40.0)),
            "duration_minutes": int(trip_feedback.get("duration_minutes", 60)),
            "driving_score": float(trip_feedback.get("driving_score", 85.0)),
            "harsh_braking_events": int(trip_feedback.get("harsh_braking_events", 0)),
            "rapid_acceleration_events": int(trip_feedback.get("rapid_acceleration_events", 0)),
            "speeding_events": int(trip_feedback.get("speeding_events", 0)),
            "sharp_cornering_events": int(trip_feedback.get("sharp_cornering_events", 0)),
            "has_incident": bool(trip_feedback.get("has_incident", False)),
            "handle_with_care": bool(trip_feedback.get("handle_with_care", False)),
            "is_on_time": bool(trip_feedback.get("is_on_time", True)),
            "fuel_efficiency_km_l": float(trip_feedback.get("fuel_efficiency_km_l", 15.0)),
        }
        matched_driver.setdefault("trips", []).append(new_trip)
        matched_driver["total_trips_completed"] = len(matched_driver["trips"])

        # Recalculate feature vector and save
        feats = extract_driver_features(matched_driver, matched_driver["trips"])
        self.driver_features_cache[driver_id] = feats
        matched_driver["score"] = feats["overall_score"]
        self._save_data()

    def sync_drivers_from_backend(self, backend_drivers: List[Dict[str, Any]]):
        """
        Synchronizes live driver statuses (available, on_trip, off_duty) and metadata from PostgreSQL.
        """
        for b_drv in backend_drivers:
            b_id = str(b_drv.get("id"))
            found = False
            for drv in self.data_store.get("drivers", []):
                if str(drv.get("id")) == b_id or drv.get("employee_code") == b_drv.get("employee_code"):
                    found = True
                    drv["status"] = b_drv.get("status", drv.get("status"))
                    drv["name"] = b_drv.get("name") or b_drv.get("user", {}).get("fullName") or drv.get("name")
                    if "vehicle" in b_drv and b_drv["vehicle"]:
                        drv["vehicle"] = b_drv["vehicle"]
                    break
            if not found:
                # Add as new driver entry
                self.data_store.setdefault("drivers", []).append({
                    "id": b_id,
                    "name": b_drv.get("name") or b_drv.get("user", {}).get("fullName") or "Driver",
                    "employee_code": b_drv.get("employee_code", "DRV-NEW"),
                    "phone": b_drv.get("phone") or b_drv.get("user", {}).get("phoneNumber", ""),
                    "city": b_drv.get("city", "Mumbai"),
                    "status": b_drv.get("status", "available"),
                    "score": float(b_drv.get("score") or 85.0),
                    "rating": float(b_drv.get("rating") or 4.5),
                    "total_trips_completed": int(b_drv.get("total_trips_completed") or 0),
                    "vehicle": b_drv.get("vehicle") or {"capacity_kg": 1000.0, "make_model": "Light Van"},
                    "trips": []
                })
        self._recompute_all_features()
