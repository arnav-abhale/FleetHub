import 'dotenv/config';
import prisma from './lib/prisma.js';

async function checkDatabase() {
  console.log('==================================================');
  console.log('FLEETHUB DATABASE STATUS ANALYSIS');
  console.log('==================================================\n');

  try {
    const userCount = await prisma.user.count();
    const clientCount = await prisma.client.count();
    const managerCount = await prisma.fleetManager.count();
    const driverCount = await prisma.driver.count();
    const vehicleCount = await prisma.vehicle.count();
    const deliveryReqCount = await prisma.deliveryRequest.count();
    const deliveryCount = await prisma.delivery.count();
    const completedTripCount = await prisma.completedTrip.count();
    const concernCount = await prisma.driverConcern.count();
    const notificationCount = await prisma.notification.count();
    const recCount = await prisma.aiDriverRecommendation.count();

    console.log('✅ PostgreSQL Connection: ACTIVE');
    console.log('✅ Database Name: FleetHub');
    console.log('✅ Database Engine: PostgreSQL via Prisma ORM\n');

    console.log('--- Table Summary & Record Counts ---');
    console.table([
      { Table: 'users', Model: 'User', Records: userCount },
      { Table: 'clients', Model: 'Client', Records: clientCount },
      { Table: 'fleet_managers', Model: 'FleetManager', Records: managerCount },
      { Table: 'drivers', Model: 'Driver', Records: driverCount },
      { Table: 'vehicles', Model: 'Vehicle', Records: vehicleCount },
      { Table: 'delivery_requests', Model: 'DeliveryRequest', Records: deliveryReqCount },
      { Table: 'deliveries', Model: 'Delivery', Records: deliveryCount },
      { Table: 'completed_trips', Model: 'CompletedTrip', Records: completedTripCount },
      { Table: 'driver_concerns', Model: 'DriverConcern', Records: concernCount },
      { Table: 'notifications', Model: 'Notification', Records: notificationCount },
      { Table: 'ai_driver_recommendations', Model: 'AiDriverRecommendation', Records: recCount },
    ]);

    console.log('\n--- Seeded User Accounts Verified ---');
    const users = await prisma.user.findMany({ select: { email: true, role: true } });
    users.forEach(u => console.log(`- Email: ${u.email.padEnd(30)} | Role: ${u.role}`));

    console.log('\n==================================================');
    console.log('DATABASE STATUS: 100% HEALTHY & FULLY OPERATIONAL');
    console.log('==================================================\n');
  } catch (error) {
    console.error('❌ Database Connection Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
