import fs from "fs";
import path from "path";

// Load environment variables from .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const matched = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (matched) {
      const key = matched[1];
      let value = matched[2] || "";
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

async function migrateHandles() {
  const { shopifyAdminFetch } = await import("../src/lib/shopify");
  console.log("🚀 Starting migration of existing Shopify product handles to match their SKUs...");

  try {
    // 1. Fetch all products
    const res = await shopifyAdminFetch<any>({
      query: `
        query getProducts {
          products(first: 250) {
            edges {
              node {
                id
                title
                handle
                variants(first: 1) {
                  edges {
                    node {
                      sku
                    }
                  }
                }
              }
            }
          }
        }
      `
    });

    const products = res.products?.edges || [];
    console.log(`Found ${products.length} products on Shopify.`);

    let updatedCount = 0;

    for (const edge of products) {
      const product = edge.node;
      const sku = product.variants?.edges?.[0]?.node?.sku;

      if (!sku) {
        console.log(`⚠️ Product "${product.title}" (${product.id}) has no SKU. Skipping.`);
        continue;
      }

      const targetHandle = sku.toLowerCase().trim();

      if (product.handle === targetHandle) {
        console.log(`✓ Product "${product.title}" already has correct handle: ${product.handle}`);
        continue;
      }

      console.log(`⏳ Updating "${product.title}": handle "${product.handle}" -> "${targetHandle}"...`);

      const updateRes = await shopifyAdminFetch<any>({
        query: `
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product {
                id
                handle
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          input: {
            id: product.id,
            handle: targetHandle
          }
        }
      });

      const errors = updateRes.productUpdate?.userErrors || [];
      if (errors.length > 0) {
        console.error(`❌ Failed to update handle for "${product.title}":`, errors.map((e: any) => e.message).join(", "));
      } else {
        console.log(`✅ Successfully updated handle for "${product.title}" to "${updateRes.productUpdate.product.handle}".`);
        updatedCount++;
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`🎉 Handle migration finished! Updated ${updatedCount} products.`);
  } catch (err: any) {
    console.error("❌ Migration failed with error:", err.message || err);
  }
}

migrateHandles();
