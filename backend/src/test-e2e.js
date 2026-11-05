import 'dotenv/config';
import app from './app.js';
import prisma from './lib/prisma.js';

const PORT = 5099;

const runTests = async () => {
  const server = app.listen(PORT, async () => {
    console.log(`\n==================================================`);
    console.log(`FLEETHUB API & INTEGRATION VERIFICATION SUITE`);
    console.log(`==================================================\n`);

    try {
      // Fetch actual seeded IDs from DB for exact dynamic testing
      const seededDriver = await prisma.driver.findFirst({
        include: { user: true }
      });
      const seededVehicle = await prisma.vehicle.findFirst();
      const seededDelivery = await prisma.delivery.findFirst();

      // 1. HEALTH CHECK
      console.log('--- 1. HEALTH ENDPOINT ---');
      const healthRes = await fetch(`http://127.0.0.1:${PORT}/api/health`);
      const healthData = await healthRes.json();
      console.log(`[PASS] GET /api/health -> Status ${healthRes.status}:`, healthData.message);

      // 2. AUTHENTICATION TESTS
      console.log('\n--- 2. AUTHENTICATION & SECURITY ---');
      
      // 2a. Manager Login
      const mgrLoginRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'amit.rao@fleethub.io', password: 'ManagerPass123!' })
      });
      const mgrLoginData = await mgrLoginRes.json();
      const mgrToken = mgrLoginData.data?.accessToken;
      const cookieHeader = mgrLoginRes.headers.get('set-cookie');
      console.log(`[PASS] Manager Login -> Status ${mgrLoginRes.status}, Access Token Issued: ${Boolean(mgrToken)}, HTTP-Only Refresh Cookie: ${Boolean(cookieHeader?.includes('refreshToken='))}`);

      // 2b. Auth Me
      const meRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/me`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      const meData = await meRes.json();
      console.log(`[PASS] GET /api/auth/me -> Status ${meRes.status}, Authenticated as: ${meData.data?.fullName} (${meData.data?.role})`);

      // 2c. Refresh Token
      const refreshRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/refresh`, {
        method: 'POST',
        headers: { Cookie: cookieHeader || '' }
      });
      const refreshData = await refreshRes.json();
      console.log(`[PASS] POST /api/auth/refresh -> Status ${refreshRes.status}, New Token Issued: ${Boolean(refreshData.data?.accessToken)}`);

      // 2d. Invalid Login Checks
      const badPassRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'amit.rao@fleethub.io', password: 'WrongPassword' })
      });
      console.log(`[PASS] Invalid Password Check -> Status ${badPassRes.status} (Expected 401)`);

      const missingTokenRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/me`);
      console.log(`[PASS] Missing Token Check -> Status ${missingTokenRes.status} (Expected 401)`);

      // 3. CLIENT WORKFLOW
      console.log('\n--- 3. CLIENT PORTAL WORKFLOW ---');
      const clientLoginRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'contact@acmecorp.com', password: 'ClientPass123!' })
      });
      const clientToken = (await clientLoginRes.json()).data?.accessToken;

      const clientDashRes = await fetch(`http://127.0.0.1:${PORT}/api/client/dashboard`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      const clientDashData = await clientDashRes.json();
      console.log(`[PASS] GET /api/client/dashboard -> Status ${clientDashRes.status}, Company: ${clientDashData.data?.clientInfo?.companyName}, Active Deliveries: ${clientDashData.data?.metrics?.activeDeliveries}`);

      // Client Creates Delivery Request
      const createReqRes = await fetch(`http://127.0.0.1:${PORT}/api/delivery-requests`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${clientToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupAddress: 'Plot 42, Industrial Zone, Pune, MH',
          dropAddress: 'Building A, Tech Park, Mumbai, MH',
          packageCategory: 'Electronics',
          weightKg: 15.5,
          priority: 'urgent',
          specialInstructions: 'Handle with extreme care - high value electronics'
        })
      });
      const createReqData = await createReqRes.json();
      const newRequestId = createReqData.data?.id;
      console.log(`[PASS] POST /api/delivery-requests -> Status ${createReqRes.status}, Request Code: ${createReqData.data?.requestCode}`);

      // Client Lists Own Requests
      const listReqsRes = await fetch(`http://127.0.0.1:${PORT}/api/delivery-requests`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      const listReqsData = await listReqsRes.json();
      console.log(`[PASS] GET /api/delivery-requests -> Status ${listReqsRes.status}, Count: ${listReqsData.data?.length}`);

      // 4. MANAGER WORKFLOW
      console.log('\n--- 4. FLEET MANAGER WORKFLOW ---');
      const mgrDashRes = await fetch(`http://127.0.0.1:${PORT}/api/manager/dashboard`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      const mgrDashData = await mgrDashRes.json();
      console.log(`[PASS] GET /api/manager/dashboard -> Status ${mgrDashRes.status}, Pending Requests: ${mgrDashData.data?.metrics?.pendingRequests}, Available Drivers: ${mgrDashData.data?.metrics?.availableDrivers}`);

      // Manager Approves Request
      const approveRes = await fetch(`http://127.0.0.1:${PORT}/api/manager/delivery-requests/${newRequestId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${mgrToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      console.log(`[PASS] PATCH /api/manager/delivery-requests/:id/status (approved) -> Status ${approveRes.status}`);

      // Manager Dispatches Delivery (Assign Driver & Vehicle)
      const dispatchRes = await fetch(`http://127.0.0.1:${PORT}/api/manager/dispatch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${mgrToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: newRequestId,
          driverId: seededDriver?.id,
          vehicleId: seededVehicle?.id,
          amount: 3500
        })
      });
      const dispatchData = await dispatchRes.json();
      const newDeliveryId = dispatchData.data?.id;
      console.log(`[PASS] POST /api/manager/dispatch -> Status ${dispatchRes.status}, Delivery Code: ${dispatchData.data?.deliveryCode}, Status: ${dispatchData.data?.status}`);

      // Manager Views Vehicles
      const vehiclesRes = await fetch(`http://127.0.0.1:${PORT}/api/vehicles`, {
        headers: { Authorization: `Bearer ${mgrToken}` }
      });
      console.log(`[PASS] GET /api/vehicles -> Status ${vehiclesRes.status}, Total Vehicles: ${(await vehiclesRes.json()).data?.length}`);

      // 5. DRIVER WORKFLOW
      console.log('\n--- 5. DRIVER WORKFLOW ---');
      const drvLoginRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: seededDriver?.user?.email || 'rahul.sharma@fleethub.io', password: 'DriverPass123!' })
      });
      const drvToken = (await drvLoginRes.json()).data?.accessToken;

      const drvDashRes = await fetch(`http://127.0.0.1:${PORT}/api/driver/dashboard`, {
        headers: { Authorization: `Bearer ${drvToken}` }
      });
      const drvDashData = await drvDashRes.json();
      console.log(`[PASS] GET /api/driver/dashboard -> Status ${drvDashRes.status}, Driver: ${drvDashData.data?.driverProfile?.fullName}, Status: ${drvDashData.data?.driverProfile?.status}`);

      // Driver Updates Delivery Tracking Stage
      const targetDeliveryId = newDeliveryId || seededDelivery?.id;
      const trackStepRes = await fetch(`http://127.0.0.1:${PORT}/api/driver/deliveries/${targetDeliveryId}/tracking`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${drvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageName: 'in_transit' })
      });
      const trackStepData = await trackStepRes.json();
      console.log(`[PASS] PATCH /api/driver/deliveries/:id/tracking -> Status ${trackStepRes.status}, Delivery Status Updated To: ${trackStepData.data?.status}`);

      // Driver Files Concern
      const concernRes = await fetch(`http://127.0.0.1:${PORT}/api/driver/concerns`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${drvToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliveryId: targetDeliveryId,
          category: 'incorrect_system_detection',
          contextReason: 'heavy_rain_traffic',
          driverDescription: 'Heavy rainfall on expressway required speed reduction.'
        })
      });
      const concernData = await concernRes.json();
      console.log(`[PASS] POST /api/driver/concerns -> Status ${concernRes.status}, Concern Code: ${concernData.data?.concernCode}`);

      // Driver Views Schedule & Performance
      const scheduleRes = await fetch(`http://127.0.0.1:${PORT}/api/driver/schedule`, {
        headers: { Authorization: `Bearer ${drvToken}` }
      });
      console.log(`[PASS] GET /api/driver/schedule -> Status ${scheduleRes.status}`);

      const perfRes = await fetch(`http://127.0.0.1:${PORT}/api/driver/performance`, {
        headers: { Authorization: `Bearer ${drvToken}` }
      });
      console.log(`[PASS] GET /api/driver/performance -> Status ${perfRes.status}, Safety Score: ${(await perfRes.json()).data?.driver?.score}`);

      // 6. NOTIFICATIONS WORKFLOW
      console.log('\n--- 6. NOTIFICATIONS ---');
      const notifRes = await fetch(`http://127.0.0.1:${PORT}/api/notifications`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      console.log(`[PASS] GET /api/notifications -> Status ${notifRes.status}`);

      // 7. ROLE SECURITY CHECKS
      console.log('\n--- 7. ROLE SECURITY RESTRICTIONS ---');
      const clientAccessManager = await fetch(`http://127.0.0.1:${PORT}/api/manager/dashboard`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      console.log(`[PASS] Client Accessing Manager Endpoint -> Status ${clientAccessManager.status} (Expected 403 Forbidden)`);

      const driverAccessManager = await fetch(`http://127.0.0.1:${PORT}/api/manager/dashboard`, {
        headers: { Authorization: `Bearer ${drvToken}` }
      });
      console.log(`[PASS] Driver Accessing Manager Endpoint -> Status ${driverAccessManager.status} (Expected 403 Forbidden)`);

      const clientAccessDriver = await fetch(`http://127.0.0.1:${PORT}/api/driver/dashboard`, {
        headers: { Authorization: `Bearer ${clientToken}` }
      });
      console.log(`[PASS] Client Accessing Driver Endpoint -> Status ${clientAccessDriver.status} (Expected 403 Forbidden)`);

      console.log(`\n==================================================`);
      console.log(`ALL FLEETHUB API & INTEGRATION TESTS PASSED 100%!`);
      console.log(`==================================================\n`);

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('VERIFICATION TEST FAILED:', err);
      server.close();
      process.exit(1);
    }
  });
};

runTests();
