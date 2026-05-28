const domain = process.env.SHOPIFY_STORE_DOMAIN || 'reshmi-pallu.myshopify.com';
const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION || '2026-04';

if (!token) {
  throw new Error("Missing SHOPIFY_ADMIN_ACCESS_TOKEN environment variable in .env.local");
}

const endpoint = `https://${domain}/admin/api/${apiVersion}/graphql.json`;

interface AdminResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function shopifyAdminFetch<T>({
  query,
  variables = {},
  cache = 'no-store'
}: {
  query: string;
  variables?: Record<string, unknown>;
  cache?: RequestCache;
}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': token || '',
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      cache
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Shopify Admin API error ${response.status}: ${errText}`);
    }

    const json: AdminResponse<T> = await response.json();

    if (json.errors?.length) {
      throw new Error(`Shopify Admin GraphQL errors: ${json.errors.map(e => e.message).join(', ')}`);
    }

    return json.data as T;
  } catch (error: any) {
    console.error("Shopify Admin Fetch Failure:", error);
    throw error;
  }
}

/**
 * Types representing Saree Product structure in CRM
 */
export interface SareeProduct {
  id: string;
  title: string;
  descriptionHtml: string;
  handle: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  tags: string[];
  imageUrl?: string;
  sku: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  locationId?: string;
  inventoryItemId?: string;
  metafields: {
    fabric?: string;
    weave?: string;
    colorFamily?: string;
    occasion?: string;
    region?: string;
    blouseIncluded?: boolean;
    blouseLength?: string;
    washCare?: string;
    shortVideo?: {
      id: string;
      url: string;
    };
    foundersExclusive?: boolean;
  };
}

/**
 * GraphQL fragments to ensure all queries are fully synced
 */
const PRODUCT_FRAGMENT = `
  fragment ProductDetails on Product {
    id
    title
    descriptionHtml
    handle
    status
    tags
    featuredImage {
      url
    }
    variants(first: 1) {
      edges {
        node {
          id
          sku
          price
          compareAtPrice
          inventoryItem {
            id
            inventoryLevels(first: 1) {
              edges {
                node {
                  quantities(names: ["on_hand"]) {
                    name
                    quantity
                  }
                  location {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
    fabric: metafield(namespace: "saree", key: "fabric") { value }
    weave: metafield(namespace: "saree", key: "weave") { value }
    colorFamily: metafield(namespace: "saree", key: "color_family") { value }
    occasion: metafield(namespace: "saree", key: "occasion") { value }
    region: metafield(namespace: "saree", key: "region") { value }
    blouseIncluded: metafield(namespace: "saree", key: "blouse_included") { value }
    blouseLength: metafield(namespace: "saree", key: "blouse_length") { value }
    washCare: metafield(namespace: "saree", key: "wash_care") { value }
    shortVideo: metafield(namespace: "saree", key: "short_video") {
      value
      reference {
        ... on Video {
          id
          sources {
            url
            mimeType
          }
        }
      }
    }
    foundersExclusive: metafield(namespace: "saree", key: "founders_exclusive") { value }
  }
`;

function mapShopifyProduct(node: any): SareeProduct {
  const variantEdge = node.variants?.edges?.[0]?.node;
  const invLevelEdge = variantEdge?.inventoryItem?.inventoryLevels?.edges?.[0]?.node;
  const onHandQty = invLevelEdge?.quantities?.find((q: any) => q.name === "on_hand")?.quantity || 0;

  // Extract short video
  let shortVideoData;
  if (node.shortVideo?.reference) {
    const videoSource = node.shortVideo.reference.sources?.find((s: any) => s.mimeType === "video/mp4") || node.shortVideo.reference.sources?.[0];
    shortVideoData = {
      id: node.shortVideo.reference.id,
      url: videoSource?.url || ""
    };
  }

  return {
    id: node.id,
    title: node.title,
    descriptionHtml: node.descriptionHtml || '',
    handle: node.handle,
    status: node.status,
    tags: node.tags || [],
    imageUrl: node.featuredImage?.url,
    sku: variantEdge?.sku || '',
    price: parseFloat(variantEdge?.price || '0'),
    compareAtPrice: variantEdge?.compareAtPrice ? parseFloat(variantEdge.compareAtPrice) : null,
    stock: onHandQty,
    locationId: invLevelEdge?.location?.id,
    inventoryItemId: variantEdge?.inventoryItem?.id,
    metafields: {
      fabric: node.fabric?.value,
      weave: node.weave?.value,
      colorFamily: node.colorFamily?.value,
      occasion: node.occasion?.value,
      region: node.region?.value,
      blouseIncluded: node.blouseIncluded?.value === 'true',
      blouseLength: node.blouseLength?.value,
      washCare: node.washCare?.value,
      shortVideo: shortVideoData,
      foundersExclusive: node.foundersExclusive?.value === 'true',
    }
  };
}

export const shopifySaree = {
  // Fetch active and draft products (Sarees)
  async list(limit = 50, cursor: string | null = null): Promise<{ products: SareeProduct[], nextCursor: string | null }> {
    const query = `
      ${PRODUCT_FRAGMENT}
      query getProducts($first: Int!, $after: String) {
        products(first: $first, after: $after, query: "vendor:'Reshami Pallu'") {
          edges {
            cursor
            node {
              ...ProductDetails
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    const data = await shopifyAdminFetch<{ products: { edges: Array<{ cursor: string, node: any }>, pageInfo: { hasNextPage: boolean } } }>({
      query,
      variables: { first: limit, after: cursor }
    });

    const edges = data.products.edges;
    const products = edges.map(edge => mapShopifyProduct(edge.node));
    const nextCursor = data.products.pageInfo.hasNextPage ? edges[edges.length - 1].cursor : null;

    return { products, nextCursor };
  },

  // Get a single product details
  async get(id: string): Promise<SareeProduct | null> {
    const query = `
      ${PRODUCT_FRAGMENT}
      query getProduct($id: ID!) {
        product(id: $id) {
          ...ProductDetails
        }
      }
    `;

    try {
      const data = await shopifyAdminFetch<{ product: any }>({
        query,
        variables: { id }
      });
      return data.product ? mapShopifyProduct(data.product) : null;
    } catch {
      return null;
    }
  },

  // Create a new Saree in Shopify
  async create(saree: Omit<SareeProduct, 'id' | 'imageUrl' | 'locationId' | 'inventoryItemId'>): Promise<SareeProduct> {
    const mutation = `
      ${PRODUCT_FRAGMENT}
      mutation productCreateWithMetafields($input: ProductInput!, $media: [CreateMediaInput!]) {
        productCreate(input: $input, media: $media) {
          product {
            ...ProductDetails
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Map input fields to Shopify parameters
    const metafields = [
      { namespace: "saree", key: "fabric", value: saree.metafields.fabric || '', type: "single_line_text_field" },
      { namespace: "saree", key: "weave", value: saree.metafields.weave || '', type: "single_line_text_field" },
      { namespace: "saree", key: "color_family", value: saree.metafields.colorFamily || '', type: "single_line_text_field" },
      { namespace: "saree", key: "occasion", value: saree.metafields.occasion || '', type: "single_line_text_field" },
      { namespace: "saree", key: "region", value: saree.metafields.region || '', type: "single_line_text_field" },
      { namespace: "saree", key: "blouse_included", value: saree.metafields.blouseIncluded ? 'true' : 'false', type: "single_line_text_field" },
      { namespace: "saree", key: "blouse_length", value: saree.metafields.blouseLength || '', type: "single_line_text_field" },
      { namespace: "saree", key: "wash_care", value: saree.metafields.washCare || '', type: "single_line_text_field" },
      { namespace: "saree", key: "founders_exclusive", value: saree.metafields.foundersExclusive ? 'true' : 'false', type: "single_line_text_field" },
    ].filter(m => m.value !== '');

    // Add short video if a file reference exists
    if (saree.metafields.shortVideo?.id) {
      metafields.push({
        namespace: "saree",
        key: "short_video",
        value: saree.metafields.shortVideo.id,
        type: "file_reference"
      });
    }

    // Standard product tags
    const tags = [...saree.tags];
    if (saree.metafields.foundersExclusive && !tags.includes('Founders-Exclusive')) {
      tags.push('Founders-Exclusive');
    }

    const variables = {
      input: {
        title: saree.title,
        descriptionHtml: saree.descriptionHtml,
        vendor: "Reshami Pallu",
        status: saree.status,
        tags,
        metafields
      }
    };

    const res = await shopifyAdminFetch<{ productCreate: { product: any, userErrors: Array<{ message: string }> } }>({
      query: mutation,
      variables
    });

    if (res.productCreate.userErrors.length > 0) {
      throw new Error(`Shopify Saree creation failed: ${res.productCreate.userErrors[0].message}`);
    }

    const createdProductDetails = res.productCreate.product;
    const defaultVariantId = createdProductDetails.variants.edges[0]?.node.id;

    if (defaultVariantId) {
      const variantMutation = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variantRes = await shopifyAdminFetch<{ productVariantsBulkUpdate: { productVariants: any[], userErrors: Array<{ message: string }> } }>({
        query: variantMutation,
        variables: {
          productId: createdProductDetails.id,
          variants: [
            {
              id: defaultVariantId,
              price: saree.price.toString(),
              compareAtPrice: saree.compareAtPrice ? saree.compareAtPrice.toString() : null,
              inventoryItem: {
                sku: saree.sku,
                tracked: true
              }
            }
          ]
        }
      });

      if (variantRes.productVariantsBulkUpdate.userErrors.length > 0) {
        throw new Error(`Default variant update failed: ${variantRes.productVariantsBulkUpdate.userErrors[0].message}`);
      }

      // Update in-memory references so mapShopifyProduct works perfectly
      if (createdProductDetails.variants.edges[0]?.node) {
        createdProductDetails.variants.edges[0].node.price = saree.price.toString();
        createdProductDetails.variants.edges[0].node.compareAtPrice = saree.compareAtPrice ? saree.compareAtPrice.toString() : null;
        createdProductDetails.variants.edges[0].node.sku = saree.sku;
      }
    }

    const createdProduct = mapShopifyProduct(createdProductDetails);

    // Set stock quantity if defined and > 0
    if (saree.stock > 0 && createdProduct.inventoryItemId) {
      await this.updateStock(createdProduct.inventoryItemId, saree.stock);
      createdProduct.stock = saree.stock;
    }

    return createdProduct;
  },

  // Update an existing Saree product details
  async update(id: string, saree: Partial<SareeProduct>): Promise<SareeProduct> {
    const mutation = `
      ${PRODUCT_FRAGMENT}
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            ...ProductDetails
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const productInput: any = { id };

    if (saree.title) productInput.title = saree.title;
    if (saree.descriptionHtml !== undefined) productInput.descriptionHtml = saree.descriptionHtml;
    if (saree.status) productInput.status = saree.status;
    if (saree.tags) {
      const tags = [...saree.tags];
      if (saree.metafields?.foundersExclusive && !tags.includes('Founders-Exclusive')) {
        tags.push('Founders-Exclusive');
      }
      productInput.tags = tags;
    }

    // Map Metafields
    if (saree.metafields) {
      const metafields = [];
      const m = saree.metafields;
      
      if (m.fabric !== undefined) metafields.push({ namespace: "saree", key: "fabric", value: m.fabric, type: "single_line_text_field" });
      if (m.weave !== undefined) metafields.push({ namespace: "saree", key: "weave", value: m.weave, type: "single_line_text_field" });
      if (m.colorFamily !== undefined) metafields.push({ namespace: "saree", key: "color_family", value: m.colorFamily, type: "single_line_text_field" });
      if (m.occasion !== undefined) metafields.push({ namespace: "saree", key: "occasion", value: m.occasion, type: "single_line_text_field" });
      if (m.region !== undefined) metafields.push({ namespace: "saree", key: "region", value: m.region, type: "single_line_text_field" });
      if (m.blouseIncluded !== undefined) metafields.push({ namespace: "saree", key: "blouse_included", value: m.blouseIncluded ? 'true' : 'false', type: "single_line_text_field" });
      if (m.blouseLength !== undefined) metafields.push({ namespace: "saree", key: "blouse_length", value: m.blouseLength, type: "single_line_text_field" });
      if (m.washCare !== undefined) metafields.push({ namespace: "saree", key: "wash_care", value: m.washCare, type: "single_line_text_field" });
      if (m.foundersExclusive !== undefined) metafields.push({ namespace: "saree", key: "founders_exclusive", value: m.foundersExclusive ? 'true' : 'false', type: "single_line_text_field" });
      
      if (m.shortVideo?.id) {
        metafields.push({ namespace: "saree", key: "short_video", value: m.shortVideo.id, type: "file_reference" });
      }

      productInput.metafields = metafields;
    }

    // Update variant price, compareAtPrice or SKU if defined
    if (saree.price !== undefined || saree.compareAtPrice !== undefined || saree.sku !== undefined) {
      const existing = await this.get(id);
      if (existing) {
        await this.updateVariant(existing.id, saree.price, saree.compareAtPrice, saree.sku);
      }
    }

    const res = await shopifyAdminFetch<{ productUpdate: { product: any, userErrors: Array<{ message: string }> } }>({
      query: mutation,
      variables: { input: productInput }
    });

    if (res.productUpdate.userErrors.length > 0) {
      throw new Error(`Shopify Saree update failed: ${res.productUpdate.userErrors[0].message}`);
    }

    const updatedProduct = mapShopifyProduct(res.productUpdate.product);

    // Update stock quantity
    if (saree.stock !== undefined && updatedProduct.inventoryItemId) {
      await this.updateStock(updatedProduct.inventoryItemId, saree.stock);
      updatedProduct.stock = saree.stock;
    }

    return updatedProduct;
  },

  // Delete a product in Shopify
  async delete(id: string): Promise<boolean> {
    const mutation = `
      mutation productDelete($input: ProductDeleteInput!) {
        productDelete(input: $input) {
          deletedProductId
          userErrors {
            message
          }
        }
      }
    `;
    const res = await shopifyAdminFetch<{ productDelete: { deletedProductId: string, userErrors: Array<{ message: string }> } }>({
      query: mutation,
      variables: { input: { id } }
    });
    return res.productDelete.userErrors.length === 0;
  },

  // Internal helper to set exact inventory quantities
  async updateStock(inventoryItemId: string, quantity: number): Promise<void> {
    // 1. Get location ID first
    const locQuery = `
      query getLocations {
        locations(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    const locRes = await shopifyAdminFetch<{ locations: { edges: Array<{ node: { id: string } }> } }>({ query: locQuery });
    const locationId = locRes.locations.edges[0]?.node.id;

    if (!locationId) throw new Error("Shopify Locations not configured");

    const mutation = `
      mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) @idempotent {
        inventorySetQuantities(input: $input) {
          inventoryAdjustmentGroup {
            createdAt
          }
          userErrors {
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        name: "available",
        reason: "correction",
        quantities: [
          {
            inventoryItemId,
            locationId,
            quantity,
            changeFromQuantity: null
          }
        ]
      }
    };

    const res = await shopifyAdminFetch<{ inventorySetQuantities: { userErrors: Array<{ message: string }> } }>({
      query: mutation,
      variables
    });

    if (res.inventorySetQuantities.userErrors.length > 0) {
      throw new Error(`Inventory stock update failed: ${res.inventorySetQuantities.userErrors[0].message}`);
    }
  },

  // Helper to update a product variant's price, compareAtPrice or SKU
  async updateVariant(productId: string, price?: number, compareAtPrice?: number | null, sku?: string): Promise<void> {
    // Get the variant ID
    const query = `
      query getVariant($id: ID!) {
        product(id: $id) {
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `;
    const data = await shopifyAdminFetch<{ product: { variants: { edges: Array<{ node: { id: string } }> } } }>({
      query,
      variables: { id: productId }
    });
    const variantId = data.product.variants.edges[0]?.node.id;

    if (!variantId) return;

    const mutation = `
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          userErrors {
            message
          }
        }
      }
    `;

    const variantInput: any = { id: variantId };
    if (price !== undefined) variantInput.price = price.toString();
    if (compareAtPrice !== undefined) variantInput.compareAtPrice = compareAtPrice ? compareAtPrice.toString() : null;
    if (sku !== undefined) {
      variantInput.inventoryItem = {
        sku: sku
      };
    }

    await shopifyAdminFetch({
      query: mutation,
      variables: {
        productId,
        variants: [variantInput]
      }
    });
  },

  /**
   * Uploads an image or video file directly to Shopify using Staged Uploads API.
   * This is a 100% native integration allowing direct video and image uploads.
   */
  async uploadMedia(fileName: string, mimeType: string, fileBuffer: Buffer): Promise<{ id: string, url: string }> {
    // 1. Create Staged Upload URL
    const mutation = `
      mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters {
              name
              value
            }
          }
          userErrors {
            message
          }
        }
      }
    `;

    const uploadInput: any = {
      resource: mimeType.startsWith('video/') ? 'VIDEO' : 'IMAGE',
      filename: fileName,
      mimeType: mimeType,
      httpMethod: 'POST'
    };

    if (mimeType.startsWith('video/')) {
      uploadInput.fileSize = String(fileBuffer.length);
    }

    const stagedRes = await shopifyAdminFetch<{ stagedUploadsCreate: { stagedTargets: Array<{ url: string, resourceUrl: string, parameters: Array<{ name: string, value: string }> }>, userErrors: Array<{ message: string }> } }>({
      query: mutation,
      variables: {
        input: [uploadInput]
      }
    });

    if (stagedRes.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(`Staged upload registration failed: ${stagedRes.stagedUploadsCreate.userErrors[0].message}`);
    }

    const target = stagedRes.stagedUploadsCreate.stagedTargets[0];
    
    // 2. Perform the Multipart POST request to staged target (AWS S3 or GCS)
    const formData = new FormData();
    target.parameters.forEach(p => {
      formData.append(p.name, p.value);
    });
    
    // Append the file buffer as a blob
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });
    formData.append('file', blob, fileName);

    const uploadRes = await fetch(target.url, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload media to staged target: ${errText}`);
    }

    // 3. Register the uploaded file within Shopify's database
    const fileRegisterMutation = `
      mutation fileCreate($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            alt
            createdAt
            ... on Video {
              sources {
                url
              }
            }
            ... on MediaImage {
              image {
                url
              }
            }
          }
          userErrors {
            message
          }
        }
      }
    `;

    const registerRes = await shopifyAdminFetch<{ fileCreate: { files: Array<any>, userErrors: Array<{ message: string }> } }>({
      query: fileRegisterMutation,
      variables: {
        files: [
          {
            alt: fileName.split('.')[0],
            contentType: mimeType.startsWith('video/') ? 'VIDEO' : 'IMAGE',
            originalSource: target.resourceUrl
          }
        ]
      }
    });

    if (registerRes.fileCreate.userErrors.length > 0) {
      throw new Error(`Media registration in Shopify failed: ${registerRes.fileCreate.userErrors[0].message}`);
    }

    const registeredFile = registerRes.fileCreate.files[0];
    
    let fileUrl = '';
    if (mimeType.startsWith('video/')) {
      fileUrl = registeredFile.sources?.[0]?.url || '';
    } else {
      fileUrl = registeredFile.image?.url || '';
    }

    return {
      id: registeredFile.id,
      url: fileUrl
    };
  }
};

export interface SareeCollection {
  id: string;
  title: string;
  handle: string;
  productsCount: number;
}

export const shopifyCollection = {
  // List all collections
  async list(limit = 50): Promise<SareeCollection[]> {
    const query = `
      query getCollections($first: Int!) {
        collections(first: $first) {
          edges {
            node {
              id
              title
              handle
              productsCount
            }
          }
        }
      }
    `;

    try {
      const res = await shopifyAdminFetch<{ collections: { edges: Array<{ node: any }> } }>({
        query,
        variables: { first: limit }
      });

      return res.collections.edges.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        productsCount: edge.node.productsCount || 0
      }));
    } catch (err) {
      console.error("Failed to list collections:", err);
      return [];
    }
  },

  // Create an automated smart collection based on product tag matching
  async createSmart(title: string, tag: string): Promise<boolean> {
    const mutation = `
      mutation collectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        title,
        ruleSet: {
          appliedDisjunctively: false,
          rules: [
            {
              column: "TAG",
              relation: "EQUALS",
              condition: tag
            }
          ]
        }
      }
    };

    try {
      const res = await shopifyAdminFetch<{ collectionCreate: { collection: any, userErrors: Array<{ message: string }> } }>({
        query: mutation,
        variables
      });

      return res.collectionCreate.userErrors.length === 0;
    } catch (err) {
      console.error(`Failed to create Smart Collection for tag ${tag}:`, err);
      return false;
    }
  }
};

export const shopifyOrder = {
  async list(limit = 50): Promise<any[]> {
    const query = `
      query getOrders($first: Int!) {
        orders(first: $first, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              totalPriceSet {
                presentmentMoney {
                  amount
                }
              }
              displayFinancialStatus
              displayFulfillmentStatus
              customer {
                firstName
                lastName
                phone
                email
              }
              tags
              note
              customAttributes {
                key
                value
              }
              lineItems(first: 20) {
                edges {
                  node {
                    title
                    quantity
                    sku
                    originalUnitPriceSet {
                      presentmentMoney {
                        amount
                      }
                    }
                  }
                }
              }
              shippingAddress {
                fullName
                address1
                address2
                city
                province
                zip
                phone
              }
            }
          }
        }
      }
    `;

    try {
      const data = await shopifyAdminFetch<{ orders: { edges: Array<{ node: any }> } }>({
        query,
        variables: { first: limit }
      });
      return data.orders.edges.map(e => e.node);
    } catch (err) {
      console.error("Failed to fetch Shopify orders:", err);
      return [];
    }
  }
};

