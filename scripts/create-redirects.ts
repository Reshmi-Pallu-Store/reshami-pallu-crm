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

// Slugify helper matching Shopify's handle generation
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start
    .replace(/-+$/, ""); // Trim - from end
}

async function createRedirects() {
  const { shopifyAdminFetch } = await import("../src/lib/shopify");
  console.log("🚀 Creating URL Redirects from old title-based handles to SKU-based handles...");

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
    console.log(`Analyzing redirects for ${products.length} products...`);

    let redirectCreatedCount = 0;

    for (const edge of products) {
      const product = edge.node;
      const sku = product.variants?.edges?.[0]?.node?.sku;

      if (!sku) continue;

      const newHandle = sku.toLowerCase().trim();
      const oldHandle = slugify(product.title);

      // If the old handle was already the same as the SKU handle, no redirect is needed
      if (oldHandle === newHandle) {
        continue;
      }

      const pathFrom = `/products/${oldHandle}`;
      const pathTo = `/products/${newHandle}`;

      console.log(`⏳ Creating redirect: ${pathFrom} ➔ ${pathTo}...`);

      const redirectRes = await shopifyAdminFetch<any>({
        query: `
          mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
            urlRedirectCreate(urlRedirect: $urlRedirect) {
              urlRedirect {
                id
                path
                target
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          urlRedirect: {
            path: pathFrom,
            target: pathTo
          }
        }
      });

      const errors = redirectRes.urlRedirectCreate?.userErrors || [];
      if (errors.length > 0) {
        // If it fails because the redirect already exists, that's fine
        const errorMsg = errors.map((e: any) => e.message).join(", ");
        if (errorMsg.includes("taken") || errorMsg.includes("already exists") || errorMsg.includes("Path has already been taken")) {
          console.log(`✓ Redirect already exists for ${pathFrom}.`);
        } else {
          console.error(`❌ Failed to create redirect for "${product.title}":`, errorMsg);
        }
      } else {
        console.log(`✅ Redirect created successfully: ${redirectRes.urlRedirectCreate.urlRedirect.path} ➔ ${redirectRes.urlRedirectCreate.urlRedirect.target}`);
        redirectCreatedCount++;
      }

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`🎉 Finished! Created ${redirectCreatedCount} URL redirects on Shopify.`);
  } catch (err: any) {
    console.error("❌ Redirect creation failed with error:", err.message || err);
  }
}

createRedirects();
