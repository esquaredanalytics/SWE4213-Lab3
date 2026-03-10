const amqp = require('amqplib');

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
  console.log('Notification Service starting...');
  const conn = await connectRabbitmq();
  const ch = await conn.createChannel();

  await ch.assertExchange('appts', 'fanout', { durable: true });
  const q = await ch.assertQueue('notifications', { durable: true });
  await ch.bindQueue('notifications', 'appts', '');

  ch.prefetch(1);
  console.log('Notification waiting for messages. Press CTRL+C to exit');

  ch.consume('notifications', (msg) => {
    const event = JSON.parse(msg.content.toString());
    console.log(`Notification - Sending confirmation to ${event.patient_email}`);
    console.log(`Appointment ID: ${event.appointment_id}`);
    console.log(`Doctor: ${event.doctor_name}`);
    console.log(`Reason: ${event.reason}`);
    console.log('Status: confirmed');
    ch.ack(msg);
  }, { noAck: false });
}

main().catch(console.error);
