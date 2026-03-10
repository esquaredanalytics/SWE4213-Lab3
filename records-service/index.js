const amqp = require('amqplib');
let records = [];

async function connectRabbitmq(retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      return await amqp.connect(process.env.RABBITMQ_URL || 'amqp://rabbitmq');
    } catch (err) {
      console.log(`RabbitMQ not ready, retrying... (${i + 1}/${retries})`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  throw new Error('Failed to connect to RabbitMQ');
}

async function main() {
  console.log('Records Service starting...');
  const conn = await connectRabbitmq();
  const ch = await conn.createChannel();

  await ch.assertExchange('appts', 'fanout', { durable: true });
  const q = await ch.assertQueue('records', { durable: true });
  await ch.bindQueue('records', 'appts', '');

  ch.prefetch(1);
  console.log('Records waiting for messages. Press CTRL+C to exit');

  ch.consume('records', (msg) => {
    const event = JSON.parse(msg.content.toString());
    records.push(`${event.patient_email} → ${event.doctor_name} (${event.reason}) at ${event.timestamp}`);
    console.log(`Records - New appointment logged — total on record: ${records.length}`);
    records.slice(-3).forEach(r => console.log(`  ${r}`));
    ch.ack(msg);
  }, { noAck: false });
}

main().catch(console.error);
