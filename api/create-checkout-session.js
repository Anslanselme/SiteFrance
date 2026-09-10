const Stripe = require('stripe');
const { flatCatalog } = require('./_catalog');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const SHIP_COUNTRIES = ['FR', 'BE', 'CH', 'LU'];
const MAX_QTY_PER_LINE = 50;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode non autorisee' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const items = body && Array.isArray(body.items) ? body.items : null;

  if (!items || items.length === 0) {
    res.status(400).json({ error: 'Panier vide ou invalide' });
    return;
  }

  const line_items = [];
  for (const item of items) {
    const ref = String(item && item.ref || '');
    const qty = Math.max(1, Math.min(MAX_QTY_PER_LINE, parseInt(item && item.qty, 10) || 1));
    const product = flatCatalog[ref];
    if (!product) {
      res.status(400).json({ error: `Reference inconnue : ${ref}` });
      return;
    }
    const origin = `https://${req.headers.host}`;
    const productName = product.label ? `${product.name} — ${product.label}` : product.name;
    line_items.push({
      quantity: qty,
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(product.price * 100),
        product_data: {
          name: productName,
          images: [`${origin}/img/${product.image}`],
          metadata: { ref },
        },
      },
    });
  }

  try {
    const origin = `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      shipping_address_collection: { allowed_countries: SHIP_COUNTRIES },
      phone_number_collection: { enabled: true },
      success_url: `${origin}/merci.html`,
      cancel_url: `${origin}/`,
    });
    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur Stripe lors de la creation de la session' });
  }
};
