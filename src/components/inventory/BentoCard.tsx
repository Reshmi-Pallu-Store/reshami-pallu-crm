import React from 'react';
import Link from 'next/link';
import styles from './inventory.module.css';

interface BentoCardProps {
  product: any; // SaaS type, minimal properties used
  onDelete?: (id: string) => void;
}

export const BentoCard: React.FC<BentoCardProps> = ({ product, onDelete }) => {
  const { id, title, imageUrl, price, sku, stock, tags, handle } = product;
  
  // Extract numeric ID from Shopify GID (e.g. gid://shopify/Product/12345 -> 12345)
  const numericId = id?.split('/').pop() || '';

  const storeUrl = `https://reshmipallu.com/products/${handle || ''}`;

  return (
    <div className={styles.bentoCard} role="listitem">
      <div className={styles.bentoImageWrapper}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} className={styles.bentoImage} />
        ) : (
          <div className={styles.bentoImage} style={{ background: '#ddd' }} />
        )}
      </div>
      <div className={styles.bentoInfo}>
        <h3 className={styles.bentoTitle}>{title}</h3>
        <p className={styles.bentoSku}>SKU: {sku}</p>
        <p className={styles.bentoPrice}>₹ {price?.toFixed(2)}</p>
        <p className={styles.bentoStock}>Stock: {stock}</p>
        <div className={styles.bentoTags}>
          {tags?.map((tag: string) => (
            <span key={tag} className={styles.bentoTag}>{tag}</span>
          ))}
        </div>
      </div>
      <div className={styles.bentoActions}>
        <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={`${styles.bentoBtn} ${styles.bentoBtnView}`} style={{ background: 'hsl(210, 80%, 95%)', color: 'hsl(210, 80%, 35%)' }}>
          Store
        </a>
        <Link href={`/products/edit/${numericId}`} className={`${styles.bentoBtn} ${styles.bentoBtnView}`}>Edit</Link>
        {onDelete && (
          <button className={`${styles.bentoBtn} ${styles.bentoBtnDelete}`} onClick={() => onDelete(id)}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
};
