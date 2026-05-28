import React from 'react';
import styles from './inventory.module.css';

interface CategoryTabsProps {
  collections: string[];
  selected: string;
  onSelect: (collection: string) => void;
}

export const CategoryTabs: React.FC<CategoryTabsProps> = ({ collections, selected, onSelect }) => {
  return (
    <div className={styles.categoryTabs} role="tablist">
      {collections.map(col => (
        <button
          key={col}
          className={`${styles.tabItem} ${col === selected ? styles.tabItemActive : ''}`}
          role="tab"
          aria-selected={col === selected}
          onClick={() => onSelect(col)}
        >
          {col}
        </button>
      ))}
    </div>
  );
};
