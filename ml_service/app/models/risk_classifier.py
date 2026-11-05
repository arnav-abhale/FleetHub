from typing import Dict, Any, Tuple
import numpy as np
from sklearn.ensemble import RandomForestClassifier

class DriverRiskClassifier:
    """
    Random Forest Classifier for categorizing driver safety risk:
    - Low Risk: Safe, defensive drivers with minimal telematics alerts.
    - Moderate Risk: Generally safe but occasional harsh braking/speeding.
    - High Risk: Frequent harsh events, high incident risk, requires coaching.
    """
    def __init__(self):
        self.classes_ = ["Low", "Moderate", "High"]
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=5,
            random_state=42,
            class_weight="balanced"
        )
        self.is_fitted = False
        self._fit_default_baseline()

    def _get_feature_vector(self, features: Dict[str, float]) -> np.ndarray:
        return np.array([[
            features.get("safety_score", 85.0),
            features.get("harsh_braking_rate", 1.0),
            features.get("rapid_accel_rate", 0.8),
            features.get("speeding_rate", 0.5),
            features.get("sharp_cornering_rate", 0.4),
            features.get("incident_rate", 0.0),
            features.get("consistency_score", 85.0),
        ]])

    def _fit_default_baseline(self):
        """Fits an initial baseline model with representative synthetic driver safety points."""
        X_train = np.array([
            # Low risk: High safety, low harsh rates, high consistency
            [98.0, 0.2, 0.2, 0.1, 0.1, 0.0, 96.0],
            [95.0, 0.4, 0.3, 0.2, 0.2, 0.0, 94.0],
            [92.0, 0.6, 0.5, 0.3, 0.3, 0.0, 91.0],
            [90.0, 0.8, 0.6, 0.4, 0.4, 0.0, 89.0],
            # Moderate risk: Mid safety (80-89), moderate rates
            [87.0, 1.4, 1.2, 0.8, 0.7, 0.0, 84.0],
            [84.0, 1.8, 1.5, 1.0, 0.9, 0.0, 80.0],
            [82.0, 2.2, 1.8, 1.2, 1.1, 0.05, 78.0],
            [80.0, 2.6, 2.0, 1.5, 1.3, 0.05, 76.0],
            # High risk: Low safety (<78), high events or incidents
            [75.0, 3.8, 3.2, 2.8, 2.2, 0.15, 68.0],
            [70.0, 4.5, 3.9, 3.5, 2.8, 0.25, 62.0],
            [65.0, 5.8, 4.8, 4.2, 3.4, 0.40, 55.0],
            [58.0, 7.2, 6.0, 5.5, 4.5, 0.60, 48.0],
        ])
        y_train = np.array([
            0, 0, 0, 0,  # Low
            1, 1, 1, 1,  # Moderate
            2, 2, 2, 2   # High
        ])
        self.model.fit(X_train, y_train)
        self.is_fitted = True

    def predict(self, features: Dict[str, float]) -> Tuple[str, float]:
        """
        Returns (predicted_class_name, confidence_probability)
        """
        vec = self._get_feature_vector(features)
        probs = self.model.predict_proba(vec)[0]
        best_idx = int(np.argmax(probs))
        confidence = float(probs[best_idx])
        return self.classes_[best_idx], confidence

    def retrain(self, X: np.ndarray, y: np.ndarray):
        self.model.fit(X, y)
        self.is_fitted = True
