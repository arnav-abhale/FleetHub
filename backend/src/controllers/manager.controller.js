import * as requestService from '../services/delivery-request.service.js';
import * as deliveryService from '../services/delivery.service.js';
import * as concernService from '../services/concern.service.js';
import * as tripService from '../services/trip.service.js';
import * as performanceService from '../services/performance.service.js';
import * as driverService from '../services/driver.service.js';
import * as mlService from '../services/ml.service.js';

export const getDeliveryRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await requestService.getManagerDeliveryRequests(status);
    return res.status(200).json({
      success: true,
      message: 'Delivery requests fetched successfully',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeliveryRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const request = await requestService.getManagerDeliveryRequestById(id);
    return res.status(200).json({
      success: true,
      message: 'Delivery request details fetched successfully',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryRequestStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }
    const updated = await requestService.updateDeliveryRequestStatus(id, status);
    return res.status(200).json({
      success: true,
      message: 'Delivery request status updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const dispatchDelivery = async (req, res, next) => {
  try {
    const delivery = await deliveryService.dispatchDelivery(req.user.userId, req.body);
    return res.status(201).json({
      success: true,
      message: 'Delivery dispatched successfully',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeliveries = async (req, res, next) => {
  try {
    const { status } = req.query;
    const deliveries = await deliveryService.getManagerDeliveries(status);
    return res.status(200).json({
      success: true,
      message: 'Deliveries fetched successfully',
      data: deliveries,
    });
  } catch (error) {
    next(error);
  }
};

export const getDeliveryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const delivery = await deliveryService.getManagerDeliveryById(id);
    return res.status(200).json({
      success: true,
      message: 'Delivery details fetched successfully',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
};

export const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }
    const updated = await deliveryService.updateDeliveryStatus(id, status);
    return res.status(200).json({
      success: true,
      message: 'Delivery status updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverConcerns = async (req, res, next) => {
  try {
    const { status } = req.query;
    const concerns = await concernService.getManagerConcerns(status);
    return res.status(200).json({
      success: true,
      message: 'Driver concerns fetched successfully',
      data: concerns,
    });
  } catch (error) {
    next(error);
  }
};

export const reviewDriverConcern = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, managerReviewNotes } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'status is required' });
    }
    const reviewed = await concernService.reviewManagerConcern(req.user.userId, id, { status, managerReviewNotes });
    return res.status(200).json({
      success: true,
      message: 'Driver concern reviewed successfully',
      data: reviewed,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompletedTrips = async (req, res, next) => {
  try {
    const trips = await tripService.getManagerTrips();
    return res.status(200).json({
      success: true,
      message: 'Completed trips fetched successfully',
      data: trips,
    });
  } catch (error) {
    next(error);
  }
};

export const getCompletedTripById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const trip = await tripService.getManagerTripById(id);
    return res.status(200).json({
      success: true,
      message: 'Completed trip report fetched successfully',
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverPerformance = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const performance = await performanceService.getManagerDriverPerformance(driverId);
    return res.status(200).json({
      success: true,
      message: 'Driver performance data fetched successfully',
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

export const getAiRecommendations = async (req, res, next) => {
  try {
    const { requestId } = req.query;
    if (requestId) {
      // Find request details to run dynamic recommendation
      const request = await requestService.getManagerDeliveryRequestById(requestId).catch(() => null);
      if (request) {
        const mlRecs = await mlService.getDriverRecommendations(request);
        return res.status(200).json({
          success: true,
          message: 'Dynamic ML driver recommendations generated successfully',
          data: mlRecs,
        });
      }
    }
    const recommendations = await performanceService.getManagerAiRecommendations(requestId);
    return res.status(200).json({
      success: true,
      message: 'AI recommendations fetched successfully',
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

export const getFleetIntelligence = async (req, res, next) => {
  try {
    const intelligence = await mlService.getFleetIntelligence();
    return res.status(200).json({
      success: true,
      message: 'Fleet driver intelligence fetched successfully',
      data: intelligence,
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverIntelligence = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const profile = await mlService.getDriverIntelligenceProfile(driverId);
    return res.status(200).json({
      success: true,
      message: 'Driver intelligence profile fetched successfully',
      data: profile,
    });
  } catch (error) {
    next(error);
  }
};

export const recommendDrivers = async (req, res, next) => {
  try {
    const recommendations = await mlService.getDriverRecommendations(req.body);
    return res.status(200).json({
      success: true,
      message: 'Intelligent driver recommendations generated successfully',
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDelivery = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deliveryService.deleteDelivery(id);
    return res.status(200).json({
      success: true,
      message: 'Delivery deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const getDrivers = async (req, res, next) => {
  try {
    const drivers = await driverService.getAllDrivers();
    return res.status(200).json({
      success: true,
      message: 'Drivers list fetched successfully',
      data: drivers,
    });
  } catch (error) {
    next(error);
  }
};

export const getDriverById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const driver = await driverService.getDriverById(id);
    return res.status(200).json({
      success: true,
      message: 'Driver profile fetched successfully',
      data: driver,
    });
  } catch (error) {
    next(error);
  }
};

export const createDriver = async (req, res, next) => {
  try {
    const newDriver = await driverService.createDriver(req.body);
    return res.status(201).json({
      success: true,
      message: 'Driver profile created successfully',
      data: newDriver,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    await driverService.deleteDriver(id);
    return res.status(200).json({
      success: true,
      message: 'Driver profile deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

