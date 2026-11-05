import prisma from '../lib/prisma.js';
import { generateEntityCode } from '../utils/codeGenerator.js';
import * as mlService from './ml.service.js';

const TRACKING_STAGES = [
  { sequence: 1, stageName: 'requested' },
  { sequence: 2, stageName: 'assigned' },
  { sequence: 3, stageName: 'reached_pickup' },
  { sequence: 4, stageName: 'package_picked_up' },
  { sequence: 5, stageName: 'in_transit' },
  { sequence: 6, stageName: 'reached_destination' },
  { sequence: 7, stageName: 'delivered' },
];

/**
 * Fleet Manager: Dispatch delivery (assign driver, vehicle, and create/update delivery record).
 */
export const dispatchDelivery = async (managerUserId, data) => {
  const manager = await prisma.fleetManager.findUnique({
    where: { userId: managerUserId },
  });

  if (!manager) {
    const error = new Error('Fleet manager profile not found');
    error.statusCode = 404;
    throw error;
  }

  const { requestId, driverId, vehicleId, priority, expectedDeliveryTime, amount, specialInstructions } = data;

  if (!requestId) {
    const error = new Error('requestId is required for dispatch');
    error.statusCode = 400;
    throw error;
  }

  const request = await prisma.deliveryRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    const error = new Error('Delivery request not found');
    error.statusCode = 404;
    throw error;
  }

  // Validate driver if supplied
  if (driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) {
      const error = new Error(`Driver with ID '${driverId}' not found`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Validate vehicle if supplied
  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) {
      const error = new Error(`Vehicle with ID '${vehicleId}' not found`);
      error.statusCode = 400;
      throw error;
    }
  }

  // Check if delivery already exists for this request
  let delivery = await prisma.delivery.findUnique({
    where: { requestId },
  });

  if (delivery) {
    // Update existing delivery assignment
    delivery = await prisma.delivery.update({
      where: { id: delivery.id },
      data: {
        managerId: manager.id,
        driverId: driverId ?? delivery.driverId,
        vehicleId: vehicleId ?? delivery.vehicleId,
        priority: priority ?? delivery.priority ?? request.priority,
        status: driverId ? 'assigned' : delivery.status,
        expectedDeliveryTime: expectedDeliveryTime ? new Date(expectedDeliveryTime) : delivery.expectedDeliveryTime,
        amount: amount ? parseFloat(amount) : delivery.amount ?? request.estimatedCost,
        specialInstructions: specialInstructions ?? delivery.specialInstructions ?? request.specialInstructions,
      },
    });
  } else {
    // Create new delivery
    const deliveryCode = generateEntityCode('DEL');
    delivery = await prisma.delivery.create({
      data: {
        deliveryCode,
        requestId: request.id,
        clientId: request.clientId,
        managerId: manager.id,
        driverId: driverId || null,
        vehicleId: vehicleId || null,
        status: driverId ? 'assigned' : 'unassigned',
        priority: priority || request.priority || 'normal',
        pickupLocation: request.pickupAddress,
        dropLocation: request.dropAddress,
        expectedDeliveryTime: expectedDeliveryTime ? new Date(expectedDeliveryTime) : null,
        amount: amount ? parseFloat(amount) : request.estimatedCost,
        specialInstructions: specialInstructions || request.specialInstructions,
      },
    });

    // Seed default tracking steps
    const trackingStepsData = TRACKING_STAGES.map((stage) => ({
      deliveryId: delivery.id,
      sequence: stage.sequence,
      stageName: stage.stageName,
      isCompleted: stage.stageName === 'requested' || (stage.stageName === 'assigned' && Boolean(driverId)),
      completedAt: stage.stageName === 'requested' || (stage.stageName === 'assigned' && Boolean(driverId)) ? new Date() : null,
    }));

    await prisma.deliveryTrackingStep.createMany({
      data: trackingStepsData,
    });
  }

  // Update DeliveryRequest status to approved / converted
  await prisma.deliveryRequest.update({
    where: { id: requestId },
    data: { status: 'approved' },
  });

  // Update Driver status to on_trip if assigned
  if (driverId) {
    await prisma.driver.update({
      where: { id: driverId },
      data: { status: 'on_trip' },
    });
  }

  return prisma.delivery.findUnique({
    where: { id: delivery.id },
    include: {
      request: true,
      client: { select: { companyName: true, contactPerson: true } },
      driver: { include: { user: { select: { fullName: true, phoneNumber: true } } } },
      vehicle: true,
      trackingSteps: { orderBy: { sequence: 'asc' } },
    },
  });
};

/**
 * Fleet Manager: List all deliveries with optional status filter.
 */
export const getManagerDeliveries = async (statusFilter) => {
  const where = statusFilter ? { status: statusFilter } : {};

  return prisma.delivery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { id: true, companyName: true, clientCode: true } },
      driver: { include: { user: { select: { fullName: true, avatarUrl: true } } } },
      vehicle: { select: { registrationNumber: true, makeModel: true } },
      trackingSteps: { orderBy: { sequence: 'asc' } },
    },
  });
};

/**
 * Fleet Manager: Get delivery by ID.
 */
export const getManagerDeliveryById = async (deliveryId) => {
  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      client: true,
      driver: { include: { user: { select: { fullName: true, phoneNumber: true, avatarUrl: true } } } },
      vehicle: true,
      request: true,
      trackingSteps: { orderBy: { sequence: 'asc' } },
      concerns: true,
      completedTrip: true,
    },
  });

  if (!delivery) {
    const error = new Error('Delivery not found');
    error.statusCode = 404;
    throw error;
  }

  return delivery;
};

/**
 * Fleet Manager: Update delivery status.
 */
export const updateDeliveryStatus = async (deliveryId, status) => {
  const validStatuses = ['unassigned', 'assigned', 'reached_pickup', 'package_picked_up', 'in_transit', 'reached_destination', 'completed', 'paused', 'cancelled'];
  if (!validStatuses.includes(status)) {
    const error = new Error(`Invalid status '${status}'`);
    error.statusCode = 400;
    throw error;
  }

  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) {
    const error = new Error('Delivery not found');
    error.statusCode = 404;
    throw error;
  }

  const updated = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status,
      actualDeliveryTime: status === 'completed' ? new Date() : delivery.actualDeliveryTime,
    },
    include: { trackingSteps: { orderBy: { sequence: 'asc' } } },
  });

  // If completed, update driver status to available & send trip completion feedback to ML service
  if (status === 'completed' && delivery.driverId) {
    await prisma.driver.update({
      where: { id: delivery.driverId },
      data: { status: 'available' },
    });

    // Fire continuous learning feedback asynchronously
    mlService.sendTripFeedback({
      delivery_id: delivery.id,
      driver_id: delivery.driverId,
      vehicle_id: delivery.vehicleId || '02000000-0000-0000-0000-000000000001',
      distance_km: 45.0,
      duration_minutes: 65,
      driving_score: 95.0,
      harsh_braking_events: 0,
      rapid_acceleration_events: 0,
      speeding_events: 0,
      sharp_cornering_events: 0,
      has_incident: false,
      handle_with_care: Boolean(delivery.specialInstructions && delivery.specialInstructions.toLowerCase().includes('fragile')),
      is_on_time: true,
      fuel_efficiency_km_l: 16.5,
    }).catch((err) => console.warn('[Continuous Learning Error]', err.message));
  }

  return updated;
};

/**
 * Driver: Get deliveries assigned to the logged-in driver.
 */
export const getDriverDeliveries = async (driverUserId) => {
  const driver = await prisma.driver.findUnique({
    where: { userId: driverUserId },
  });

  if (!driver) {
    const error = new Error('Driver profile not found');
    error.statusCode = 404;
    throw error;
  }

  return prisma.delivery.findMany({
    where: { driverId: driver.id },
    orderBy: { createdAt: 'desc' },
    include: {
      client: { select: { companyName: true, contactPerson: true, contactPhone: true } },
      vehicle: { select: { registrationNumber: true, makeModel: true } },
      trackingSteps: { orderBy: { sequence: 'asc' } },
    },
  });
};

/**
 * Driver: Get single delivery assigned to driver.
 */
export const getDriverDeliveryById = async (driverUserId, deliveryId) => {
  const driver = await prisma.driver.findUnique({
    where: { userId: driverUserId },
  });

  if (!driver) {
    const error = new Error('Driver profile not found');
    error.statusCode = 404;
    throw error;
  }

  const delivery = await prisma.delivery.findUnique({
    where: { id: deliveryId },
    include: {
      client: true,
      vehicle: true,
      request: true,
      trackingSteps: { orderBy: { sequence: 'asc' } },
      concerns: true,
    },
  });

  if (!delivery) {
    const error = new Error('Delivery not found');
    error.statusCode = 404;
    throw error;
  }

  if (delivery.driverId !== driver.id) {
    const error = new Error('Forbidden: Access denied to this delivery');
    error.statusCode = 403;
    throw error;
  }

  return delivery;
};

/**
 * Driver: Update tracking step stage for assigned delivery.
 */
export const updateDriverDeliveryTracking = async (driverUserId, deliveryId, stageName) => {
  const delivery = await getDriverDeliveryById(driverUserId, deliveryId);

  // Mark target tracking step as completed
  const trackingStep = await prisma.deliveryTrackingStep.findFirst({
    where: { deliveryId, stageName },
  });

  if (trackingStep) {
    await prisma.deliveryTrackingStep.update({
      where: { id: trackingStep.id },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });
  }

  // Update overall delivery status matching tracking stage
  let newStatus = delivery.status;
  if (stageName === 'reached_pickup') newStatus = 'reached_pickup';
  if (stageName === 'package_picked_up') newStatus = 'package_picked_up';
  if (stageName === 'in_transit') newStatus = 'in_transit';
  if (stageName === 'reached_destination') newStatus = 'reached_destination';
  if (stageName === 'delivered') newStatus = 'completed';

  const updatedDelivery = await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status: newStatus,
      actualDeliveryTime: stageName === 'delivered' ? new Date() : delivery.actualDeliveryTime,
    },
    include: { trackingSteps: { orderBy: { sequence: 'asc' } } },
  });

  if (stageName === 'delivered') {
    await prisma.driver.update({
      where: { id: delivery.driverId },
      data: { status: 'available' },
    });
  }

  return updatedDelivery;
};

/**
 * Fleet Manager: Delete a delivery (e.g. client cancellation).
 */
export const deleteDelivery = async (deliveryId) => {
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) {
    const error = new Error('Delivery not found');
    error.statusCode = 404;
    throw error;
  }

  await prisma.driverScheduleStop.deleteMany({ where: { deliveryId } }).catch(() => {});
  await prisma.driverConcern.deleteMany({ where: { deliveryId } }).catch(() => {});
  await prisma.completedTrip.deleteMany({ where: { deliveryId } }).catch(() => {});

  const deleted = await prisma.delivery.delete({ where: { id: deliveryId } });

  if (delivery.requestId) {
    await prisma.deliveryRequest.update({
      where: { id: delivery.requestId },
      data: { status: 'cancelled' },
    }).catch(() => {});
  }

  return deleted;
};

