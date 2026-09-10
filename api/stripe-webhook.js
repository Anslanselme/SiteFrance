const Stripe = require('stripe');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function euro(n) {
  return n.toFixed(2).replace('.', ',') + ' €';
}

async function sendOrderEmail(session, lineItems) {
  const name = session.shipping_details?.name || session.customer_details?.name || '(nom non fourni)';
  const email = session.customer_details?.email || '(email non fourni)';
  const phone = session.customer_details?.phone || '';
  const addr = session.shipping_details?.address || session.customer_details?.address;
  const addrText = addr
    ? `${addr.line1 || ''} ${addr.line2 || ''}, ${addr.postal_code || ''} ${addr.city || ''}, ${addr.country || ''}`
    : '(adresse non fournie)';

  const rows = lineItems.map((li) => {
    const product = li.price && li.price.product;
    const image = product && product.images && product.images[0];
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">
          ${image ? `<img src="${image}" alt="" width="70" style="border-radius:6px;display:block;">` : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${li.description}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">× ${li.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${euro(li.amount_total / 100)}</td>
      </tr>`;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2>Nouvelle commande FortDébat — ${euro(session.amount_total / 100)}</h2>
      <p><b>Client :</b> ${name}<br>
         <b>E-mail :</b> ${email}<br>
         ${phone ? `<b>Téléphone :</b> ${phone}<br>` : ''}
         <b>Adresse de livraison :</b> ${addrText}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th></th><th style="text-align:left;padding:8px;">Article</th>
            <th style="padding:8px;">Qté</th><th style="text-align:right;padding:8px;">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM || 'FortDébat <onboarding@resend.dev>',
      to: process.env.NOTIFY_EMAIL,
      subject: `Nouvelle commande — ${euro(session.amount_total / 100)}`,
      html,
    }),
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  const rawBody = await readRawBody(req);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Signature webhook invalide', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
        expand: ['data.price.product'],
        limit: 100,
      });
      await sendOrderEmail(session, lineItems.data);
    } catch (err) {
      console.error('Erreur envoi e-mail de commande', err);
    }
  }

  res.status(200).json({ received: true });
};
