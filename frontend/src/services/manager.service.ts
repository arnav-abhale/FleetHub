import { api } from './api';

export const getManagerDashboard = async () => {
  const res = await api.get('/manager/dashboard');
  return res.data;
};

export const getManagerDeliveryRequests = async (status?: string) => {
  const endpoint = status ? `/manager/delivery-requests?status=${status}` : '/manager/delivery-requests';
  const res = await api.get(endpoint);
  return res.data;
};

export const getManagerDeliveryRequestById = async (id: string) => {
  const res = await api.get(`/manager/delivery-requests/${id}`);
  return res.data;
};

export const updateDeliveryRequestStatus = async (id: string, status: string) => {
  const res = await api.patch(`/manager/delivery-requests/${id}/status`, { status });
  return res.data;
};

export const dispatchDelivery = async (payload: {
  requestId: string;
  driverId?: string;
  vehicleId?: string;
  priority?: string;
  expectedDeliveryTime?: string;
  amount?: number;
  specialInstructions?: string;
}) => {
  const res = await api.post('/manager/dispatch', payload);
  return res.data;
};

export const getManagerDeliveries = async (status?: string) => {
  const endpoint = status ? `/manager/deliveries?status=${status}` : '/manager/deliveries';
  const res = await api.get(endpoint);
  return res.data;
};

export const getManagerDeliveryById = async (id: string) => {
  const res = await api.get(`/manager/deliveries/${id}`);
  return res.data;
};

export const updateDeliveryStatus = async (id: string, status: string) => {
  const res = await api.patch(`/manager/deliveries/${id}/status`, { status });
  return res.data;
};

export const deleteDelivery = async (id: string) => {
  const res = await api.delete(`/manager/deliveries/${id}`);
  return res.data;
};

export const getDriverConcerns = async (status?: string) => {
  const endpoint = status ? `/manager/concerns?status=${status}` : '/manager/concerns';
  const res = await api.get(endpoint);
  return res.data;
};

export const reviewDriverConcern = async (id: string, payload: { status: string; managerReviewNotes?: string }) => {
  const res = await api.patch(`/manager/concerns/${id}`, payload);
  return res.data;
};

export const getCompletedTrips = async () => {
  const res = await api.get('/manager/trips');
  return res.data;
};

export const getCompletedTripById = async (id: string) => {
  const res = await api.get(`/manager/trips/${id}`);
  return res.data;
};

export const getDriverPerformance = async (driverId: string) => {
  const res = await api.get(`/manager/drivers/${driverId}/performance`);
  return res.data;
};

export const getAiRecommendations = async (requestId?: string) => {
  const endpoint = requestId ? `/manager/ai-recommendations?requestId=${requestId}` : '/manager/ai-recommendations';
  const res = await api.get(endpoint);
  return res.data;
};

export const getManagerDrivers = async () => {
  const res = await api.get('/manager/drivers');
  return res.data;
};

export const getManagerDriverById = async (id: string) => {
  const res = await api.get(`/manager/drivers/${id}`);
  return res.data;
};

export const createDriver = async (payload: Record<string, any>) => {
  const res = await api.post('/manager/drivers', payload);
  return res.data;
};

export const deleteDriverApi = async (id: string) => {
  const res = await api.delete(`/manager/drivers/${id}`);
  return res.data;
};

export const getFleetIntelligence = async () => {
  const res = await api.get('/manager/driver-intelligence');
  return res.data;
};

export const getDriverIntelligence = async (driverId: string) => {
  const res = await api.get(`/manager/drivers/${driverId}/intelligence`);
  return res.data;
};

export const recommendDrivers = async (payload: {
  requestId?: string;
  pickupAddress: string;
  dropAddress: string;
  packageCategory?: string;
  weightKg?: number;
  handleWithCare?: boolean;
  priority?: string;
  distanceKm?: number;
  estimatedCost?: number;
}) => {
  const res = await api.post('/manager/recommend-drivers', payload);
  return res.data;
};

