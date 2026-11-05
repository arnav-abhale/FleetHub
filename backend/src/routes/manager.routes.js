import express from 'express';
import * as managerController from '../controllers/manager.controller.js';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { authorize } from '../middleware/role.middleware.js';

const router = express.Router();

// All Fleet Manager routes require manager role authorization
router.use(authenticate, authorize('manager'));

// Manager Dashboard
router.get('/dashboard', dashboardController.getManagerDashboard);

// Delivery Requests Management
router.get('/delivery-requests', managerController.getDeliveryRequests);
router.get('/delivery-requests/:id', managerController.getDeliveryRequestById);
router.patch('/delivery-requests/:id/status', managerController.updateDeliveryRequestStatus);

// Dispatch & Delivery Management
router.post('/dispatch', managerController.dispatchDelivery);
router.post('/deliveries', managerController.dispatchDelivery);
router.get('/deliveries', managerController.getDeliveries);
router.get('/deliveries/:id', managerController.getDeliveryById);
router.patch('/deliveries/:id/status', managerController.updateDeliveryStatus);
router.delete('/deliveries/:id', managerController.deleteDelivery);

// Driver Concerns Review
router.get('/concerns', managerController.getDriverConcerns);
router.patch('/concerns/:id', managerController.reviewDriverConcern);

// Completed Trips Reports
router.get('/trips', managerController.getCompletedTrips);
router.get('/trips/:id', managerController.getCompletedTripById);

// Driver Management & Performance
router.get('/drivers', managerController.getDrivers);
router.post('/drivers', managerController.createDriver);
router.get('/drivers/:id', managerController.getDriverById);
router.delete('/drivers/:id', managerController.deleteDriver);
router.get('/drivers/:driverId/performance', managerController.getDriverPerformance);
router.get('/ai-recommendations', managerController.getAiRecommendations);

// ML-Powered Driver Intelligence & Recommendation Engine
router.get('/driver-intelligence', managerController.getFleetIntelligence);
router.get('/drivers/:driverId/intelligence', managerController.getDriverIntelligence);
router.post('/recommend-drivers', managerController.recommendDrivers);

export default router;
