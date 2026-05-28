import React, { useState, useEffect } from 'react';
import styles from './inventory.module.css';

interface FilterValues {
  priceMin?: number;
  priceMax?: number;
  colour?: string;
  fabric?: string;
  region?: string;
}

interface FilterBarProps {
  onChange: (filters: FilterValues) => void;
  availableColours?: string[];
  availableFabrics?: string[];
  availableRegions?: string[];
}

export const FilterBar: React.FC<FilterBarProps> = ({ onChange, availableColours = [], availableFabrics = [], availableRegions = [] }) => {
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [colour, setColour] = useState('');
  const [fabric, setFabric] = useState('');
  const [region, setRegion] = useState('');

  // Notify parent when any filter changes
  useEffect(() => {
    const filters: FilterValues = {
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      colour: colour || undefined,
      fabric: fabric || undefined,
      region: region || undefined,
    };
    onChange(filters);
  }, [priceMin, priceMax, colour, fabric, region]);

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        <label htmlFor="price-min">Min Price</label>
        <input
          id="price-min"
          type="number"
          placeholder="0"
          value={priceMin}
          onChange={e => setPriceMin(e.target.value)}
        />
      </div>
      <div className={styles.filterGroup}>
        <label htmlFor="price-max">Max Price</label>
        <input
          id="price-max"
          type="number"
          placeholder="2000"
          value={priceMax}
          onChange={e => setPriceMax(e.target.value)}
        />
      </div>
      <div className={styles.filterGroup}>
        <label htmlFor="colour-select">Colour</label>
        <select id="colour-select" value={colour} onChange={e => setColour(e.target.value)}>
          <option value="">All</option>
          {availableColours.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.filterGroup}>
        <label htmlFor="fabric-select">Fabric</label>
        <select id="fabric-select" value={fabric} onChange={e => setFabric(e.target.value)}>
          <option value="">All</option>
          {availableFabrics.map(f => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.filterGroup}>
        <label htmlFor="region-select">Region</label>
        <select id="region-select" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">All</option>
          {availableRegions.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
