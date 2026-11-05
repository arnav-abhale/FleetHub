# FleetHub Machine Learning Microservice

An intelligent driver profiling, risk classification, and dynamic delivery assignment recommendation service built with **Python 3.14**, **FastAPI**, **Pandas**, **NumPy**, and **Scikit-learn**.

---

## 1. Architecture Overview

```text
React / TanStack Frontend (Vite, Tailwind, Recharts)
        │
        ▼ HTTP REST / JWT
Node.js / Express Backend (Prisma ORM, PostgreSQL)
        │
        ▼ HTTP REST (Internal API)
Python FastAPI ML Microservice (Port 8000)
 ├── Feature Extraction Pipeline (Telematics & Historical Aggregation)
 ├── Random Forest Risk Classifier (Low / Moderate / High)
 ├── Gradient Boosting Performance Regressor
 ├── Multi-Criteria Dynamic Suitability Ranker (Scenarios A - D)
 └── Continuous Learning Ingestion Engine
```

---

## 2. Models & Scoring Logic

### A. Feature Extraction
Extracts statistical telematics indicators from historical trip telemetry:
- **Harsh Braking Rate** (`events / 100km`)
- **Rapid Acceleration Rate** (`events / 100km`)
- **Speeding Incident Rate** (`events / 100km`)
- **Sharp Cornering Rate** (`events / 100km`)
- **Driving Consistency**: Inverted variance of trip segment speeds.
- **Punctuality & Reliability**: On-time delivery completion ratio.
- **Fuel Efficiency**: Normalized km/L index.

### B. Machine Learning Models
1. **Random Forest Classifier**:
   - Predicts risk class (`Low`, `Moderate`, `High`) based on incident frequencies and telematics safety indicators.
2. **Gradient Boosting Regressor**:
   - Predicts driver baseline performance index across urban and highway corridors.
3. **Dynamic Scenario Ranker**:
   - Evaluates delivery parameters dynamically:
     - **Scenario A (Fragile)**: Heavy weight on safety score, braking smoothness, and historical fragile trip success.
     - **Scenario B (Long-Distance)**: Focus on highway efficiency, distance endurance, and shift time.
     - **Scenario C (High-Value)**: Zero incident record, trust rating, top tier safety marks.
     - **Scenario D (Standard)**: Proximity, vehicle capacity, balanced workload distribution.
   - Enforces hard constraints: strictly filters out `on_trip` or `off_duty` drivers and undersized vehicles.

---

## 3. API Endpoints

- `GET /health`: Service health and model status check.
- `POST /api/recommend`: Returns top 3 explainable driver recommendations for a delivery order.
- `GET /api/drivers/{driver_id}/profile`: Returns detailed 8-metric intelligence profile with AI remarks.
- `GET /api/fleet/dashboard`: Returns aggregate fleet metrics, score distributions, and rankings.
- `POST /api/trips/feedback`: Continuous learning hook updating driver records after trip completion.
- `POST /api/sync-drivers`: Synchronizes driver profiles directly from Node.js / PostgreSQL.

---

## 4. Running Locally

```bash
# 1. Activate Python virtual environment
.\venv\Scripts\activate

# 2. Install dependencies
pip install -r ml_service/requirements.txt

# 3. Start the FastAPI server
python ml_service/run.py
```
Default server URL: `http://127.0.0.1:8000`  
Interactive OpenAPI documentation: `http://127.0.0.1:8000/docs`

---

## 5. Verification & Testing

Run unit tests and end-to-end multi-scenario integration tests:
```bash
python ml_service/test_service.py
python ml_service/test_e2e_integration.py
```
