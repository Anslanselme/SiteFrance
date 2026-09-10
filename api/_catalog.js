const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'catalog.json'), 'utf8'));

// aplati en { ref: { name, label, price, image, productKey } } pour une recherche O(1)
const flat = {};
for (const [productKey, product] of Object.entries(raw)) {
  for (const size of product.sizes) {
    flat[size.ref] = {
      name: product.name,
      label: size.label,
      price: size.price,
      image: product.image,
      productKey,
    };
  }
}

module.exports = { catalog: raw, flatCatalog: flat };
