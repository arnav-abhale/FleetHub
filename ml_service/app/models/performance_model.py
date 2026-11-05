from typing import Dict, Any
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor

class DriverPerformancePredictor:
    """
    Gradient Boosting Regressor that models expected driving performance and delivery reliability.
    """
    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            learning_rate=0.08,
            max_depth=4,
            random_state=42
        )
        self.is_fitted = False
        self._fit_default_baseline()

    def _get_feature_vector(self, features: Dict[str, float]) -> np.ndarray:
        return np.array([[
            features.get("overall_score", 85.0),
            features.get("safety_score", 85.0),
            features.get("consistency_score", 85.0),
            features.get("punctuality_rate", 92.0),
            features.get("route_consistency", 88.0),
            features.get("fuel_efficiency", 85.0),
            features.get("harsh_braking_rate", 1.0),
            features.get("rapid_accel_rate", 0.8),
        ]])

    def _fit_default_baseline(self):
        # Baseline training data mapping telemetry features to overall performance index
        X_train = np.array([
            [97.0, 96.0, 95.0, 98.0, 96.0, 94.0, 0.3, 0.2],
            [94.0, 93.0, 92.0, 96.0, 93.0, 90.0, 0.5, 0.4],
            [91.0, 90.0, 89.0, 94.0, 90.0, 88.0, 0.8, 0.6],
            [88.0, 86.0, 85.0, 90.0, 86.0, 84.0, 1.2, 1.0],
            [84.0, 82.0, 80.0, 87.0, 82.0, 80.0, 1.8, 1.5],
            [80.0, 78.0, 75.0, 83.0, 78.0, 75.0, 2.5, 2.0],
            [74.0, 70.0, 68.0, 78.0, 72.0, 70.0, 3.8, 3.2],
            [68.0, 62.0, 60.0, 70.0, 65.0, 62.0, 5.0, 4.2],
        ])
        y_train = np.array([96.5, 93.8, 90.5, 87.2, 83.0, 79.2, 72.5, 65.0])
        self.model.fit(X_train, y_train)
        self.is_fitted = True

    def predict_performance_index(self, features: Dict[str, float]) -> float:
        vec = self._get_feature_vector(features)
        pred = self.model.predict(vec)[0]
        return float(np.clip(pred, 0.0, 100.0))
