require('dotenv').config();
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

const firstNames = [
  'Aarav','Aisha','Rohan','Priya','Karan','Neha','Arjun',
  'Meera','Vikram','Ananya','Rahul','Shreya','Kabir','Pooja',
  'Nikhil','Divya','Raj','Sanya','Aditya','Kavya'
];

const lastNames = [
  'Sharma','Patel','Gupta','Singh','Mehta','Joshi','Kumar',
  'Verma','Nair','Reddy','Shah','Rao','Malhotra','Kapoor'
];

const menuItems = [
  'Cold Brew','Espresso','Cappuccino','Latte','Flat White',
  'Matcha Latte','Americano','Mocha','Chai Latte','Cortado',
  'Cold Brew Bundle','Seasonal Special','Croissant','Muffin'
];

const channels = ['whatsapp', 'sms', 'email', 'rcs'];

function randomFrom(arr) { 
  return arr[Math.floor(Math.random() * arr.length)]; 
}
function randomInt(min, max) { 
  return Math.floor(Math.random() * (max - min + 1)) + min; 
}
function randomFloat(min, max) { 
  return parseFloat((Math.random() * (max - min) + min).toFixed(2)); 
}
function daysAgo(n) { 
  const d = new Date(); 
  d.setDate(d.getDate() - n); 
  return d; 
}

function generateCustomer() {
  const firstName = randomFrom(firstNames);
  const lastName = randomFrom(lastNames);
  const archetype = randomFrom([
    'champion','loyal','at_risk','lapsed','new','high_spender'
  ]);

  let visitCount, daysSinceLastOrder, totalSpent;

  switch (archetype) {
    case 'champion':
      visitCount = randomInt(20, 50);
      daysSinceLastOrder = randomInt(1, 10);
      totalSpent = randomFloat(3000, 8000);
      break;
    case 'loyal':
      visitCount = randomInt(10, 20);
      daysSinceLastOrder = randomInt(5, 20);
      totalSpent = randomFloat(1500, 3000);
      break;
    case 'at_risk':
      visitCount = randomInt(5, 15);
      daysSinceLastOrder = randomInt(21, 45);
      totalSpent = randomFloat(800, 2000);
      break;
    case 'lapsed':
      visitCount = randomInt(2, 8);
      daysSinceLastOrder = randomInt(46, 90);
      totalSpent = randomFloat(300, 1200);
      break;
    case 'new':
      visitCount = randomInt(1, 3);
      daysSinceLastOrder = randomInt(1, 15);
      totalSpent = randomFloat(150, 500);
      break;
    case 'high_spender':
      visitCount = randomInt(8, 25);
      daysSinceLastOrder = randomInt(10, 40);
      totalSpent = randomFloat(5000, 15000);
      break;
  }

  return {
    id: uuidv4(),
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randomInt(1,999)}@gmail.com`,
    phone: `+91${randomInt(7000000000, 9999999999)}`,
    channel_preference: randomFrom(channels),
    total_spent: totalSpent,
    visit_count: visitCount,
    last_order_date: daysAgo(daysSinceLastOrder),
    tags: [archetype],
    created_at: daysAgo(randomInt(daysSinceLastOrder, 180))
  };
}

function generateOrders(customerId, visitCount, lastOrderDate, totalSpent) {
  const orders = [];
  for (let i = 0; i < visitCount; i++) {
    const orderDate = new Date(lastOrderDate);
    orderDate.setDate(orderDate.getDate() - (i * randomInt(3, 14)));

    const numItems = randomInt(1, 3);
    const orderItems = [];
    let orderAmount = 0;

    for (let j = 0; j < numItems; j++) {
      const price = randomFloat(150, 450);
      const qty = randomInt(1, 2);
      orderItems.push({ 
        name: randomFrom(menuItems), 
        quantity: qty, 
        price 
      });
      orderAmount += price * qty;
    }

    orders.push({
      id: uuidv4(),
      customer_id: customerId,
      amount: parseFloat(orderAmount.toFixed(2)),
      items: JSON.stringify(orderItems),
      status: 'completed',
      created_at: orderDate
    });
  }
  return orders;
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding BrewMatic database...');

    await client.query(`
      TRUNCATE orders, segment_customers, communications, 
      agent_conversations, campaigns, segments, customers 
      CASCADE
    `);
    console.log('🧹 Cleared existing data');

    const customers = Array.from({ length: 200 }, generateCustomer);

    for (const c of customers) {
      await client.query(
        `INSERT INTO customers 
          (id, name, email, phone, channel_preference, 
           total_spent, visit_count, last_order_date, tags, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [c.id, c.name, c.email, c.phone, c.channel_preference,
         c.total_spent, c.visit_count, c.last_order_date, 
         c.tags, c.created_at]
      );

      const orders = generateOrders(
        c.id, c.visit_count, c.last_order_date, c.total_spent
      );
      
      for (const o of orders) {
        await client.query(
          `INSERT INTO orders 
            (id, customer_id, amount, items, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [o.id, o.customer_id, o.amount, o.items, o.status, o.created_at]
        );
      }
    }

    console.log('✅ 200 customers seeded with full order history');
    console.log('🎉 BrewMatic is ready.');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();